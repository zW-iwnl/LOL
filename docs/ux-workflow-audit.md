# UX / workflow audit

Aktuální aplikace používá jedno globální Repository se skupinami DAG a plochými suitami.

## Kontrolované průchody

1. Dashboard → Repository → nový test → návrh → odeslání.
2. Schvalování → převzetí → připomínka → vrácení → oprava → schválení.
3. Test Runs → výběr schválených scénářů → execution → výsledek → další test.
4. Execution → změna scénáře → review → návrat na konkrétní pokus.
5. Vyřazení testu zachovává jeho verze a historii provedení.

## Kontroly použitelnosti

- Při návratu z detailu zůstávají filtry, stránka a výběr.
- Rozpracované komentáře/návrhy se při chybě ani přepnutí neztratí.
- Kompaktní fronta a rozhodnutí se vejdou na 1366×768; mobil nemá vodorovné přetečení.
- Přiřazení a schválení odpovídají serverovým oprávněním a nezávislosti reviewera.
- Souhrny zahrnují všechny běhy; seznamy fungují i za první stovkou položek.
- Výsledky testování a schválení definice jsou jasně oddělené.
- Prázdný seznam a chyba nabízí konkrétní další akci.

## Ověření

`npm run build`, `npm run test:unit`, Playwright scénáře v `frontend/tests/smoke`, backend pytest.
Pro PostgreSQL použijte izolovaný `approval_verify_*` databázový prostor a skript
`backend/scripts/verify_workflow_workspace.py`; existující neprázdnou databázi odmítne.
