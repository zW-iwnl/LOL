# AGENTS.md

## Projekt
Vyvíjíme interní webovou aplikaci "Test Manager" pro správu test cases, test suites, test runs, výsledků testování a defectů.

Aplikace má nahradit základní funkce JIRA/Xray/Zephyr pro testovací oddělení.

## Technologický stack
- Backend: Python FastAPI
- ORM: SQLAlchemy
- Migrace: Alembic
- Databáze: PostgreSQL
- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS
- Auth: JWT
- Lokální běh: Docker Compose

## Jazyk aplikace
UI texty budou česky.
Kód, názvy proměnných, API endpointy a databázové názvy budou anglicky.

## Pravidla vývoje
- Piš čistý, čitelný a rozšiřitelný kód.
- Backend odděluj na models, schemas, api routes a services.
- Frontend odděluj na pages, components a api klienty.
- Nepiš monolitický kód do jednoho souboru.
- Vždy přidej základní validace.
- U endpointů používej konzistentní REST styl.
- Při změnách databáze používej migrace.
- Před větší změnou nejdřív stručně vysvětli plán.
- Po změně spusť dostupné testy nebo alespoň build/typecheck.
- Neodstraňuj existující funkce bez důvodu.

## MVP funkce
První verze musí obsahovat:
1. Login
2. Projekty
3. Test Suites
4. Test Cases
5. Test Steps
6. Test Runs
7. Test Run Execution
8. Výsledky: passed, failed, blocked, skipped
9. Defects
10. Dashboard

## Hlavní entity
- User
- Project
- TestSuite
- TestCase
- TestStep
- TestRun
- TestRunCase
- Defect

## Databázová pravidla
- Každá hlavní tabulka má id, created_at, updated_at.
- TestSuite má parent_suite_id pro stromovou strukturu.
- TestSuite má path pro rychlé hledání podstromu.
- TestCase patří do Project a volitelně do TestSuite.
- TestRun obsahuje sadu TestRunCase položek.
- TestRunCase drží výsledek konkrétního provedení test case.
- Defect může být navázán na TestRunCase.

## Status hodnoty
TestCase status:
- draft
- ready
- deprecated

TestRun status:
- open
- in_progress
- completed
- archived

TestRunCase result:
- not_run
- passed
- failed
- blocked
- skipped

Defect status:
- open
- in_progress
- fixed
- retest
- closed
- rejected

Priority:
- low
- medium
- high
- critical

## UI pravidla
Aplikace má mít:
- levé menu
- horní lištu s vyhledáváním
- dashboard s KPI kartami
- tabulky s filtrováním
- detail test case
- strom test suites
- execution obrazovku pro testera
- moderní světlý SaaS vzhled
