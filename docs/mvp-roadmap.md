# MVP Roadmap

## Aktuální stav - 2026-05-22
- Frontend build a TypeScript kontrola prochází.
- Backend jde importovat, modely se registrují a Python soubory se kompilují.
- Docker Compose stack běží lokálně, migrace a seed demo dat proběhly.
- Frontend odpovídá na http://localhost:5173 a backend health na http://localhost:8000/health.
- Login end-to-end funguje přes demo účet admin@testmanager.cz / admin123.
- Backend má základní pytest sadu pro auth a chráněný projects endpoint.
- Traceability matrix má rizikový stav, metriky pokrytí, filtry, poslední výsledek a otevřené defecty.

## Nejbližší postup
1. Uklidit projektový scope bez globálního selectoru: projekt vybírat lokálně na stránkách nebo přejít na URL `/projects/:projectId/...`.
2. Přestavět Test Cases na repository-style layout podle Qase/TestRail vzoru: toolbar, suite strom vlevo, cases tabulka vpravo, quick create.
3. Přestavět Test Plans na split layout: release/milestone/plan navigace vlevo, detail vybraného plánu a runy vpravo.
4. Doplnit `Create run from plan`, aby Test Plan fungoval jako šablona/kontejner pro runy.
5. Dodělat Defects workflow: povolené status přechody, validace na backendu a čitelné akce ve frontendu.
6. Přidat audit log pro hlavní entity: TestCase, TestStep, TestRun, TestRunCase, Defect, Requirement.
7. Přidat verzování test cases a snapshot test case obsahu do TestRunCase.
8. Hotovo: Dotáhnout traceability: Requirement -> Test Cases -> poslední výsledek -> otevřené defecty.
9. Přidat import/export test suites a test cases v CSV jako první formát.
10. Rozšířit backend integrační testy pro test suites, test cases, test runs, execution, defects, audit a traceability.
11. Přidat frontend smoke testy pro login, test case, test run, execution a defect.
12. Napojit Dashboard rychlé akce a horní vyhledávání.
13. Doplnit role/permissions a validace workflow přechodů i mimo defects.
14. Vyřešit produkční správu uživatelů a změnu hesla místo demo seedu.
15. Přidat CI příkazy pro backend pytest a frontend build.

## 1. Login
- email
- password
- login button

## 2. Dashboard
- KPI: počet test cases
- KPI: aktivní test runy
- KPI: pass rate
- KPI: otevřené defecty
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
- filtry: suite, priority, status, type
- vytvoření test case
- detail test case
- editace kroků

## 6. Test Runs
- seznam runů
- vytvoření test runu
- výběr test cases
- přiřazení testerům
- hromadný výběr test cases při vytváření i v detailu runu
- filtrování dostupných test cases podle priority, statusu a textu
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
- založení defectu při failed
- automatický posun na další neprovedený test case po uložení výsledku
- viditelný progress execution a filtr podle výsledku
- zobrazení přiřazeného testera, posledního vykonavatele a času provedení
- možnost uložit failed bez defectu, ale s vědomým potvrzením v modalu
- uzavření test runu do completed po vyhodnocení všech položek
- blokace nebo omezení editace execution u archivovaných runů

## 8. Defects
- seznam defectů
- detail defectu
- status workflow

## 9. Import / Export
- import test suites z CSV/XLSX
- import test cases včetně kroků z CSV/XLSX
- validace importu před uložením: duplicity kódů, chybějící povinná pole, neexistující suite
- preview importu s počtem nových, změněných a chybných řádků
- export test suites do CSV/XLSX
- export test cases včetně kroků, priority, statusu, typu a vazby na suite
- šablony souborů ke stažení pro správný formát importu

## 10. Versioning
- verzování test cases při změně názvu, popisu, preconditions, expected summary a kroků
- zobrazení historie verzí test case
- možnost porovnat dvě verze test case
- označení aktuální aktivní verze test case
- audit: kdo verzi vytvořil a kdy
- volitelně verzování test suites při změně názvu, parent suity nebo struktury stromu
- ochrana proti tiché změně test case, který už byl použitý v historickém test runu

## 11. Requirements / Traceability
- evidence požadavků v rámci projektu
- vazba Requirement -> Test Case
- vazba Test Case -> Test Run Case přes execution
- vazba Test Run Case -> Defect
- traceability matrix: Requirement / Test Cases / poslední výsledek / otevřené defecty
- coverage report: požadavky bez test case, test cases bez požadavku
- filtr podle rizika, statusu požadavku a výsledku testování
- export traceability matrix do CSV/XLSX

## 12. Test Plans / Milestones / Releases
- evidence releases nebo verzí produktu
- milestones s plánovaným začátkem a koncem
- test plan jako kontejner pro více test runů
- přiřazení test planu k release/milestone
- přehled stavu test planu: runy, pass rate, blokované testy, otevřené defecty
- plánování větších testovacích cyklů napříč projektem
- možnost vytvořit test run z test planu
- release readiness pohled: coverage, výsledky, kritické defecty
