# Database & Table Optimization Audit

> Audit zachycuje schéma před migrací 0014. Aktuální model bez tabulky projects popisuje [Databázový model](database-model.md).

Datum auditu: 2026-08-21
Projekt: Test Manager / FET
Rozsah: aktuální pracovní strom repozitáře

Audit byl proveden podle dokumentu `Codex CLI – Database & Table Optimization Audit Prompt.md`. Repozitář, migrace ani databáze nebyly během auditu změněny.

# Database Architecture Summary

- Databáze: PostgreSQL 16 podle `docker-compose.prod.yml`.
- Přístup: synchronní SQLAlchemy 2 + psycopg 3.
- Pool: zapnutý pouze `pool_pre_ping`; velikost, overflow, timeout a recycle nejsou explicitně nastaveny v `backend/app/core/database.py`.
- Transakce: session na HTTP request, ale jednotlivé service funkce samy volají `commit()`.
- Migrace: Alembic, aktuálně 11 revizí a 14 výsledných tabulek. Migrační spojení používá `NullPool`.
- Raw SQL se používá pouze v migracích pro backfill a destruktivní downgrade operace.
- Bez views, materialized views, triggerů, procedur, partitioningu, explicitních sekvencí nebo generated columns.
- Bez cache, read replik, background workerů a oddělení read/write provozu.
- Soft delete je použit pouze pro projekty a test runy pomocí statusu.
- Historie je append-heavy: execution attempts, case attempts, step results a audit events.

Pro run s `C` test cases a průměrně `S` spustitelnými kroky vzniká přibližně:

- `C` řádků v `test_run_cases`,
- `C` řádků v `test_run_case_attempts` za každý full rerun,
- `C × S` řádků v `test_run_step_results` za každý full rerun,
- další `1 + S` řádky za každý individuální case rerun.

Produkční cardinality nejsou v repozitáři dostupné.

# Schema Map

| Tabulka | Hlavní vztahy | Charakter workloadu |
|---|---|---|
| `users` | autor, assignee a executor ostatních entit | malá, read-heavy |
| `projects` | rodič suites, cases, runs a requirements | malá, read-heavy |
| `test_suites` | strom přes `parent_suite_id`, patří projektu | střední, časté čtení |
| `test_cases` | projekt, suite, tagy, steps | vysoké čtení |
| `test_steps` | potomci test case | roste s test cases |
| `test_case_tags` | tři kategorizované číselníky | malá |
| `requirements` | projekt, M:N test cases | střední |
| `requirement_test_cases` | junction requirements ↔ cases | potenciálně velká |
| `test_runs` | projekt, run cases, attempts | střední až velká |
| `test_run_cases` | run ↔ test case, obsahuje JSON snapshot | velká, read/write |
| `test_run_attempts` | historie full rerunů | append-heavy |
| `test_run_case_attempts` | historie výsledků jednotlivých cases | velmi rychlý růst |
| `test_run_step_results` | výsledky kroků v case attemptu | nejrychlejší růst |
| `audit_events` | polymorfní audit, JSON změny | neomezený append |

JSON je použit pouze v:

- `test_run_cases.test_case_snapshot`,
- `audit_events.changes`.

Ani jeden JSON sloupec se podle zdrojového kódu nepoužívá v `WHERE`, `JOIN` nebo `ORDER BY`.

# Critical Tables

Kvalitativní hodnocení vychází ze vztahového fan-outu, nikoliv z produkčních statistik.

