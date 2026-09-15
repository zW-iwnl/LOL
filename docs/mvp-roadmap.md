# MVP Roadmap

> Projektové části tohoto historického roadmapu jsou od 2026-08-24 neplatné. Aktuální architekturu popisuje [Jedno globální repository bez projektů](single-repository-architecture.md).

## Aktuální stav - 2026-05-22
- Frontend build a TypeScript kontrola prochází.
- Backend jde importovat, modely se registrují a Python soubory se kompilují.
- Docker Compose stack běží lokálně, migrace a seed demo dat proběhly.
- Frontend odpovídá na http://localhost:5173 a backend health na http://localhost:8000/health.
- Login end-to-end funguje přes demo účet admin@testmanager.cz / admin123.
- Backend má základní pytest sadu pro auth a chráněný projects endpoint.

## Nejbližší postup
1. Uklidit projektový scope bez globálního selectoru: projekt vybírat lokálně na stránkách nebo přejít na URL `/projects/:projectId/...`.
2. Přestavět Test Cases na repository-style layout podle Qase/TestRail vzoru: toolbar, suite strom vlevo, cases tabulka vpravo, quick create.
3. Přidat verzování test cases a snapshot test case obsahu do TestRunCase.
4. Přidat import/export test suites a test cases v CSV jako první formát.
5. Napojit Dashboard rychlé akce a horní vyhledávání.
6. Vyřešit produkční správu uživatelů a změnu hesla místo demo seedu.
7. Přidat CI příkazy pro backend pytest a frontend build.

## 1. Login
- email
- password
- login button

## 2. Dashboard
- KPI: počet test cases
- KPI: aktivní test runy
- KPI: pass rate
- poslední test runy
- graf výsledků

## 3. Projects
- seznam projektů
- vytvoření projektu
- detail projektu

## 4. Test Suites
- strom test suites
- search input
- vytvoření test suite
- editace test suite
- zobrazení test cases v dané suitě

## 5. Test Cases
- tabulka test cases
- filtry: suite, status
- vytvoření test case
- detail test case
- editace kroků

## 6. Test Runs
- seznam runů
- vytvoření test runu
- výběr test cases
- přiřazení testerům
- hromadný výběr test cases při vytváření i v detailu runu
- filtrování dostupných test cases podle statusu a textu
- odebrání test case z runu, dokud není archivovaný
- změna přiřazeného testera u existující run položky
- validace, že do runu nejdou přidat duplicitní nebo cizí test cases
- přehled postupu runu: provedeno / zbývá / pass rate

## 7. Test Execution
- seznam test run cases
- detail test case
- kroky testu
- tlačítka Passed / Failed / Blocked / Skipped
- komentář
- automatický posun na další neprovedený test case po uložení výsledku
- viditelný progress execution a filtr podle výsledku
- zobrazení přiřazeného testera, posledního vykonavatele a času provedení
- uzavření test runu do completed po vyhodnocení všech položek
- blokace nebo omezení editace execution u archivovaných runů


## 8. Import / Export
- import test suites z CSV/XLSX
- import test cases včetně kroků z CSV/XLSX
- validace importu před uložením: duplicity kódů, chybějící povinná pole, neexistující suite
- preview importu s počtem nových, změněných a chybných řádků
- export test suites do CSV/XLSX
- export test cases včetně kroků, statusu a vazby na suite
- šablony souborů ke stažení pro správný formát importu

## 9. Versioning
- verzování test cases při změně názvu, popisu, preconditions, expected summary a kroků
- zobrazení historie verzí test case
- možnost porovnat dvě verze test case
- označení aktuální aktivní verze test case
- audit: kdo verzi vytvořil a kdy
- volitelně verzování test suites při změně názvu, parent suity nebo struktury stromu
- ochrana proti tiché změně test case, který už byl použitý v historickém test runu

## 10. Kompaktní workflow
- Repository → návrh → nezávislé review → publikace → test run → execution.
- Stránkované fronty a čitelné porovnání verzí, stálá rozhodovací lišta.
- Zachování návratového kontextu a rozepsaných vstupů.
- Přesné souhrny běhů a proklik pracovních položek z Dashboardu.
