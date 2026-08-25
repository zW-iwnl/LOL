# Project Analysis & Optimization Audit

Datum auditu: 2026-08-21
Projekt: Test Manager / FET
Rozsah: aktuální pracovní strom repozitáře

Audit byl proveden podle dokumentu `Codex CLI – Project Analysis & Optimization Prompt.md`. Během auditu nebyl změněn aplikační kód ani databáze.

## Shrnutí

Aktuální pracovní strom stále není připravený k bezpečnému nasazení kvůli závažným problémům konzistence, výkonu a oprávnění.

Základní rozdělení backendu je pro tuto velikost vhodné. Největší problémy nejsou ve zvoleném technologickém stacku, ale v transakční konzistenci a příliš objemných API kontraktech.

## Architektura

- Backend: synchronní FastAPI routy → services → SQLAlchemy → PostgreSQL.
- Frontend: React/TypeScript, vlastní `fetch` klient a jednoduchý `useApiResource`.
- Execution model používá snapshot test case, `TestRunAttempt`, `TestRunCaseAttempt` a výsledky kroků.
- Produkce běží přes Docker Compose, Nginx a Caddy; Alembic se spouští při startu backendu.
- Kritické cesty: přihlášení, repository, vytvoření test runu, execution/rerun, traceability a dashboard.

## Prioritizovaná zjištění

### 1. HIGH — Souběžné dokončení runu může selhat

- Umístění: `backend/app/services/test_runs.py:637`.
- Chování: dva testeři mohou současně uložit poslední dva výsledky. Každá transakce po `flush()` samostatně počítá zbývající `not_run` položky bez uzamčení attemptu.
- Dopad: oba requesty mohou vidět jeden nehotový případ a po commitu zůstane celý attempt trvale `in_progress`.
- Řešení: uzamknout `TestRunAttempt` přes `SELECT … FOR UPDATE`, dokončení vyhodnotit pod zámkem a přidat PostgreSQL concurrency test.
- Složitost: střední. Regresní riziko: střední.

### 2. HIGH — Traceability po rerunu používá nesprávnou historii

- Umístění: `backend/app/services/requirements.py:94`, `backend/app/services/test_runs.py:575`.
- Chování: traceability čte denormalizovaný `TestRunCase.result`. Rerun ho resetuje na `not_run`, přestože předchozí attempt obsahuje platný historický výsledek.
- Dopad: requirement může přestat být vykazován jako selhávající nebo otestovaný jen proto, že byl zahájen rerun.
- Řešení: definovat přesnou business semantiku a výsledek počítat z `TestRunCaseAttempt`, například z posledního provedeného výsledku nebo z aktuálního attemptu.
- Složitost: střední. Regresní riziko: střední.

### 3. HIGH — Traceability obsahuje N+1 dotazů

- Umístění: `backend/app/services/requirements.py:94`.
- Chování: pro každý requirement se samostatně načítají všechny dokončené run cases jeho testů a redukují se v Pythonu.
- Dopad: počet dotazů roste lineárně s requirements a objem načtených řádků s historií exekucí.
- Řešení: jeden SQL dotaz nad všemi relevantními test cases, ideálně pomocí window funkce `row_number()` nebo `DISTINCT ON`.
- Složitost: střední. Regresní riziko: nízké až střední.

### 4. HIGH — Přesun test suite do kořene poškodí strom

- Umístění: `backend/app/schemas/test_suite.py:20`, `backend/app/services/test_suites.py:93`.
- Chování: explicitní `parent_suite_id: null` nelze odlišit od nezadaného pole. Parent se nastaví na `NULL`, ale `path` a `level` se počítají podle původního rodiče.
- Dopad: nekonzistentní strom, špatné cesty, vyhledávání i počty podstromu.
- Řešení: rozhodovat podle `model_fields_set`/`exclude_unset`, serverově vlastnit `path` a `level` a přidat test přesunu child → root.
- Složitost: nízká až střední. Regresní riziko: nízké.

