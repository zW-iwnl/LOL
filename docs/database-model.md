# Databázový model PostgreSQL

Aktualizováno: 2026-08-25

Zdrojem pravdy jsou SQLAlchemy modely v `backend/app/models` a Alembic migrace `0001` až `0018`. Aplikace používá PostgreSQL 16 a jedno globální repository.

## Aktivní tabulky

| Tabulka | Účel | Hlavní integritní pravidla |
|---|---|---|
| `users` | uživatelé a přihlášení | unikátní `email` |
| `test_suites` | strom test suit | FK na rodičovskou suitu |
| `test_case_tags` | číselníky business area, application domain a object type | unikátní `(category, name)` |
| `test_case_tag_assignments` | M:N vazba test cases na tagy | složený primární klíč `(test_case_id, tag_id)` |
| `test_cases` | definice test case | unikátní `code`, volitelný FK na suitu |
| `suite_groups` | víceúrovňové skupiny suit | volitelný self-FK `parent_group_id` |
| `suite_group_members` | M:N vazba skupin a suit | složený primární klíč |
| `suite_group_test_case_members` | explicitní M:N výběr test cases ve skupinách | složený primární klíč |
| `test_steps` | kroky test case | FK na test case |
| `requirements` | požadavky | globálně unikátní `code` |
| `requirement_test_cases` | vazba M:N mezi requirementy a test case | složený primární klíč |
| `test_runs` | testovací běhy | vazby na test cases přes `test_run_cases` |
| `test_run_cases` | snapshot test case vložený do runu a aktuální stav | FK na run a zdrojový test case |
| `test_run_attempts` | historie rerunů celého runu | unikátní `(test_run_id, attempt_number)` |
| `test_run_case_attempts` | historie resetů/rerunů jednotlivých test case | unikátní `(test_run_attempt_id, test_run_case_id, attempt_number)` |
| `test_run_step_results` | výsledky kroků v konkrétním pokusu test case | unikátní `(test_run_case_attempt_id, test_step_id)` |

## Co je navrženo dobře

- Historie celého runu a jednotlivých test case je oddělená a staré výsledky se nepřepisují.
- Kombinované unikátní klíče chrání číslování rerunů a duplicitní výsledek kroku.
- Historické tabulky používají `ON DELETE CASCADE`, takže odstranění nadřazeného execution záznamu nezanechá sirotky.
- Test run case ukládá JSON snapshot verze test case, takže změny zdrojového test case nepoškodí historii.
- Časy jsou ukládány jako timezone-aware timestampy.
- Nejčastější jednoduché FK filtry mají základní indexy.

## Doporučená zlepšení

### P0 – integrita a souběh

1. Zamykat aktuální `test_run_attempt` nebo `test_run_case_attempt` pomocí `SELECT ... FOR UPDATE` také při resetu jednoho test case. Dva souběžné resety nyní mohou vypočítat stejné `attempt_number`; unikátní klíč data ochrání, ale jeden request skončí chybou 500 místo řízeného konfliktu.
2. Přidat unikátní klíč `(test_run_id, test_case_id)` na `test_run_cases`. Aplikace duplicitu kontroluje, ale souběžné requesty ji mohou obejít.
3. Doplnit databázové omezení povolených hodnot `test_case_tags.category`; při filtrování podle konkrétní kategorie ji kontroluje aplikační služba.
4. Přidat `CHECK` omezení pro `status`, `result`, `requirements.priority`, `attempt_number >= 1`, `version >= 1`, `step_order >= 0` a `level >= 0`. Aktuálně databáze přijme libovolný text.
5. Vyřešit case-insensitive unikátnost pomocí `citext` nebo unikátního indexu nad `lower(...)`, hlavně pro email, kódy a názvy číselníků. Aplikační kontrola sama nechrání proti souběhu.

### P1 – výkon

1. Execution API nyní načítá historii všech case attempts a všech step results při každém otevření nebo uložení. Historii načítat lazy pouze pro vybraný test case, případně stránkovat.
2. List test runů nenačítat s kompletní historií kroků. Pro seznam stačí agregované počty a aktuální stav; detail se má načíst samostatně.
3. Doplnit indexy odpovídající skutečným dotazům:
   - `test_runs (created_at DESC)`
   - `test_runs (status)`
   - `test_suites (path, sort_order, name)`
   - `test_suites (parent_suite_id, sort_order, name)`
   - `test_steps (test_case_id, step_order)`; ideálně unikátní
   - `test_run_cases (test_case_id, executed_at DESC, updated_at DESC)` s partial podmínkou `result <> 'not_run'`
   - `requirement_test_cases (test_case_id, requirement_id)` pro dotazy opačným směrem
4. Pro hledání přes `ILIKE '%text%'` zvážit PostgreSQL `pg_trgm` a GIN indexy nad názvy suit, kódy/názvy test cases a názvy test runů.

### P2 – zjednodušení a údržba

1. Odstranit redundantní indexy, které už pokrývá levý prefix unikátního indexu:
   - `idx_test_case_tags_category`
   - `idx_test_run_attempts_test_run_id`
   - `idx_test_run_case_attempts_attempt_id`
   - `idx_test_run_step_results_case_attempt_id`
2. Po backfillu odstranit server default `1` ze sloupce `test_run_case_attempts.attempt_number`, aby každý nový pokus musel číslo zadat explicitně.
3. Zvážit `JSONB` pro `test_case_snapshot`, pokud se v něm bude filtrovat nebo indexovat. Pokud jde pouze o uložený snapshot, současné `JSON` je přijatelné.
4. `updated_at` je aktualizováno přes ORM. Pokud se bude zapisovat také přímým SQL, přidat databázový trigger.
5. U hierarchie suit zvážit PostgreSQL `ltree`, pokud počet suit a přesuny celých podstromů výrazně narostou.

## Důležité návrhové poznámky

- `test_run_step_results.test_step_id` a `test_run_attempts.last_step_id` nemají FK záměrně: historie musí přežít změnu nebo smazání zdrojového kroku. Tento záměr je potřeba zachovat a testovat.
- `test_run_cases` drží denormalizovaný aktuální výsledek pro dashboard. Je nutné dál hlídat, aby každá změna/reset synchronizovala cache s posledním case attemptem.
- Kódy `test_cases.code` a `requirements.code` jsou v jediném repository globálně unikátní.

## Doporučené pořadí realizace

1. Migrace integritních pravidel a ochrana souběžného resetu.
2. Lazy načítání historie a lehký endpoint pro seznam test runů.
3. Přidání chybějících složených indexů podle `EXPLAIN ANALYZE`.
4. Odstranění redundantních indexů až po kontrole `pg_stat_user_indexes`.
5. Teprve podle objemu dat řešit trigramy, JSONB a `ltree`.

## Produkční ověření

Před odstraněním nebo přidáním indexů zkontrolovat reálné statistiky:

```sql
SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
ORDER BY relname, idx_scan DESC;
```

Pro pomalé endpointy použít `EXPLAIN (ANALYZE, BUFFERS)` nad konkrétním SQL z PostgreSQL logu. Indexy se nemají přidávat pouze podle teorie bez kontroly skutečných plánů a objemu dat.