| Tabulka | Velikost | Read | Write | Query složitost | Indexy | Contention/růst | Riziko |
|---|---:|---:|---:|---:|---:|---:|---|
| `test_run_step_results` | velmi vysoká | vysoké | vysoké | střední | překryvy | vysoký růst | CRITICAL |
| `test_run_case_attempts` | vysoká | vysoké | vysoké | vysoká | překryvy | concurrency | CRITICAL |
| `test_run_cases` | vysoká | velmi vysoké | střední | vysoká | chybí invarianty | sdílený summary stav | CRITICAL |
| `audit_events` | vysoká | střední | vysoké | nízká | chybí časové indexy | bez retention | HIGH |
| `test_cases` | vysoká | velmi vysoké | střední | vysoká | pouze single-column | search scans | HIGH |
| `test_steps` | vysoká | vysoké | střední | nízká | chybí FK/order index | růst s cases | HIGH |
| `test_runs` | střední | vysoké | střední | vysoká | chybí sort index | sdílené updates | HIGH |
| `requirement_test_cases` | střední | vysoké | nízké | střední | chybí reverse index | M:N růst | MEDIUM |
| `test_suites` | střední | vysoké | nízké | stromové operace | částečné | recursive updates | MEDIUM |
| `requirements` | střední | vysoké | nízké | N+1 okolí | dobré | lineární růst | MEDIUM |
| `projects` | nízká | vysoké | nízké | nízká | dostatečné | malé | LOW |
| `users` | nízká | střední | nízké | nízká | dostatečné | malé | LOW |
| `test_case_tags` | nízká | vysoké | nízké | nízká | překryv | malé | LOW |

# Critical Findings

## 1. Databáze dovoluje duplicitní test case v runu

- Finding: chybí unikátnost `(test_run_id, test_case_id)`.
- Location: `backend/app/models/test_run_case.py:12`, `backend/app/services/test_runs.py:286`.
- Evidence: duplicita se kontroluje pouze `SELECT` před insertem. Dva souběžné requesty mohou oba projít.
- Impact: duplicitní execution položky, nesprávné agregace a historie.
- Proposed change: DB unique constraint a mapování konfliktu na HTTP `409`.
- Tradeoff: nejdřív je nutné najít a vyřešit existující duplicity.
- Validation: PostgreSQL concurrency test se dvěma současnými inserty.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 2. Individuální rerun má race condition

- Finding: číslo nového case attemptu je vypočítáno bez zámku.
- Location: `backend/app/services/test_runs.py:428`.
- Evidence: dvě transakce mohou přečíst stejné maximum a vložit stejné `attempt_number`. Constraint zabrání nekonzistenci, ale jedna operace skončí neodchyceným `IntegrityError`.
- Impact: HTTP 500 při souběžném resetu.
- Proposed change: zamknout příslušný `TestRunCase` nebo aktuální `TestRunAttempt`, případně konflikt převést na `409`.
- Tradeoff: krátká serializace operací pro jednu case.
- Validation: paralelní PostgreSQL integrační test.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 3. Traceability má N+1 a čte nesprávný zdroj historie

- Finding: pro každý requirement se provádí samostatný dotaz a načítají se všechny odpovídající run cases.
- Location: `backend/app/services/requirements.py:94`.
- Evidence: `_latest_run_cases_by_test_case()` je volána uvnitř smyčky a výsledek redukuje v Pythonu. Současně čte `TestRunCase.result`, který rerun resetuje.
- Impact: lineární počet dotazů, nadbytečné I/O a potenciálně nesprávná traceability.
- Proposed change: jeden set-based dotaz nad `TestRunCaseAttempt`, například `DISTINCT ON` nebo `row_number()`.
- Tradeoff: je nutné nejprve potvrdit definici „posledního výsledku“.
- Validation: query count test a `EXPLAIN (ANALYZE, BUFFERS)`.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 4. Listy test runs a execution načítají celé historické grafy

- Finding: list runů eager-loaduje run cases, všechny attempts a step results.
- Location: `backend/app/services/test_runs.py:20`, `backend/app/schemas/test_run.py:89`.
- Evidence: `TestRunListItem` je identický s plným `TestRunRead`.
- Další N+1: `latest_case_attempt` používá `item.test_run_attempt.attempt_number`, ale tento vztah není eager-loaded.
- Impact: rostoucí query count, DB paměť, aplikační paměť a objem response.
- Proposed change: samostatný `TestRunSummary` kontrakt s agregovanými počty; historii načítat samostatně nebo stránkovat.
- Tradeoff: změna API kontraktu a frontendu.
- Validation: SQLAlchemy query counter, response size a latency pro run s 100/1000 cases.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 5. Přesun suite do rootu může uložit nekonzistentní path