### 5. HIGH — Role existují, ale nejsou vynucovány

- Umístění: `backend/app/api/router.py:9`, `backend/app/models/user.py:15`.
- Chování: všechny chráněné routy vyžadují pouze přihlášeného uživatele. Tester může spravovat projekty, tagy, test cases, runy, uživatele i audit.
- Dopad: chybí ochrana citlivých a destruktivních operací.
- Řešení: vytvořit centrální RBAC dependency a matici oprávnění pro `admin`, `manager` a `tester`; přidat negativní API testy.
- Složitost: střední. Regresní riziko: střední.

### 6. HIGH — API přenáší zbytečně celé execution grafy

- Umístění: `backend/app/services/test_runs.py:20`, `backend/app/schemas/test_run.py:89`, `frontend/src/pages/TestRunsPage.tsx:225`.
- Chování: list runů načítá cases, všechny case attempts a step results. Frontend navíc provádí filtrovaný i nefiltrovaný request; bez filtrů jsou identické. Execution sestavuje historii vnořenou iterací přes run cases a všechny attempts.
- Dopad: velké payloady, rostoucí paměť a potenciálně kvadratické zpracování historie.
- Řešení: oddělit `TestRunSummary` od detailu, vracet agregované počty, historii stránkovat nebo načítat na vyžádání a indexovat attempts podle case jedním průchodem.
- Složitost: střední až vysoká. Regresní riziko: střední.

### 7. HIGH — Repository vyhledávání stále neřeší škálování celé stránky

- Umístění: `backend/app/services/repository_search.py:43`, `frontend/src/pages/TestCasesPage.tsx:102`.
- Chování: hledání používá `LOWER(...) LIKE '%dotaz%'` přes několik polí bez trigram/fulltext indexů. Repository stránka současně stále načítá všechny test cases včetně kroků a dvakrát stejné suity.
- Dopad: nové hledání je omezené na 20 výsledků, ale počáteční stránka dál čeká na kompletní dataset; při větším objemu budou databázové full scany.
- Řešení: stránkovaný lehký seznam, odstranit dvojí `getTestSuites`, načítat detail až po výběru a pro PostgreSQL přidat `pg_trgm`/GIN indexy podle reálných `EXPLAIN ANALYZE`.
- Složitost: střední. Regresní riziko: nízké až střední.

### 8. HIGH — Migrace nejsou testované na cílové databázi

- Umístění: `backend/tests/conftest.py:21`, `backend/alembic/versions/0010_test_run_attempts.py:1`.
- Chování: testy vytvářejí aktuální metadata na SQLite; nespouštějí Alembic historii ani PostgreSQL-specific backfill.
- Dopad: problémy s FK, constrainty, upgrade/downgrade nebo existujícími daty mohou projít až do deploymentu.
- Řešení: CI test s PostgreSQL: upgrade z čisté DB, upgrade z fixture předchozí verze, kontrola backfillu a downgrade pouze tam, kde má být podporován.
- Složitost: střední. Regresní riziko: nízké.

### 9. MEDIUM — Chybí databázové invarianty

- `TestRunCase` nemá unikátnost `(test_run_id, test_case_id)`: `backend/app/models/test_run_case.py:12`.
- `TestStep` nemá index na `test_case_id` ani unikátnost pořadí: `backend/app/models/test_step.py:8`.
- Stavové sloupce nemají DB `CHECK` constrainty.
- Globální unikátnost `TestCase.code` je potvrzené business pravidlo a má zůstat zachována: `backend/app/models/test_case.py:21`.
- Dopad: souběžné requesty mohou obejít aplikační kontroly; chyby skončí neodchyceným `IntegrityError`.
- Řešení: doplnit constrainty a mapovat konflikty na HTTP `409`.
- Složitost: střední. Regresní riziko: střední kvůli nutnému auditu existujících dat.

