# Kompaktní pracovní plocha execution

## Rozložení a ovládání

- Na desktopu má execution výšku obrazovky. Navigace a obsah testu mají každý jednu
  posuvnou oblast; lišta výsledku zůstává mimo posun obsahu.
- Hlavní menu se v execution standardně zobrazí jako ikony, lze je rozbalit.
- Navigaci testů lze skrýt a měnit její šířku. Na mobilu zůstává přirozený posun stránky.
- Hlavička testu ukazuje verzi skutečně zvoleného pokusu a stav schválení. Předpoklady
  jsou otevřené, další metadata a méně časté akce jsou rozbalovací.
- Kroky mají společnou hlavičku, informační řádky nemají vyhodnocení.
- `Uložit` ponechá vybraný test. `Uložit a další` a rychlé úspěšné provedení přecházejí
  na další neprovedený test ve filtrovaném pořadí, případně od začátku seznamu.
  Po vyčerpání filtru lze pokračovat v celém běhu.
- Výsledky kroků se ukládají ihned. Celkový výsledek a komentář se potvrzují zvlášť.
  Chybný krok navrhne neúspěšný výsledek, všechny vyhodnocené kroky navrhnou výsledek
  podle dosavadních pravidel; nejde o automatické uložení výsledku testu.

## Hledání a struktura

`GET /test-runs/{id}/execution` vrací navíc `navigation` s aktuálními skupinami,
jejich vazbami a suitami omezenými na testy vybraného provedení. Není potřeba migrace.

- Hledání ignoruje velikost písmen a diakritiku. Porovnává kód a název snapshotu,
  název suity a skupin obsahujících test; lze je kombinovat s testerem a výsledkem.
- Kliknutím na název skupiny nebo suity se omezí seznam; šipka řídí rozbalení.
- Při hledání se relevantní cesty rozbalí, po jeho vymazání se obnoví ruční rozbalení.
- Skupiny tvoří DAG. Stejný test může mít více umístění, ale počty, výsledky a přechody
  jsou nad unikátními položkami běhu.
- Umístění s `include_descendants=false` nepokračuje do potomků. Skupina zůstává
  dostupná také samostatně, pokud by její potomci jinak nebyli přístupní.
- Přímé členství testů ve skupinách a testy bez skupin mají vlastní zobrazení.
- Přehled navigace nezavádí filtry schválení, aktivních suit ani deprecated testů.
  Historické položky tedy nevypadnou podle své dnešní způsobilosti k novému běhu.
- Navigace je označena jako **aktuální struktura repository**. Historická struktura
  skupin se nerekonstruuje. Definice, výsledky, verze a schválení pocházejí z pokusu;
  suita ze snapshotu je samostatně v podrobnostech testu.

## Rozepsané údaje a obnova

Komentář a neuložený celkový výsledek se uchovávají v `sessionStorage` podle uživatele,
běhu a pokusu. Přežijí přepnutí testu, změnu stránky v aplikaci a obnovení stránky
v téže kartě prohlížeče. Nejde o uložení na server ani synchronizaci mezi zařízeními.
Po úspěšném uložení se lokální rozepsané údaje odstraní. Neúspěšný zápis je zachová.

Obnovení dat zachovává pracovní plochu a posun; během zápisu jsou akce zakázané.
Historické a archivované provedení mají vyhodnocení i komentář pouze pro čtení.

## Rozdělení implementace

- `ExecutionPage`: propojení výběru, filtrů, pokusů a stávajících schvalovacích panelů.
- `components/execution`: navigace, kroky, hlavička, výsledek, nabídky, načítání a návrhy.
- `services/execution_navigation.py`: datový rozsah navigace s použitím pravidel DAG.
- `schemas/execution_navigation.py`: rozšíření REST odpovědi.

## Ověření

- Backend: `cd backend && .venv/bin/python -m pytest -q`.
- Frontend: `cd frontend && npm run build && npm run test:unit`.
- Prohlížeč: `cd frontend && npm run test:smoke -- execution.spec.ts test-run-create.spec.ts`.
- UI testy používají mockované API; backendové testy ověřují skutečné služby s testovací
  databází. Schvalovací smoke test s nezávislým reviewerem potřebuje odpovídající účty.
