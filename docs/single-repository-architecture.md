# Jedno globální repository bez projektů

Aktualizováno: 2026-08-24

## Rozhodnutí

Test Manager používá jedno společné repository. Entita `Project`, stránka Projekty,
výběr aktivního projektu, projektové API a sloupce `project_id` byly odstraněny.
Testovací běhy se spravují samostatně přes Test Runs.

## Dopad na aplikaci

- Test suites, test cases, requirements, dashboard a repository search jsou globální.
- Test runs vybírají test cases přímo ze společného repository.
- Kódy test cases a requirements jsou globálně unikátní.
- Uživatelské preference pohledu a oblíbených suit se ukládají jednou pro celé repository.
- UI neobsahuje projektovou navigaci, formulář ani kontext.

## API

Kolekce používají přímé endpointy:

- `GET|POST /api/test-suites`
- `GET|POST /api/test-cases`
- `GET|POST /api/test-runs`
- `GET|POST /api/requirements`
- `GET /api/traceability`
- `GET /api/dashboard`
- `GET /api/repository/search`

Endpoint `/api/projects` ani cesty `/api/projects/{project_id}/...` neexistují.

## Databázová migrace

Migrace `0014_remove_projects`:

1. zachová všechny suity, test cases, test runs a requirements;
2. upraví případné duplicitní requirement kódy z různých původních projektů;
3. odstraní `project_id` z pracovních tabulek;
4. odstraní tabulku `projects`.

Downgrade je podporovaný. Obnoví tabulku `projects`, vytvoří jeden technický projekt
`Repository` s kódem `REPO` a přiřadí mu všechna pracovní data.

## Návrat změny

Databázi lze vrátit příkazem:

```bash
alembic downgrade 0013_remove_test_case_type
```

Samotný downgrade obnoví databázovou strukturu, ne staré frontendové obrazovky a API.
Pro úplný návrat by bylo nutné zároveň vrátit aplikační commit.
