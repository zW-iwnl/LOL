# Codex prompty pro Test Manager aplikaci

## PROMPT 1 - Vytvoření skeleton projektu

Vytvoř základní monorepo projekt pro aplikaci Test Manager podle souboru AGENTS.md.

Požadavky:
1. Vytvoř backend ve FastAPI ve složce backend.
2. Vytvoř frontend v React + TypeScript + Vite ve složce frontend.
3. Uprav docker-compose.yml pro PostgreSQL, backend a frontend.
4. Doplň .env.example.
5. Doplň README.md s instrukcemi pro lokální spuštění.
6. Backend musí mít základní strukturu:
   - app/main.py
   - app/core/config.py
   - app/core/database.py
   - app/models
   - app/schemas
   - app/api
   - app/services
7. Frontend musí mít základní strukturu:
   - src/api
   - src/components
   - src/pages
   - src/App.tsx
8. Připrav základní stránky:
   - DashboardPage
   - ProjectsPage
   - TestSuitesPage
   - TestCasesPage
   - TestRunsPage
   - DefectsPage
9. Přidej základní routing ve frontendu.
10. Nepřidávej složitou business logiku zatím.
11. Po dokončení vypiš, jak projekt spustit.

## PROMPT 2 - Databáze a modely

Doplň backend databázový model podle docs/database-model.md.

Požadavky:
1. Použij SQLAlchemy.
2. Vytvoř modely:
   - User
   - Project
   - TestSuite
   - TestCase
   - TestStep
   - TestRun
   - TestRunCase
   - Defect
3. Nastav vztahy mezi modely.
4. Přidej created_at a updated_at.
5. Přidej Alembic migrace.
6. Vytvoř první migraci pro všechny tabulky.
7. Přidej indexy:
   - test_suites.project_id
   - test_suites.parent_suite_id
   - test_suites.path
   - test_cases.project_id
   - test_cases.suite_id
   - test_runs.project_id
   - test_run_cases.test_run_id
8. Přidej seed script s demo daty:
   - jeden admin user
   - projekt E-shop
   - test suity Backend API, Authentication API, Checkout
   - několik test cases
   - jeden test run

## PROMPT 3 - Backend API

Implementuj REST API podle docs/api-spec.md.

Priorita MVP:
1. Projects CRUD
2. Test Suites CRUD
3. Test Suite tree endpoint
4. Test Suite search endpoint
5. Test Cases CRUD
6. Test Steps CRUD v rámci test case
7. Test Runs CRUD
8. Přidání test cases do test runu
9. Execution endpoint pro uložení výsledku test_run_case
10. Defects CRUD
11. Dashboard endpoint

Pravidla:
- Použij Pydantic schemas.
- Použij services vrstvu pro business logiku.
- Endpointy mají vracet JSON.
- Přidej základní validace.
- Přidej OpenAPI tagy.
- Zatím můžeš auth zjednodušit, ale připrav strukturu pro JWT.

## PROMPT 4 - Frontend UI

Vytvoř frontend UI pro Test Manager aplikaci.

Požadavky:
1. Použij React + TypeScript.
2. Použij Tailwind CSS.
3. Vytvoř layout:
   - levý sidebar
   - horní topbar
   - hlavní obsah
4. Sidebar položky:
   - Dashboard
   - Projekty
   - Test Suity
   - Test Cases
   - Test Runs
   - Defects
   - Reporty
   - Nastavení
5. Dashboard stránka:
   - KPI karty: Počet test cases, Aktivní test runy, Pass rate, Otevřené defecty
   - tabulka posledních test runů
   - panel výsledků testů
   - rychlé akce
6. Test Suites stránka:
   - strom test suites vlevo
   - search input
   - seznam test cases ve vybrané suitě
   - formulář pro vytvoření/editaci test suite
7. Test Cases stránka:
   - tabulka test cases
   - filtry podle priority, status, suite
   - tlačítko Nový test case
8. Test Case detail:
   - metadata
   - preconditions
   - steps
   - expected result
9. Test Runs stránka:
   - seznam test runů
   - detail test runu
10. Execution stránka:
   - test case detail
   - kroky
   - tlačítka Passed, Failed, Blocked, Skipped
   - komentář
11. Použij mock data, pokud API ještě není hotové.
12. UI texty česky.

## PROMPT 5 - Propojení frontendu s backendem

Propoj frontend s backend API.

Požadavky:
1. Vytvoř API klienta v frontend/src/api/client.ts.
2. Použij fetch nebo axios.
3. Přidej funkce:
   - getProjects
   - getDashboard
   - getTestSuites
   - searchTestSuites
   - getTestCases
   - createTestCase
   - getTestRuns
   - updateTestRunCaseResult
   - createDefect
4. Nahraď mock data reálnými daty z backendu.
5. Přidej loading a error stavy.
6. Zachovej jednoduchý a čistý kód.

## PROMPT 6 - Test execution workflow

Implementuj kompletní workflow pro provedení testu.

Scénář:
1. Uživatel otevře Test Run.
2. Vidí seznam přiřazených test cases.
3. Klikne na test case.
4. Vidí kroky testu.
5. Vybere výsledek:
   - passed
   - failed
   - blocked
   - skipped
6. Přidá komentář.
7. U failed výsledku může rovnou založit defect.
8. Dashboard se po uložení výsledku aktualizuje.

Backend:
- endpoint PUT /api/test-run-cases/{id}/result
- pokud result = failed a je vyplněný defect payload, vytvoř defect
- aktualizuj executed_by a executed_at

Frontend:
- execution detail stránka
- tlačítka výsledků
- komentářové pole
- modal/form pro defect u failed
