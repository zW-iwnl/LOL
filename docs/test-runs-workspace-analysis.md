# Test Runs: sjednocení s Repository a Test Execution

Datum: 2026-09-15. Výchozí revize: `00081fd`.

## Závěr a rozsah

Test Runs doporučuji převést na kompaktní pracovní plochu: vlevo filtrovaný seznam běhů, vpravo detail, příprava testů a přechod do execution. Zachovat dostupné funkce včetně založení runu z repository, přiřazení testerů a archivace.

Analýza vychází ze zdrojového kódu a existujících testovacích scénářů. Nejde o vizuální ověření běžící aplikace. Tento dokument nemění implementaci.

## Současné rozdíly

| Oblast | Test Runs dnes | Repository / Execution | Doporučení |
| --- | --- | --- | --- |
| Rámec stránky | Plné levé menu, velké odsazení, dokumentový scroll | Kompaktní menu, pracovní plocha na výšku okna na desktopu | Zařadit `/test-runs` do stejného layoutu |
| Hlavička | PageHeader s popisem a velké tlačítko | Kompaktní toolbar | Název, stručné počty, tlačítko Nový běh |
| Statistiky | Čtyři samostatné KPI karty | Stručné informace u pracovního obsahu | Jeden řádek počtů, podrobnosti na vyžádání |
| Seznam | Tabulka s minimální šířkou 1040 px, dlouhé popisy | Kompaktní navigace a detail vedle sebe | Seznam běhů se stručnými metadaty |
| Akce | Detail, pokračování, editace a archivace na každém řádku | Hlavní akce u detailu, ostatní v menu | Výběr názvem běhu, pokračování v hlavičce detailu, ostatní do menu |
| Detail | Modální formulář, několik vnořených scrollů | Trvale dostupný panel | Detail ve stejné pracovní ploše |
| Vytvoření | Dlouhý inline formulář nad statistikami a seznamem | Obsah v ohraničených panelech | Formulář jako režim hlavního panelu |
| Vizuální prvky | Individuální Tailwind styly, černá primární akce | `workspace-button`, `workspace-input`, cyan akcent | Použít existující společné prvky |

Zdroj: `frontend/src/pages/TestRunsPage.tsx`, `frontend/src/components/layout/AppLayout.tsx`, `frontend/src/styles.css`, `frontend/src/pages/ExecutionPage.tsx`, `frontend/src/components/repository/RepositorySuitesView.tsx`.

## Navržené rozložení

```text
Běhy testování     Celkem 42 · Aktivní 8 · Dokončené 31     [+ Nový běh]
┌──────────────────────────┬────────────────────────────────────────────┐
│ Hledat běh / číslo úkolu  │ Regrese plateb         [Pokračovat] [⋯]   │
│ Stav · Prostředí         │ QA-123 · TEST · v2.4 · Probíhá             │
│                          │ Vyhodnoceno 12/30       Úspěšnost 75 %     │
│ Regrese plateb           │ ───────── průběh ──────────────────────── │
│ QA-123 · TEST · 12/30     │ [Testy 30] [Údaje běhu]                    │
│                          │ Hledat test · Výsledek · Tester           │
│ Regrese přihlášení       │ [+ Přidat testy]                           │
│ QA-124 · UAT · 0/18       │ Kód a název        Tester     Výsledek ⋯  │
│                          │ TC-12 Platba       Novák      Prošel      │
│ Stránkování              │ TC-15 Storno       Novák      Neproveden  │
└──────────────────────────┴────────────────────────────────────────────┘
```

- Levý panel přibližně 320 px, sbalitelný; vybraný běh označit cyan pozadím a pruhem jako v execution.
- Řádek běhu: název, číslo úkolu, prostředí, stav a počet vyhodnocených testů. Popis a plán zobrazit v detailu.
- Hlavní panel: pevná hlavička, jedna oblast posunu pro obsah. Stránkování seznamu držet mimo jeho scroll.
- Výchozí záložka Testy slouží k přípravě obsahu runu; Údaje běhu obsahují metadata a editaci. Vlastní vyhodnocování zůstává na execution obrazovce.
- V detailu nabídnout přímý přechod na konkrétní test v execution, s návratem ke stejnému běhu a filtrům.
- Archivovaný běh má akci „Zobrazit výsledky“ a jasně označený režim pouze pro čtení. U dokončeného běhu nevydávat otevření výsledků za zahájení nového pokusu.
- Na úzkém displeji zobrazovat seznam nebo detail s tlačítkem Zpět na běhy. Na nízkém okně umožnit běžný scroll podle existujícího fallbacku execution.
- Nový běh a editace jsou režimy hlavního panelu. Před opuštěním rozepsaného formuláře řešit neuložené změny; zachovat současnou ochranu při rušení založení.

## Konkrétní nesrovnalosti k opravě

### 1. Průběh versus úspěšnost

`resultSummary()` počítá úspěšnost jako passed / vyhodnocené testy. Tabulka tuto hodnotu vykresluje zeleným pruhem. Jeden úspěšný test ze sta tak zobrazí 100 %, přestože zbývá 99 neprovedených testů. Execution má samostatný průběh vyhodnocené / všechny.

Zobrazovat obě metriky odděleně: **Vyhodnoceno 1/100** a **Úspěšnost 100 % z vyhodnocených**. Bez vyhodnocení zobrazit úspěšnost pomlčkou. Do vyhodnocených nyní patří i blocked a skipped; definici při sjednocení zachovat a srozumitelně popsat.

