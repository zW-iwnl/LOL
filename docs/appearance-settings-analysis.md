# Dark mode a vlastní barvy v nastavení

> Implementováno 2026-09-15. Aktuální chování a výsledky testů popisuje [implementační přehled](appearance-settings-implementation.md). Níže zůstává původní analýza.

Datum: 2026-09-15. Výchozí revize aplikace: `00081fd`.

## Doporučení

Zavést společné barevné proměnné pro celou aplikaci a nad nimi osobní nastavení vzhledu:

1. Režim **Světlý / Tmavý / Podle systému**.
2. Akcent: předvolby a **Vlastní barva** s barevným pickerem a HEX vstupem.
3. Náhled tlačítek, tabulky, výběru a výsledků před uložením.
4. Obnovení výchozího vzhledu.

Vlastní akcent má ovlivnit primární akce, odkazy, aktivní navigaci, vybrané řádky a focus. Barvy výsledků, chyb, varování a schvalování mají vlastní významové palety. Rozšířené úpravy pozadí a textů doporučuji až jako další fázi s kontrolou všech výsledných kombinací.

Jde o analýzu kódu a návrh implementace, nikoli o hotový dark mode nebo vizuální audit běžící aplikace. Nahrazuje věcně zastaralé části [plánu z 21. srpna](dark-mode-implementation-plan.md).

## Aktuální stav a rozsah

| Zjištění | Dopad |
| --- | --- |
| `main.tsx` nemá ThemeProvider a `index.html` nemá inicializaci tématu | Je nutné řešit i vzhled před načtením Reactu a přihlášením |
| `styles.css` má pevné světlé barvy v `.workspace-*`, `.repository-*` i `.execution-*` | Pouhé přidání přepínače tématu nestačí |
| Hledání barevných Tailwind tříd zachytilo 51 souborů z 86 souborů pod `frontend/src` | Převod se týká sdílených komponent i jednotlivých stránek |
| `App.tsx`, `AppLayout.tsx` a `LoginPage.tsx` mají pevné pozadí `#f6f8fb` | Převést i loading a login, jinak zůstanou světlé |
| `SettingsPage.tsx` obsahuje role a select prostředí bez ukládací logiky | Vzhled potřebuje vlastní skutečně funkční sekci |
| `ReviewerRoles` se zobrazuje pouze administrátorům | Osobní vzhled musí být dostupný každému přihlášenému uživateli |
| `useWorkspacePreference` používá `sessionStorage` podle ID uživatele | Vzhled vyžaduje trvalejší úložiště a fungování bez přihlášení |
| Model User a současné API nemají preference vzhledu | Lokální varianta nevyžaduje backend; synchronizace ano |
| Dashboard a execution mají oddělené mapy barev výsledků | Sdílet významové tokeny pro stejný stav napříč stránkami |

Počet 51 je orientační inventura souborů odpovídajících výrazu `(bg|text|border|ring|fill|stroke)-(slate|gray|white|black|cyan|rose|emerald|amber|sky|red|green|blue)`, nikoli úplný počet všech barevných deklarací.

Starší plán počítal s Requirements, Projects a dvěma mind mapami. Aktuální `App.tsx` takové routy nemá a hledání ReactFlow ve zdrojích našlo pouze import jeho CSS, nikoli vykreslovanou komponentu. Implementaci plánovat podle současných rout: dashboard, repository, suites, detail a vlastnosti test case, schvalování, test runs, execution, reports, settings a login. Samotná přítomnost závislosti není důvod přidávat práci na mapách.

## Návrh Nastavení → Vzhled

```text
Nastavení
[Vzhled] [Správa uživatelů – podle oprávnění] [Další nastavení]

Vzhled aplikace
Režim       ( ) Světlý   ( ) Tmavý   (●) Podle systému
Akcent      [Tyrkysová] [Modrá] [Fialová] [Vlastní]
Vlastní     [barevný výběr]  [#0E7490]

Náhled      [Světlý] [Tmavý]
            Vybraný běh    [Primární akce] [Běžná akce]
            Běžný text · Vedlejší text · Odkaz
            ✓ Úspěšné   ✕ Neúspěšné   ⊘ Blokované   – Přeskočené

[Obnovit výchozí]                     [Zrušit změny] [Uložit vzhled]
Ukládá se v tomto prohlížeči.
```