### 10. MEDIUM — Frontend má redundantní datové toky a přerostlé moduly

- `TestCasesPage.tsx` má 1086 řádků, `TestRunsPage.tsx` 881 a backendový `test_runs.py` 700.
- Mutation na execution zahodí objemnou response a znovu načte celý execution: `frontend/src/pages/ExecutionPage.tsx:227`.
- `useApiResource` nemá cache, abort ani deduplikaci: `frontend/src/api/hooks.tsx:10`.
- API klienti obsahují duplicitní typy a endpointy.
- Řešení: rozdělit stránky na feature komponenty/hooky, sjednotit API moduly a využít mutation response nebo cílenou invalidaci.
- Složitost: střední. Regresní riziko: střední.

### 11. MEDIUM/LOW — Bezpečnostní a provozní hygiena

- Login předvyplňuje známý administrátorský účet: `frontend/src/pages/LoginPage.tsx:11`.
- JWT je osm hodin v `localStorage`: `frontend/src/api/client.ts:217`; chybí CSP, rate limiting a revokace.
- `/health` neověřuje databázi: `backend/app/main.py:27`.
- Backend image obsahuje testovací závislosti a `.dockerignore` nevylučuje `.db` ani `.orig`.
- `package.json` používá všude `latest`: `frontend/package.json:13`.
- Doporučení: odstranit výchozí credentials, doplnit CSP a login throttling, oddělit readiness endpoint, runtime/test dependency groups a vyčistit artefakty.

## Stav testů a repozitáře

- Backend obsahuje 28 testů, ale běží jen na SQLite.
- Frontend má 3 Playwright smoke scénáře, žádné unit/component testy.
- Poslední dostupné ověření tohoto workspace: 28 backend testů prošlo a frontend build/typecheck prošel; Playwright nebyl spustitelný kvůli chybějící browser binary.
- Worktree obsahoval v době auditu 69 změněných sledovaných souborů, více nesledovaných migrací a `.orig` artefakty. Audit proto hodnotí pracovní strom, ne stabilní commit.

## Nejlepší pořadí oprav podle ROI

1. Opravit locking a konzistenci execution/rerun.
2. Opravit traceability a přesun suite do rootu.
3. Zavést PostgreSQL migration a concurrency testy.
4. Zeštíhlit list/execution API a odstranit duplicitní requesty.
5. Doplnit stránkování a search indexy podle měření.
6. Zavést RBAC a autentizační hardening.
7. Rozdělit přerostlé frontendové a service moduly.
8. Vyčistit závislosti a lokální artefakty.

## Co nyní neměnit

- FastAPI + synchronní SQLAlchemy jsou pro současný MVP přijatelné; přechod na async nepřinese nejlepší ROI.
- Zachovat snapshot test case a verzovanou historii attempts.
- Zachovat service vrstvu a `selectinload` tam, kde endpoint skutečně potřebuje celý detail.
- Zachovat Caddy/Nginx topologii a pre-deployment backup; doplnit hlavně ověřování obnovy a retention.
- Zachovat nový repository search kontrakt a ochranu frontendu proti zastaralým odpovědím.

## Navržený implementační plán

1. Připravit bezpečný migrační a zálohovací postup.
2. Opravit transakční konzistenci execution a rerun operací.
3. Opravit traceability a strom test suites.
4. Doplnit PostgreSQL integrační a concurrency testy.
5. Zeštíhlit API kontrakty a odstranit redundantní requesty.
6. Změřit vyhledávání pomocí `EXPLAIN ANALYZE` a následně doplnit indexy a stránkování.
7. Zavést RBAC a bezpečnostní hardening.
8. Refaktorovat přerostlé moduly a uklidit závislosti a artefakty.

Implementace zbývajících nálezů nebyla v rámci tohoto auditu zahájena a vyžaduje samostatné potvrzení.