- Finding: `parent_suite_id: null` není správně odlišen od nezadané hodnoty.
- Location: `backend/app/services/test_suites.py:93`.
- Impact: `parent_suite_id`, `path` a `level` si mohou odporovat; následně selže podstromové vyhledávání a agregace.
- Proposed change: používat `model_fields_set`, serverově generovat `path/level` a přidat integritní kontrolu.
- Tradeoff: oprava existujících nekonzistentních cest může vyžadovat backfill.
- Validation: rekurzivní SQL kontrola parent/path/level.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 6. Migrační řada není testována na PostgreSQL

- Finding: testy vytvářejí aktuální metadata přímo na SQLite.
- Location: `backend/tests/conftest.py:21`, `backend/alembic/versions/0010_test_run_attempts.py:72`.
- Impact: PostgreSQL backfill, FK, constraint a locking problémy se mohou projevit až při deploymentu.
- Proposed change: CI PostgreSQL migration test z prázdné databáze i z fixture předchozí revize.
- Tradeoff: delší CI a správa testovací PostgreSQL služby.
- Validation: `alembic upgrade head`, kontrolní SQL a případně podporovaný downgrade.
- Priority: HIGH.
- Confidence: HIGH CONFIDENCE.

## 7. Bulk operace používají opakované flush

- Finding: přidání cases a rerun provádí `flush()` pro každý run case a každý case attempt.
- Location: `backend/app/services/test_runs.py:255`, `backend/app/services/test_runs.py:575`.
- Impact: přibližně `2 × C` extra databázových round-tripů při vytvoření runu.
- Proposed change: vložit všechny run cases, jednou flushnout, následně dávkově vložit attempts a step results.
- Tradeoff: složitější mapování nových ID; větší jednorázová transakce.
- Validation: měřit statement count a dobu vytvoření runu pro 100/1000 cases.
- Priority: MEDIUM/HIGH.
- Confidence: HIGH CONFIDENCE.

# Index Audit

## ADD

Následující změny jsou návrhy, nikoliv provedené SQL.

### Vysoká důvěra po kontrole existujících dat

```sql
-- Současně zajišťuje FK lookup i pořadí kroků.
CREATE UNIQUE INDEX CONCURRENTLY uq_test_steps_case_order
    ON test_steps (test_case_id, step_order);

-- Zajištění jednoho test case v jednom runu.
CREATE UNIQUE INDEX CONCURRENTLY uq_test_run_cases_run_case
    ON test_run_cases (test_run_id, test_case_id);

-- Reverse lookup M:N tabulky a efektivnější delete test case.
CREATE INDEX CONCURRENTLY idx_requirement_test_cases_case_requirement
    ON requirement_test_cases (test_case_id, requirement_id);

-- Traceability a kontrola FK test_cases -> run cases.
CREATE INDEX CONCURRENTLY idx_test_run_cases_test_case_id
    ON test_run_cases (test_case_id);
```

Přínos: vysoký pro integritu a konkrétní query family.
Cena: jeden B-tree zápis na insert/update; unikátní indexy mohou selhat na existujících duplicitách.

### Pravděpodobně přínosné, ale ověřit přes EXPLAIN

```sql
-- Defaultní list a keyset pagination test runů.
CREATE INDEX CONCURRENTLY idx_test_runs_project_created_id
    ON test_runs (project_id, created_at DESC, id DESC);

-- Globální audit stream.
CREATE INDEX CONCURRENTLY idx_audit_events_created_id
    ON audit_events (created_at DESC, id DESC);

-- Historie konkrétní entity.
CREATE INDEX CONCURRENTLY idx_audit_events_entity_created_id
    ON audit_events (entity_type, entity_id, created_at DESC, id DESC);

-- Přímí potomci suite ve zobrazovaném pořadí.
CREATE INDEX CONCURRENTLY idx_test_suites_parent_order
    ON test_suites (parent_suite_id, sort_order, name, id);

-- Kompletní strom projektu.
CREATE INDEX CONCURRENTLY idx_test_suites_project_path_order
    ON test_suites (project_id, path, sort_order, name, id);
```