- Výchozí režim doporučuji Podle systému, výchozí akcent stávající tyrkysový.
- Rozpracovaná volba se promítá do izolovaného náhledu; celá aplikace se přepne po uložení. Zrušit vrátí uloženou volbu.
- Obnovit výchozí připraví výchozí hodnoty v náhledu, uložení je potvrdí. Tlačítko zůstane čitelné i při problematické rozpracované paletě.
- Světlý i tmavý náhled jsou dostupné bez změny systému. U Podle systému uvést aktuálně použitý režim.
- Po uložení zobrazit potvrzení. Při nedostupném úložišti změnu použít pro aktuální otevření a jasně uvést, že není trvale uložená.
- V horní liště může být kompaktní přepínač tří režimů se stejným stavem; plnou personalizaci soustředit do nastavení. Základní přepnutí režimu zpřístupnit také na loginu.
- Názvy barev, HEX pole a stav výběru musí být přístupné klávesnicí i čtečce, samotné barevné kolečko nestačí.

## Varianty personalizace

| Varianta | Co dovolí | Náročnost a doporučení |
| --- | --- | --- |
| Témata a předvolby akcentu | Dvě ověřené palety, automatický režim, několik akcentů | Nejmenší rozsah pro první dodání |
| Vlastní akcent | HEX barva a automaticky vytvořené odstíny pro oba režimy | Doporučené rozšíření; potřebuje ověření kontrastu odvozených stavů |
| Barevnost povrchů | Například neutrální šedá nebo šedomodrá sada | Rozumná další fáze s předem ověřenými kombinacemi |
| Libovolné pozadí, text a okraje | Editor celé palety pro každý režim | Výrazně větší rozsah validace; nedoporučuji do první verze |

Jedna uživatelská barva nebude doslova použitá všude. Je vstupem pro paletu: výplň tlačítka, text tlačítka, odkaz, hover, vybraná plocha, vybraný okraj a focus. Světlá žlutá například potřebuje tmavý text na tlačítku a tmavší variantu pro odkazy na bílé. Uživatel musí vidět skutečný výsledný vzhled v náhledu.

Pro neplatný HEX zobrazit chybu u pole. Přijímat pouze neprůhledné `#RRGGBB`, nikoli libovolný CSS řetězec. Z platné barvy odvodit varianty, spočítat kontrast a při nemožnosti vytvořit čitelnou sadu nabídnout nejbližší ověřenou předvolbu; vadnou sadu neukládat. Pouhé míchání barev nebo převrácení světlosti není kontrolou kontrastu.

## Barevná architektura

Komponenta má říkat, k čemu barva slouží: `bg-surface`, `text-muted`, `border-control`, `bg-accent`, nikoli konkrétní odstín `slate-200` nebo `cyan-700`.

| Skupina proměnných | Příklady účelu |
| --- | --- |
| Povrchy | page, surface, surface-muted, surface-raised, overlay |
| Text | text, text-muted, text-disabled, placeholder |
| Hranice | border, border-control, border-strong |
| Interakce | hover, selected-bg, selected-text, selected-border, focus |
| Akcent | accent, accent-hover, on-accent, link, link-hover |
| Významové stavy | passed, failed, blocked, skipped, not-run, info, warning, danger; text/bg/border |
| Další prvky | stíny, grafy, diff přidáno/odebráno, scrollbar a nativní ovládací prvky |