### 2. Výběr běhu závisí na stránce seznamu

Obnova `rememberedRun` hledá pouze v aktuálně načtené stránce. `selectedRunLatest` používá položku seznamu, případně starý uložený objekt. Po změně filtru či stránky může detail zůstat bez aktualizací.

Načítat vybraný běh podle ID nezávisle na seznamu přes existující `getTestRun()`. ID nést například v `/test-runs?run=123`; filtry a stránku obnovovat konzistentně při návratu. Běh mimo filtr ponechat otevřený a označit stejně jako repository. Ošetřit neexistující ID.

### 3. Filtry a založení

- Formulář umožňuje libovolné prostředí, filtr obsahuje pouze DEV, TEST, UAT a PROD-LIKE. Doplnit zadání vlastního prostředí nebo nabídku hodnot z dat.
- Přidávání testů používá `eligibleOnly` a dále omezuje položky na ready s publikovanou verzí. Nabídky Draft a Deprecated ve filtru proto nemohou vrátit položky; nahradit filtr relevantním hledáním či filtrem suity/skupiny.
- Po vytvoření se resetují filtry, ale ne offset seznamu. Nový běh doporučuji rovnou vybrat, obnovit první stránku a zobrazit jeho detail.
- Dodržet oddělení výsledku runu, stavu runu a schválení definice testu; neslučovat je do jednoho barevného štítku.

### 4. Statistiky a objem dat

`backend/app/services/run_workspace.py` vrací globální statistiky, zatímco `total` odpovídá filtru. Souhrn proto výslovně označit jako celkový, případně změnit kontrakt na statistiky filtrovaného seznamu. Průměrná úspěšnost se počítá jako průměr poměrů za runy s vyhodnocenými testy, nikoli jako souhrnný podíl všech passed testů; není omezena jen na dokončené runy.

Seznam přenáší všechny `test_run_cases` pro každý run na dané stránce. Pro větší data navrhuji souhrnné počty v seznamovém API a samostatná data detailu. Backend navíc doplňuje názvy z legacy `test_case_snapshot`; při sjednocení s execution ověřit a určit použití snapshotu aktuálního attemptu. Historii nesmí nahrazovat dnešní definice testu.

### 5. Přístupnost a zpětná vazba

Současný detail je vlastní overlay bez dialogové sémantiky a řízení focusu. Přesun do panelu řeší potřebu modálního detailu; při přepínání režimů je stále nutné přesunout focus na odpovídající nadpis a po návratu na původní položku.

Filtry musí mít přístupné názvy, výběr musí být ovladatelný klávesnicí a stav nesmí sdělovat jen barva. Chyby obnovování dat zobrazit u panelu s možností opakování; dostupný seznam kvůli chybě načtení testerů zbytečně neskrývat.

## Implementační členění

Použít existující `WorkspacePanels`, `Pagination`, `WorkspaceMenu`, `useWorkspacePreference`, `useDebounced` a společné CSS. Zachovat stávající klíče preferencí nebo zajistit jejich převod.

Rozdělit současný `TestRunsPage.tsx` na `TestRunsWorkspace`, `TestRunNavigator`, `TestRunDetailPanel`, `TestRunCasesTable`, `TestRunMetadataForm` a hook pro načítání a mutace. Sdílet pole a validace vytvoření/editace, nikoli celý formulář za cenu složitých podmínek. Existující `TestRunCreatePanel`, `RunRepositoryPicker` a `RunSelectionSummary` upravit pro panelové rozložení.

Při založení zachovat výběr skupin, suit a jednotlivých testů, deduplikaci, význam include_descendants, kontrolu způsobilosti a fingerprint náhledu. Pro přidávání testů do existujícího runu lze podobný výběr doplnit až s výslovně vyřešeným API kontraktem.

## Doporučené pořadí

1. **Základ:** společný layout, seznam/detail, kompaktní souhrn, jednotná tlačítka a oddělené metriky průběhu a úspěšnosti.
2. **Navigace a práce:** nezávislé načítání detailu, obnova výběru a filtrů, editace a založení v panelu, konzistentní návrat z execution.
3. **Větší data:** souhrnné seznamové API, stránkování testů v detailu a případně virtualizace až podle množství dat. Pro samotné sjednocení vzhledu není nutná migrace databáze.

## Akceptační scénáře pro implementaci

- Desktop 1440×900 a 1280×720: dostupná hlavní akce, přehledné panely bez horizontálního scrollu celé stránky.
- Mobil 390×844 a nízké desktopové okno: dosažitelné ovládání a žádný uříznutý formulář.
- Návrat z execution obnoví běh, filtry a stránku; funguje i běh mimo filtr a přímá URL.
- Založení z pozdější stránky seznamu otevře nový běh; zůstávají validace, náhled i kontrola změny výběru.
- Přiřazení testera, přidání/odebrání testu a archivace obnoví seznam i detail; omezení archivace a historie zůstanou zachována.
- Prázdný běh, žádné výsledky filtru, chyba API a jeden úspěšný test ze sta mají jednoznačné zobrazení.
- Klávesnice: výběr běhu, menu akcí, změna záložky, přechod do formuláře a návrat bez ztraceného focusu.
- Po implementaci spustit frontend build/typecheck, relevantní unit a smoke testy; při změně API také backend testy počtů a filtrování. Stávající create smoke testy zachovat a doplnit scénáře detailu a návratu.
