# Implementace schvalování a verzování – stav lokálního nasazení

## Stav

K 7. 9. 2026 je hlavní workflow nasazené na lokálu http://localhost:5173.
Lokální databáze je na `0022_case_approval_versions`, backend běží na portu 8000.
Tento dokument slouží jako checkpoint pro další práci. Celá analýza ještě není
dokončená; zbývající rozsah je níže. Nejde o potvrzení připravenosti k produkci.

Schvalovací fronta, detail review, editor návrhu, historie verzí, výběr verze
v runu a správa reviewerů používají stejný vizuální systém jako Repository:
segmentované světlé záložky, šedé filtrovací panely, tabulky, karty, vstupy,
focus stavy a velikosti tlačítek. Živý frontend byl po změně restartován.

Ověřeno: 55 backendových testů, 8 frontendových unit testů, TypeScript/build,
5 Playwright smoke testů a PostgreSQL souběh dvou schvalovatelů, immutable trigger,
idempotentní opakování a zachování výsledků/snapshotů napříč pokusy.
Browser scénář zahrnuje vytvoření v runu, chybný krok, vrácení reviewerem,
opravu do v2, nové provedení a nezávislé schválení bez změny historie v1.

## Co je v kódu

- `/test-case-approvals`: fronta, moje žádosti, návrhy, historie, stránkování,
  URL filtry, prohledávatelné tagy všech tří kategorií.
- Detail žádosti: neměnný obsah, diff vůči předchozí publikaci, přiřazení,
  připomínky, blokující připomínky, schválení/vrácení/zamítnutí/stažení.
- Samostatný draft a jeho optimistická revize, immutable verze, obnova přes
  další draft, historie editorů a procesní události, idempotentní nové operace.
- Ochrana publikovaného CRUD, zákaz vlastního schválení včetně přispěvatelů,
  správa rolí a vytvoření nového schvalovatele administrátorem v Nastavení.
- Vytvoření návrhu v execution, provedení jen ve zdrojovém runu,
  nový pokus nad upraveným draftem nebo vybranou schválenou verzí.
- Snapshot na každém pokusu, vlastní historické názvy/kroky/výsledky,
  stav schválení při zahájení a nyní, ochrana zamítnutých definic.
- Standardní picker pouze pro schválené scénáře; publikované tagy se nemění
  ukládáním draftu; přesun suity zůstává samostatnou operací.
- Traceability počítá ověření aktuální publikované verze odděleně od starých výsledků.
- Migrace `0022_case_approval_versions`: nové tabulky, převzetí ready,
  drafty, kopie legacy snapshotů, report chybějících snapshotů a kolizí,
  ochranné PostgreSQL triggery. Downgrade záměrně odmítá ztrátový převod.
- Nové integrační testy workflow a skutečný browser scénář se dvěma uživateli;
  starší testovací fixtures přecházejí přes nezávislé schválení.

## Migrace a předání

- Backend byl před čerstvou zálohou zastaven. Záloha je v ignorované složce
  `backups/approval-pre0022-final-20260907.dump` (65 449 B).
- Obnova do `approval_verify_20260907final` a migrační rehearsal prošly.
  `backend/scripts/verify_case_migration.py` porovnal počty a SHA-256 původních
  položek runu a skupinových vazeb; historie zůstala beze změny.
- Následovala migrace skutečné lokální DB a spuštění backendu. Přes frontendovou
  proxy vrátily HTTP 200 fronta review, verze TC 1, execution runu 1, skupiny a users.
- Importovány 3 ready scénáře. Původní run neměl žádný attempt ani snapshot:
  migrace založila legacy attempt a 3 case attempts, ale jejich snapshoty zůstaly
  NULL se stavem schválení unknown. Pro další provedení vybrat schválenou verzi
  tlačítkem „Nový pokus s jinou schválenou verzí“. Historický obsah se nevymýšlí.
- V lokální DB zůstal pouze původní admin. Druhého skutečného schvalovatele
  vytvořit v Nastavení; syntetické testovací účty vznikly pouze v izolované kopii.
- Ověřovací databáze `approval_verify_20260907`, `approval_verify_20260907b`
  a `approval_verify_20260907final` jsou ponechané. Dočasné API na 8001 skončilo
  zastavením backendu; jeho spuštění zajišťuje `scripts/serve_approval_verification.py`.
- Pro opakování browser testu použít samostatnou kopii, proxy na ověřovací API
  a proměnné `TEST_MANAGER_REVIEWER_EMAIL` / `TEST_MANAGER_REVIEWER_PASSWORD`.
  Chromium je doinstalovaný jen v aktuálním frontend kontejneru (`/usr/bin/chromium`),
  po rebuildování kontejneru je nutné jej znovu zajistit. Poslední běh použil
  `--workers=1 --trace=off`: trace ZIP na Windows bind mountu byl poškozený.
- Opraveno přepisování URL automatickým výběrem skupiny a ztracený klik na
  záložku při zavření tagového filtru; browser test kontroluje obě interakce.

## Zbývající rozdíly proti celé analýze

- PostgreSQL backfill zatím konzervativně ponechává FK starých pokusů prázdné;
  jejich přesné snapshoty a původní čísla jsou zachované, approval je unknown.
  Není implementováno přiřazování bezpečně shodných historických verzí.
- Samostatná doménová historie je uložená; notifikační outbox a upozorňování
  reviewerů ani kompletní KPI schvalovací stránky zatím nejsou implementované.
- Kompletní reportová stránka nemá nový rozpad podle schválení; rozpad je
  dostupný v execution a verze v traceability.
- Doporučování podobných scénářů a duplicity, hromadné přiřazení, přehled všech
  historických uzavřených runových návrhů, širší limity a performance měření
  ještě nejsou hotové. Stávající zdrojové odkazy a historie review jsou dostupné.
- Kategorie a počty v repository vyžadují regresní kontrolu i pro draft-only
  a archivované scénáře; samotné rozsahy skupinových hran se nemění.

Tyto body musí zůstat viditelné při navazující práci; tento dokument ani
přidané soubory neoznačují celý plán za dokončený.