Tailwind 4 umožňuje mapovat významové utility na CSS proměnné přes `@theme inline`; samotné hodnoty lze měnit na kořeni dokumentu. Návrh vychází z [oficiální dokumentace Tailwind theme variables](https://tailwindcss.com/docs/theme). Lokálně nainstalovaná verze při analýze je 4.2.4; ověřit build proti skutečnému lockfile projektu.

```css
@theme inline {
  --color-surface: var(--ui-surface);
  --color-muted: var(--ui-text-muted);
  --color-accent: var(--ui-accent);
}
/* Hodnoty --ui-* definovat pro light/dark a přepsat odvozeným akcentem. */
```

Stejné proměnné použít v ručně psaných `.workspace-*` stylech. Pozor na prioritu CSS: existující nelayerované `.workspace-button` a `[aria-pressed]` mohou přebít utility. Při převodu sjednotit umístění do vrstev a vlastnictví stavů; neřešit kolize přidáváním `!important`.

### Výchozí paleta k vizuálnímu ověření

| Účel | Světlá | Tmavá |
| --- | --- | --- |
| Pozadí aplikace | `#F6F8FB` | `#0F172A` |
| Panel | `#FFFFFF` | `#1E293B` |
| Další vrstva | `#F8FAFC` | `#334155` |
| Hlavní text | `#0F172A` | `#E2E8F0` |
| Vedlejší text | `#475569` | `#94A3B8` |
| Primární tlačítko | `#0E7490` | `#22D3EE` |
| Text primárního tlačítka | `#FFFFFF` | `#083344` |

Vypočtený kontrast vybraných neprůhledných dvojic: světlé primární tlačítko 5,36 : 1; tmavé tlačítko 7,41 : 1; tmavý vedlejší text na panelu 5,71 : 1. Nejde o potvrzení kontrastu celé aplikace: další vrstvy, průhlednosti, focus, hover a stavové barvy vyžadují samostatné ověření.

Běžné texty mají mít alespoň 4,5 : 1. U velkých textů je mez 3 : 1, ale aplikace převážně používá malé písmo. Viz [W3C: minimální kontrast textu](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Vizuální informace nutná k identifikaci ovládacího prvku či jeho stavu potřebuje 3 : 1 vůči přilehlým barvám; neplatí to paušálně pro každý dekorativní oddělovač. Viz [W3C: netextový kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Výsledky nadále označovat textem a symbolem. Barva akcentu může být i červená nebo zelená; nesmí proto sama nést význam výsledku. Fokus ověřovat také nad stavovými tlačítky, nikoli jen na prázdném panelu.

## Stav, ukládání a počáteční načtení

### Doporučená první verze: tento prohlížeč

```ts
type AppearancePreferences = {
  version: 1;
  mode: "light" | "dark" | "system";
  accent: { kind: "preset"; id: "cyan" | "blue" | "violet" }
    | { kind: "custom"; hex: string };
};
```

- Ukládat validovanou preferenci do `localStorage`, např. `fet:appearance:v1`. Odvozenou paletu neukládat jako autoritativní data; lze ji znovu vytvořit.
- V této variantě jde o nastavení prohlížeče společné všem účtům na daném originu, nikoli o nastavení účtu. V UI to výslovně uvést. Odhlášení vzhled nemění.
- Chybějící, poškozená nebo nepodporovaná hodnota použije výchozí nastavení. Přístup do úložiště musí být ošetřený i při čtení.
- Preference `system` a skutečný režim light/dark jsou dva různé stavy. Poslouchat změnu systému pouze pro automatický režim.
- Změny uložené v jiné kartě promítnout přes událost storage. Pokud je otevřený rozepsaný editor vzhledu, upozornit na změnu místo tichého přepsání návrhu.

### Aplikace tématu před vykreslením

Malý synchronní bootstrap v `<head>` nastaví `data-theme`, výsledné proměnné akcentu a `color-scheme` před prvním vykreslením. Nastavení až v React efektu nebo pouhé vložení před `createRoot` nezaručuje, že stránka během načítání modulů neproblikne světlou barvou.

Bootstrap a provider musí sdílet stejná validační a odvozovací pravidla; při sestavení lze vygenerovat bootstrap ze stejného zdroje. Základní CSS má použít systémový fallback při chybě inicializace. Pokud nasazení omezuje inline skripty pomocí CSP, bootstrap nasadit s odpovídajícím hashem/nonce nebo jako malý synchronní vlastní soubor. Jde o implementační podmínku, nikoli zjištění současné CSP.

ThemeProvider má obalit i přihlašování a auth loading. Kořenové proměnné tak zdědí také dialogy vykreslené portálem. `color-scheme` sladí nativní selecty, datumová pole a další systémové ovládání.

### Volitelná druhá verze: preference účtu

Pokud má vzhled cestovat mezi zařízeními, přidat například `GET/PATCH /users/me/preferences/appearance`, typované schema a service; oprávnění vždy určit z přihlášeného uživatele. Pro nové databázové pole/tabulku použít Alembic migraci.

Priorita: po přihlášení preference účtu, před přihlášením poslední platná lokální preference, bez ní systém. Lokální cache preference účtu musí být oddělená podle uživatele; při přepnutí účtu nesmí poskytovatel dál držet nastavení předchozího uživatele. Krátká změna vzhledu po načtení jiného účtu je samostatný problém od počátečního světlého probliknutí. Nepoužívat JWT jako úložiště vzhledu.

## Rozdělení implementace

```text
frontend/src/theme/
  types.ts              datový model a výchozí hodnoty
  preferences.ts        validace, úložiště, verze formátu
  palette.ts            odvození akcentů a kontrast
  bootstrap.ts          předběžná aplikace před renderem
  ThemeProvider.tsx     změny režimu a synchronizace
  tokens.css            hodnoty light/dark a Tailwind mapování
frontend/src/components/settings/
  AppearanceSettings.tsx
  AppearancePreview.tsx
  AccentPicker.tsx
```

Při převodu dávat přednost sdíleným tlačítkům, polím a stavovým štítkům. Neprovádět plošnou náhradu odstínů bez znalosti jejich účelu: `cyan` dnes znamená akci i informační stav a `slate` může být text, pozadí i výsledek. Globální předefinování všech odstínů by tyto významy smíchalo.

## Pořadí a vztah k úpravě Test Runs

1. Zavést preference, bootstrap, významové proměnné a dvě výchozí palety.
2. Převést společný rámec, login/loading, pracovní panely, formuláře, menu a dialogy.
3. Převést repository, execution a schvalování včetně historie, chyb, upozornění a diffů.
4. Při realizaci [návrhu Test Runs](test-runs-workspace-analysis.md) používat rovnou tyto proměnné; současnou stránku také pokrýt, pokud bude redesign dodán později.
5. Dokončit ostatní routy, přidat nastavení vzhledu a vlastní akcent s oběma náhledy.
6. Provést vizuální a funkční ověření; teprve potom zpřístupnit celé přepínání uživatelům.

Největší objem práce je převod a kontrola barev ve stávajících obrazovkách. Vlastní akcent přidává generování palety a validaci; plný editor všech barev přidává další kombinace k testování. Přesný časový odhad vyžaduje krátké ověření převodu reprezentativního execution panelu a dialogu.

## Ověření implementace

- Unit testy: neplatné preference/HEX, nedostupné úložiště, rozlišení system, kontrast a generování palety pro bílou, černou, žlutou, sytě červenou i výchozí akcent.
- Browser testy: reload, nové otevření, změna systémového režimu, druhá karta, uložení/reset/zrušení, klávesnice a přihlášení/odhlášení.
- Počáteční načtení ověřit i se zpomalenou sítí; finální screenshot sám nedokazuje absenci probliknutí.
- V obou režimech zkontrolovat všechny routy v `App.tsx`, včetně responsivního menu a nepřihlášeného loadingu. Pro vlastní akcent minimálně světlou, tmavou a sémanticky konfliktní barvu.
- Náhled obsahuje text, tlačítka, select, checkbox, odkaz, vybraný řádek, focus, chybovou zprávu a všechny výsledky. Kontrolovat i selected + hover současně.
- Ověřit menu, tooltipy, modální overlay, neaktivní prvky, placeholdery, grafy, schvalovací diff a nedoložené či neschválené definice.
- Vyhledat zbylé pevné barvy; výjimky jako favicon nebo záměrná ilustrace zdokumentovat.
- Spustit frontend build/typecheck, unit testy a smoke testy. Při synchronizaci účtu přidat backend testy validace a oddělení preferencí uživatelů.

## Výsledek analýzy

Dark mode a vlastní akcent lze dodat bez změny databáze. Doporučené minimum je **jednotné světlé/tmavé téma + automatický režim + vlastní akcent + náhled a reset**. Plné vlastní palety a synchronizace účtu jsou samostatná rozšíření. V tomto kroku vzniká pouze návrh, aplikační kód zůstává beze změny.
