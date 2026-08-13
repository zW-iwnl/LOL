# UX / Workflow Audit

Tento checklist slouží jako "analytik stránky" pro pravidelnou kontrolu workflow, regresí a použitelnosti.

## Automatizovaný smoke audit

Spuštění z `frontend` složky:

```powershell
npm run test:smoke
```

Výchozí login údaje:

- `TEST_MANAGER_EMAIL=admin@testmanager.cz`
- `TEST_MANAGER_PASSWORD=admin123`

Pokud už frontend běží, Playwright použije existující server. Pokud běží stack na jiné URL:

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:5174"
$env:PLAYWRIGHT_SKIP_WEBSERVER="1"
npm run test:smoke
```

## Smoke scénáře

- Login funguje a přesměruje na Dashboard.
- Hlavní navigace otevře Projects, Test Cases, Test Runs a Defects.
- Test Cases mají viditelný lokální projektový kontext a akci pro nový test case.
- Test Runs mají lokální projektový kontext a create wizard.
- Test Run wizard validuje povinný název.
- Test Run wizard nepustí vytvoření bez vybraného test case.
- Defects mají lokální projektový kontext a akci pro nový defect.
- Test během průchodu hlídá console/page errors.

## Ruční workflow checklist

Pro každou hlavní stránku ověř:

- Je jasné, ve kterém projektu uživatel pracuje.
- Primární akce je viditelná bez hledání.
- Empty state říká, co má uživatel udělat dál.
- Loading a error stavy nepůsobí jako rozbitá stránka.
- Formulář validuje povinná pole před odesláním.
- Nebezpečné akce mají potvrzení nebo jsou jasně označené.
- Status změny jsou prezentované jako workflow akce, ne jen technický select.
- Po uložení je vidět potvrzení a uživatel ví, kde skončil.
- Tester workflow má rychlou cestu na další položku.
- Detail entity ukazuje audit historii, pokud se daná entita audituje.

## Report formát

Používej závažnosti:

- `blocker`: uživatel nemůže dokončit hlavní workflow.
- `high`: workflow je možné dokončit, ale hrozí špatná data nebo záměna kontextu.
- `medium`: zbytečné tření, nejasný stav nebo slabá validace.
- `low`: vizuální nebo textový polish.

Záznam:

```text
Severity:
Stránka:
Krok:
Očekávání:
Skutečnost:
Doporučení:
```

## Aktuální priorita auditů

1. Login -> Test Cases -> nový test case.
2. Test Runs -> wizard -> výběr test cases -> přiřazení.
3. Execution -> Passed/Failed -> defect flow.
4. Defects -> workflow akce -> audit historie.
5. Requirements -> traceability matrix po doplnění endpointu.
