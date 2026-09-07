# AGENTS.md

## Projekt
Vyvíjíme interní webovou aplikaci "Test Manager" pro správu test cases, test suites, test runs, výsledků testování.

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
2. Test Suites
3. Test Cases
4. Test Steps
5. Test Runs
6. Test Run Execution
7. Výsledky: passed, failed, blocked, skipped
8. Dashboard

## Hlavní entity
- User
- TestSuite
- TestCase
- TestStep
- TestRun
- TestRunCase

## Databázová pravidla
- Každá hlavní tabulka má id, created_at, updated_at.
- Aplikace používá jedno globální repository bez projektového dělení.
- TestSuite je plochá entita bez parent_suite_id, path a level.
- SuiteGroup tvoří jedinou hierarchickou vrstvu repository a může mít více rodičů (DAG).
- Vazby SuiteGroupRelation nesmí vytvářet cykly.
- TestSuite může být členem více SuiteGroup.
- TestCase povinně patří právě do jedné TestSuite a může být zároveň explicitním členem více SuiteGroup.
- TestRun obsahuje sadu TestRunCase položek; dvojice test_run_id a test_case_id je unikátní.
- TestRunCase drží aktuální výsledek a neměnný snapshot konkrétního test case.
- Historické TestRunCase a jejich attempts se při odstranění zdrojového TestCase nemažou.
- TestCase použitý v test runu se místo fyzického smazání označí jako deprecated.

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


Requirement priority:
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
