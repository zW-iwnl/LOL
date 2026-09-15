# Nastavení vzhledu – implementace a ověření

Datum: 2026-09-15.

## Dostupné funkce

- Nastavení → Vzhled aplikace: Světlý, Tmavý, Podle systému.
- Tyrkysový, modrý a fialový akcent, případně vlastní neprůhledná HEX barva.
- Současný světlý i tmavý náhled, uložení, zrušení změn a obnova výchozích hodnot.
- Rychlý přepínač v horní liště a na přihlašovací stránce.
- Trvalé uložení v tomto prohlížeči, synchronizace mezi kartami a upozornění při souběžné změně rozepsaného návrhu.
- Vzhled je společný pro účty v tomto prohlížeči. Synchronizace přes účet ani editor libovolných povrchových barev nejsou součástí této verze.

Výchozí volba je systémový režim s tyrkysovým akcentem. Při nedostupném úložišti se vzhled použije pro aktuální otevření a UI oznámí, že nebyl trvale uložen. Načítání auth tokenu při zablokovaném úložišti nyní vrací nepřihlášený stav místo pádu aplikace.

## Technické řešení

`frontend/src/theme` obsahuje validaci preferencí, výpočet kontrastu a palety, aplikaci tématu, provider, bootstrap a sémantické CSS proměnné. Vlastní akcent má oddělenou výplň, text, hover, odkaz, výběr a focus; konkrétní odstíny se odvozují pro oba režimy.

`theme-bootstrap-plugin.ts` při sestavení i vývoji vytvoří malý synchronní inline skript ze stejných zdrojů jako provider. Vloží ho za deklaraci UTF-8 v hlavičce HTML. Preference a `color-scheme` se aplikují před spuštěním Reactu. Neexistuje druhá ručně udržovaná kopie validačního nebo barevného algoritmu.

`tokens.css` mapuje významové utility pomocí Tailwind `@theme inline`. Ručně psané styly workspace jsou ve vrstvě components, takže jejich pozadí neblokuje stavové utility. Výsledky testů sdílejí mapování v `data/resultStyles.ts` a jsou nezávislé na akcentu uživatele.

Převedeny jsou aktuální stránky, pracovní panely, formuláře, vyhledávání, dialogy, menu, schvalovací diff, výsledky, stíny i loading/error stavy. Původní pevné barevné utility v aplikačních komponentách byly odstraněny. Pevné HEX hodnoty zůstávají v definicích palet, validačních příkladech, barevných vzornících a v záměrně stálé faviconě. Součástí změny není změna API nebo databáze.

## Ověření

| Kontrola | Výsledek |
| --- | --- |
| `npm.cmd run build` – TypeScript a produkční Vite build | Prošlo |
| `npm.cmd run test:unit` | 25/25 |
| Browser sada: appearance, repository, execution, approval-workspace, test-run-create | 36/36 |
| Původní čtyři pracovní browser sady se systémovým tmavým režimem | 20/20 |
| Appearance sada proti produkčnímu buildu přes Vite preview | 16/16 |
| `git diff --check` | Bez chyb whitespace |

Unit testy ověřují 219 vstupních barev v každém režimu: běžné texty na tlačítkách, hover, odkazy, focus, vybranou plochu a barvy výsledků. Kontrola vykresleného textu v browser testech doplňuje výpočty skutečnými CSS barvami. Při ověřování byly upraveny dvě hraniční kombinace: úspěšný výsledek na světlém výběru a neprovedený výsledek na tmavém barevném výběru.

Browser testy pokrývají všechny routy z `App.tsx`, včetně přesměrování suit a alternativní execution URL. Kontrolují současný a historický execution, archivaci, náhled test case, editaci návrhu, historii verzí, schvalovací dialog, detail/editaci/založení runu, dashboard, reporty, vlastnosti, nastavení, login a chybové stavy. Kontrolují také přepnutí systému, reload, odhlášení, zablokované úložiště a konflikt mezi kartami.

Samostatný test pozastaví načtení hlavního JavaScript modulu a ověří tmavý režim a `color-scheme` ještě před vykreslením Reactu. Funguje proti vývojovému serveru i produkčním assetům.

Screenshoty obou režimů vznikají pod `frontend/test-results`; produkční ověření pod `frontend/test-results/production`. Reprezentativní snímky nastavení, repository, execution, schvalování, detailu runu, dashboardu a přihlášení byly také vizuálně prohlédnuty. Mobilní ověření zahrnuje navigaci, nastavení a existující pracovní scénáře.

### Rozsah výsledků

Browser testy používají deterministická testovací API data. Živý FastAPI backend při ověření neběžel; Docker měl spuštěnou pouze databázi. Integrační `workflow.spec.ts` a `approvals.spec.ts` proti skutečnému backendu nebyly spuštěny. Kontrola kontrastu a screenshotů není kompletní certifikace přístupnosti; například nevykonává audit čtečkou obrazovky.

## Opakování kontrol

Z adresáře `frontend`:

```powershell
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:smoke -- appearance.spec.ts repository.spec.ts execution.spec.ts approval-workspace.spec.ts test-run-create.spec.ts
```

Tmavé pracovní scénáře lze zkontrolovat nastavením `PLAYWRIGHT_COLOR_SCHEME=dark`. Při použití již spuštěného Vite serveru nastavit `PLAYWRIGHT_SKIP_WEBSERVER=1`. Produkční sadu lze spustit proti `npm.cmd run preview -- --port 5175` s `PLAYWRIGHT_BASE_URL=http://localhost:5175` a `PLAYWRIGHT_SKIP_WEBSERVER=1`.

Nové komponenty mají používat stejné významové proměnné. Barvy výsledků ani chyby nemají být odvozovány z osobního akcentu.