U těchto indexů je přínos přímo podložen query strukturou, ale praktická hodnota závisí na cardinalitě.

### Podmíněné search indexy

Současné repository hledání používá `LOWER(...) LIKE '%text%'`, takže běžné B-tree indexy nepomohou.

Možná strategie:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY idx_test_cases_search_trgm
ON test_cases USING gin (
    (
        lower(
            code || ' ' || title || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(preconditions, '')
        )
    ) gin_trgm_ops
);

CREATE INDEX CONCURRENTLY idx_test_suites_search_trgm
ON test_suites USING gin (
    (
        lower(
            name || ' ' || path || ' ' || coalesce(description, '')
        )
    ) gin_trgm_ops
);
```

Query musí používat přesně stejný výraz. Tagy a suite path připojované přes JOIN vyžadují samostatné řešení. GIN indexy mají významnou storage a write cenu, proto je nepřidávat bez `EXPLAIN` a reálné cardinality.

Confidence: HYPOTHESIS.

### Case-insensitive tag uniqueness

Service vrstva považuje názvy tagů za case-insensitive, databáze nikoliv.

```sql
CREATE UNIQUE INDEX CONCURRENTLY uq_test_case_tags_category_lower_name
    ON test_case_tags (category, lower(name));
```

Před vytvořením je nutné najít kolize typu `Karty`/`karty`.

## MODIFY / REPLACE

- `idx_test_run_cases_test_run_id` může být po zavedení unikátního `(test_run_id, test_case_id)` nadbytečný.
- `idx_test_suites_project_id` a `idx_test_suites_path` mohou být částečně nahrazeny kompozitním project/path indexem.
- Globální unikátnost `test_cases.code` je potvrzené business pravidlo. Stávající unique constraint zachovat a nenahrazovat jej `(project_id, code)`.
- Unique index case attempts by mohl být fyzicky řazen jako `(test_run_attempt_id, test_run_case_id, attempt_number DESC)`, ale praktický přínos je nutné ověřit.

## POSSIBLE REMOVAL

Migrace vytvářejí několik single-column indexů překrytých levým prefixem unikátního indexu:

- `idx_requirements_project_id`,
- `idx_test_case_tags_category`,
- `idx_test_run_attempts_test_run_id`,
- `idx_test_run_case_attempts_attempt_id`,
- `idx_test_run_step_results_case_attempt_id`.

Nejde automaticky o bezpečné odstranění: užší index může být menší a planner jej může preferovat. Před rozhodnutím jsou nutné `pg_stat_user_indexes`, velikosti indexů a EXPLAIN klíčových dotazů.

# Query Audit

## N+1

1. Traceability: `get_traceability_matrix()` → smyčka requirements → `_latest_run_cases_by_test_case()`.
2. Suite test cases: `get_suite_test_cases()` načte pouze cases. `TestCaseRead` potom lazy-loaduje steps a tagové vztahy.
3. Test run list/detail: `TestRunCase.latest_case_attempt` lazy-loaduje `TestRunCaseAttempt.test_run_attempt` pro serialization.
4. Requirements: seznam eager-loaduje steps, ale ne tagové vztahy, které `TestCaseRead` obsahuje.
5. Update suite: `_is_descendant()` čte každý ancestor zvlášť a `_update_descendant_paths()` každý level podstromu samostatným dotazem.

## Redundant queries

- `list_attempts()` nejprve volá plný `get_test_run()` včetně všech case attempts a step results, následně provede samostatný dotaz na attempts.
- `update_result()` po commitu načte celý test run, jen aby vrátil jeden run case.
- Create/rerun endpointy vracejí kompletní execution graf, který frontend často zahodí a okamžitě znovu načte.
- Legacy `search_suites()` načte všechny suity a počty a filtruje v Pythonu.

## Over-fetching

- `list_test_cases()` nemá pagination a načítá všechny TEXT sloupce, kroky a tagové relace.
- `list_test_runs()` načítá kompletní attempt/step historii.
- `list_requirements()` načítá kompletní TestCase včetně steps.
- `get_execution()` vždy načte všechny run attempts a sestaví historii všech case attempts, i když uživatel pracuje pouze s aktuálním pokusem.
- JSON snapshot je vracen společně s živým `TestCaseRead`, přestože frontend běžně používá snapshot.

## Expensive structures

- leading-wildcard search přes více `LOWER(COALESCE(...))`,
- OR přes několik textových sloupců a JOIN tabulek,
- traceability načítá všechny historické kandidáty místo posledního řádku,
- `_latest_case_attempts()` načítá všechny case reruny na každé uložení výsledku,
- dashboard agreguje všechny aktuální `test_run_cases` projektu při každém načtení.

U dashboardu zatím není důvod zavádět materialized view; nejprve jsou potřeba call rate a EXPLAIN.

# Pagination Audit

OFFSET/LIMIT používají pouze projekty, test runy a audit. `offset` nemá horní limit.

Současné řazení není deterministické:

- projekty pouze `name`,
- test runy pouze `created_at`,
- audit pouze `created_at`.

Doporučené keyset cursory:

```sql
-- Test runs
WHERE project_id = :project_id
  AND (created_at, id) < (:created_at, :id)
ORDER BY created_at DESC, id DESC
LIMIT :limit;

-- Audit
WHERE (created_at, id) < (:created_at, :id)
ORDER BY created_at DESC, id DESC
LIMIT :limit;

-- Projects
WHERE (name, id) > (:name, :id)
ORDER BY name ASC, id ASC
LIMIT :limit;
```

Keyset pagination má význam hlavně při hlubších stránkách. Pro malé tabulky lze OFFSET zachovat, ale sekundární `id` řazení doplnit vždy.

Test cases, suites a requirements nemají pagination vůbec.

# Table Design Issues

- Status, requirement priority, result, role, tag category a step type jsou validovány pouze Pydanticem. DB nemá `CHECK` constrainty.
- `test_steps` nemá DB unikátnost pořadí ani index na FK.
- `test_run_cases` nemá unikátnost run/case.
- `requirement_test_cases` postrádá reverse index a `ON DELETE CASCADE`.
- `test_run_step_results` ukládá zároveň `test_run_case_attempt_id` i odvoditelné `test_run_case_id`. To šetří JOIN, ale dovoluje, aby oba odkazy ukazovaly na různé run cases.
- `TestRunCase.result/comment/executed_*` duplikuje stav attempts. Je nutné jasně definovat, zda jde o summary aktuálního attemptu, nebo poslední historický výsledek.
- `test_case_snapshot` kopíruje celý test case pro každý run case. Je to oprávněná historická denormalizace, ale při 100× růstu může dominovat storage.
- `updated_at` se aktualizuje přes SQLAlchemy `onupdate`; databáze nemá trigger. Raw SQL update timestamp automaticky nezmění.
- `test_suites.path` je dlouhý denormalizovaný string. B-tree index na až 1000 vícebytových znaků může při extrémních hodnotách narazit na limit velikosti index entry.
- `test_run_step_results.test_step_id` a `test_run_attempts.last_step_id` nemají FK. Vzhledem k historickým snapshotům je to pravděpodobně záměr a FK se nemá automaticky přidávat.
- BIGINT primární klíče jsou širší, než MVP potřebuje, ale změna nepřináší dostatečný užitek vzhledem k migračnímu riziku.

# Transaction and Concurrency Risks

- `add_test_cases()` používá check-then-insert bez unique constraintu.
- `create_case_rerun()` používá check-then-insert bez zámku.
- `create_test_run()` volá `add_test_cases()`, která provede vlastní commit. Transakční vlastnictví je smíšené a nadřazená operace není plně atomická.
- `update_result()` aktualizuje run case, attempt a run. Explicitní lock dokončovaného attemptu chybí.
- Současné ukládání posledních výsledků pravděpodobně částečně serializuje PostgreSQL přes update stejného attempt řádku, ale invariant dokončení není v kódu explicitně zajištěný. Vyžaduje concurrency test.
- Full rerun zamyká `TestRun` přes `FOR UPDATE`, individuální rerun ne.
- `last_test_run_case_id` je hot row hodnota sdílená všemi testery jednoho runu; poslední writer vítězí.
- Chybí `lock_timeout`, `statement_timeout`, retry strategie a optimistic versioning.
- Nejsou volány externí API uvnitř DB transakcí.

# Scaling Risks

## Při 10× datech

- traceability N+1 a Python redukce budou viditelné,
- repository search přejde na sekvenční scan,
- list test cases a requirements vytvoří velké response,
- list test runs bude neúměrně načítat historii,
- chybějící index `test_steps(test_case_id, step_order)` bude zatěžovat eager loading,
- hlubší OFFSET pagination začne růst lineárně.

## Při 100× datech

- `test_run_step_results`, `test_run_case_attempts` a `audit_events` budou dominantní velikostí,
- audit bez retention zvýší nároky na vacuum, backup a restore,
- opakované JSON snapshots mohou být hlavní storage položkou,
- dashboardové agregace přes všechny run cases mohou vyžadovat cache nebo preagregaci,
- GIN indexy pro search mohou mít významnou write/storage cenu,
- bude nutné vyhodnotit archivaci historických runů a auditů,
- partitioning může být relevantní až podle velikostí, retention požadavků a maintenance problémů.

# Recommended Optimizations

| Pořadí | Doporučení | Impact | Effort | Risk |
|---:|---|---|---|---|
| 1 | PostgreSQL migration a concurrency testy | HIGH | MEDIUM | LOW |
| 2 | Unique run/case a unique step order | HIGH | MEDIUM | MEDIUM |
| 3 | Opravit traceability na set-based query nad attempts | HIGH | MEDIUM | MEDIUM |
| 4 | Oddělit list summary od execution historie | HIGH | MEDIUM | MEDIUM |
| 5 | Přidat test run/audit/FK indexy podle EXPLAIN | HIGH | LOW | LOW |
| 6 | Dávkovat create run a rerun inserty | MEDIUM/HIGH | MEDIUM | MEDIUM |
| 7 | Zavést deterministickou a následně keyset pagination | MEDIUM | MEDIUM | LOW |
| 8 | Opravit suite path/level integritu | HIGH | MEDIUM | MEDIUM |
| 9 | Zavést case-insensitive tag constraint a stavové CHECK | MEDIUM | MEDIUM | MEDIUM |
| 10 | Search GIN/trigram pouze po měření | HIGH při velkých datech | MEDIUM | MEDIUM |
| 11 | Retention/archive strategie | HIGH při 100× | HIGH | HIGH |
| 12 | Dedup snapshots do version tabulky | potenciálně HIGH | HIGH | HIGH |

# Recommended Schema Changes

1. Přidat unikátnost run/case a test case/step order.
2. Přidat `CHECK` constrainty pro konečné množiny statusů a výsledků; preferovat VARCHAR + CHECK před PostgreSQL ENUM kvůli jednodušším migracím.
3. Zvážit `ON DELETE CASCADE` pro čistou junction tabulku `requirement_test_cases`.
4. Zachovat globální unikátnost kódů test cases napříč projekty.
5. Opravit nebo serverově zcela vlastnit suite `path` a `level`.
6. Při velkém objemu zvážit `test_case_versions` a jeden snapshot na `(test_case_id, version)` místo kopie pro každý run case.
7. Při velkém objemu zvážit odstranění redundantního `test_run_step_results.test_run_case_id`; aktuální odstranění run case by pak používalo JOIN přes case attempt.
8. Nepřidávat FK na historické `test_step_id`, dokud nebude vyřešeno zachování smazaných kroků.

# Profiling Required

Statická analýza nedokazuje aktuální pomalost. Před optimalizací je potřeba získat:

- `SHOW server_version`;
- `pg_stat_user_tables`: live/dead tuples, seq scans, vacuum;
- `pg_stat_user_indexes`: `idx_scan`, velikost a poměr vůči tabulce;
- `pg_stat_statements`: calls, total/mean/max time, rows, temp I/O;
- `pg_total_relation_size()` pro všechny tabulky a indexy;
- aplikační p50/p95/p99 latence a response size;
- počet DB spojení na worker a pool checkout wait;
- `pg_locks`/`pg_stat_activity` při souběžné execution;
- cardinality cases/run, steps/case, reruns/run a audit events/den;
- retention požadavky a očekávanou délku historie.

`EXPLAIN (ANALYZE, BUFFERS)` je potřeba minimálně pro:

1. repository search s běžným a vzácným dotazem,
2. list test runs s/bez statusu a environmentu,
3. audit global a entity history,
4. traceability,
5. suite counts,
6. dashboard result aggregation,
7. načtení step results jednoho attemptu,
8. deep OFFSET stránky.

# Things NOT to Optimize

- Neměnit BIGINT primární klíče.
- Nepřecházet kvůli databázi automaticky na async SQLAlchemy.
- Nepřidávat index na každý FK uživatele; uživatelé se nemažou a nejsou podle nich filtrovány hlavní workflow.
- Nepřevádět VARCHAR statusy na native PostgreSQL ENUM.
- Nepřidávat GIN indexy na JSON; JSON se v dotazech nefiltruje.
- Neměnit JSON na JSONB bez konkrétní query potřeby.
- Nezavádět materialized views pro dashboard bez měření call rate.
- Nezavádět partitioning bez velikostí, retention a důkazu maintenance problému.
- Neodstraňovat test case snapshots; zajišťují historickou reprodukovatelnost.
- Neodstraňovat překrývající indexy bez statistik použití.
- Nezavádět read repliky nebo cache pro současný MVP bez load testu.

# Implementation Plan

1. Získat produkční statistiky a bezpečnou anonymizovanou kopii databáze.
2. Ověřit restore zálohy a celou Alembic řadu.
3. Přidat PostgreSQL migration a concurrency CI testy.
4. Spustit preflight SQL na duplicity a neplatné statusy.
5. Přidat nízkorizikové indexy pomocí `CREATE INDEX CONCURRENTLY`; v Alembicu použít autocommit blok.
6. Nastavit krátký `lock_timeout` pro DDL a sledovat progress index buildů.
7. Přidat unique constrainty až po vyčištění dat.
8. Přepsat traceability a ověřit výstupy proti současným business očekáváním.
9. Zavést lehké list kontrakty a odstranit N+1.
10. Dávkovat inserty create run/rerun.
11. Doplnit deterministické řazení a keyset pagination.
12. Znovu změřit query latency, buffers, počet statements a velikost responses.
13. Teprve podle výsledků rozhodnout o trigram indexech, retention, preagregaci nebo snapshot deduplikaci.

Rollback:

- nové non-unique indexy lze odstranit `DROP INDEX CONCURRENTLY`,
- před unique constraintem uchovat report opravených duplicit,
- query změny nasadit odděleně od DDL,
- destruktivní migrace nepovažovat za rollback strategii; používat ověřený restore,
- po každém kroku porovnat výsledky, row counts a latency.

Implementace zbývajících nálezů nebyla v rámci tohoto auditu zahájena a vyžaduje samostatné potvrzení.
