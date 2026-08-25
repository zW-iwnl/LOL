# Analýza: přepínání pohledů na Test Suites

> Projektové endpointy a preference v tomto původním návrhu byly nahrazeny globálním repository. Viz [Jedno globální repository bez projektů](single-repository-architecture.md).

Datum: 2026-08-21
Obrazovky: Repository a Test Suites
Stav: implementováno

## Cíl

Doplnit do Repository a Test Suites jednotný přepínač zobrazení hierarchie test suit. Uživatel bude moci pracovat se stejnými daty ve třech režimech:

- **Strom** – klasický vnořený strom.
- **Složky** – procházení po jedné úrovni podobně jako v průzkumníku souborů.
- **Myšlenková mapa** – vizuální graf suit a jejich parent-child vazeb.

Interní hodnoty budou anglicky:

```ts
type SuiteViewMode = "tree" | "folders" | "mind-map";
```

UI texty zůstanou česky podle pravidel projektu.

## Doporučené rozhodnutí

Použít jeden sdílený `SuiteNavigator` a jeden `SuiteViewSwitcher` pro obě stránky. Pohled mění pouze způsob navigace mezi suitami. Výběr suity, otevření test case a administrační operace mají ve všech režimech stejnou logiku.

Výchozí režimy:

- Repository: `folders`, protože odpovídá současnému procházení podsložek a test cases.
- Test Suites: `tree`, protože odpovídá současné správě hierarchie.

Volba se ukládá samostatně pro stránku a projekt. Přepnutí v Repository tedy bez překvapení nezmění pracovní pohled na stránce Test Suites.

## Současný stav

### Repository

`frontend/src/pages/TestCasesPage.tsx` nyní obsahuje:

- vlastní plochý strom v levém panelu;
- ruční stav sbalených suit;
- oblíbené a naposledy otevřené suity v `localStorage`;
- folder-like obsah aktuální suity v hlavním panelu;
- tabulkový modal `SuiteMapModal`, který se jmenuje mapa, ale není grafem;
- URL parametr `suite` pro vybranou suitu.

Repository tedy už částečně implementuje režimy Strom a Složky, ale jako dvě současně zobrazené a vzájemně provázané části stránky.

### Test Suites

`frontend/src/pages/TestSuitesPage.tsx` nyní obsahuje:

- druhou, samostatnou implementaci stromu;
- lazy načítání potomků přes `/test-suites/{id}/children`;
- vybranou suitu pouze v lokálním React stavu;
- detail suity, editaci a seznam přímo přiřazených test cases;
- vyhledávání přes samostatný endpoint.

### API

`GET /projects/{project_id}/test-suites` již vrací všechna data potřebná pro první verzi všech tří pohledů:

- `id`;
- `parent_suite_id`;
- `name`;
- `path`;
- `level`;
- `sort_order`;
- `is_active`;
- `direct_test_case_count`;
- `total_test_case_count`.

Databázová migrace ani nový endpoint nejsou pro první verzi potřeba.

## Umístění přepínače

Použít segmentovaný přepínač se třemi tlačítky:

| Hodnota | Český popisek | Ikona | Účel |
|---|---|---|---|
| `tree` | Strom | `ListTree` | rychlý přehled celé hierarchie |
| `folders` | Složky | `Folder` | postupné procházení jedné úrovně |
| `mind-map` | Myšlenková mapa | `Workflow` nebo `Network` | prostorová orientace ve velké struktuře |

Na desktopu budou viditelné všechny tři textové volby. Na menší šířce se přepínač změní na tlačítko s menu, aby nezabíral celý řádek.

Umístění:

- Repository: v toolbaru sekce Suity místo současného samostatného tlačítka „Mapa suit“.
- Test Suites: v horním toolbaru pod `PageHeader`, vedle hledání a obnovení dat.

Přepínač nesmí být pouze ikonový. Aktivní volba musí mít `aria-pressed="true"` a jasný vizuální stav.

## Chování jednotlivých pohledů

### 1. Strom

Strom zobrazí suity jako vnořené řádky.

Každý řádek obsahuje:

- ovládání rozbalit/sbalit;
- název;
- počet test cases včetně podsuit;
- indikaci aktivní/neaktivní suity;
- zvýraznění vybrané suity.

Chování:

- kliknutí na název vybere suitu;
- kliknutí na chevron pouze změní rozbalení;
- výběr výsledku hledání automaticky odkryje předky;
- „Rozbalit vše“ a „Sbalit vše“ jsou dostupné jen v tomto režimu;
- klávesy šipka nahoru/dolů mění aktivní řádek, vlevo/vpravo sbalují a rozbalují.

Repository po výběru zobrazí test cases dané suity. Test Suites po výběru zobrazí detail, editaci a test cases dané suity.

### 2. Složky

Složky zobrazí pouze přímé potomky aktuální suity.

Obsah:

- breadcrumb od kořene k aktuální suitě;
- tlačítko „O úroveň výš“;
- karty přímých podsuit;
- počet přímých a celkových test cases;
- stav suity;
- prázdný stav pro suitu bez potomků.

Repository pod kartami suit zobrazí test cases přímo přiřazené aktuální suitě. Zachová také virtuální položku „Bez suity“.

Test Suites vedle nebo pod folder browserem zachová detail a administrační formuláře. Výběr složky nesmí automaticky spouštět editaci.

Interakce:

- jedno kliknutí vybere složku;
- dvojklik nebo Enter ji otevře;
- breadcrumb umožní skok na libovolného předka;
- kořen projektu je virtuální uzel a neukládá se do databáze.

### 3. Myšlenková mapa

Myšlenková mapa je read-only navigační graf. V první verzi nebude sloužit k přesouvání suit.

Každá suita je uzel s:

- názvem;
- počtem přímých a celkových test cases;
- stavem;
- indikací oblíbené suity v Repository;
- indikací skrytých potomků, pokud je větev sbalená.

Hrany reprezentují výhradně `parent_suite_id`. Jednotlivé test cases se do grafu nevykreslují, protože by výrazně zvýšily počet uzlů. Po výběru suity se zobrazí ve standardním seznamu nebo detailním panelu stránky.

Povinné ovládání:

- pan;
- zoom;
- přizpůsobit obsah obrazovce;
- návrat na kořen;
- rozbalení/sbalení větve;
- zvýraznění cesty od kořene k vybranému uzlu;
- vycentrování výsledku hledání.

Doporučené rozložení je zleva doprava: kořenové suity vlevo, potomci směrem doprava. Volné ruční přesouvání uzlů se nebude ukládat.

Pro implementaci je vhodné oddělit převod dat a layout od konkrétní vykreslovací knihovny. Současný frontend žádnou graph/canvas závislost nemá, proto má implementaci Mind map předcházet krátký technický spike zaměřený na velikost bundle, přístupnost a výkon. Ručně implementovaný pan/zoom a routing hran není vhodný jako součást základního refaktoru.

## Rozložení obrazovek

### Repository

```text
PageHeader
Filtry test cases
┌ Suite toolbar: hledání | Strom | Složky | Myšlenková mapa | Nová suita ┐
├ Suite navigator podle zvoleného režimu                              ┤
└─────────────────────────────────────────────────────────────────────┘
┌ Test cases vybrané suity ───────────────┬ Náhled vybraného test case ┐
└─────────────────────────────────────────┴────────────────────────────┘
```

Současný `SuiteMapModal` bude nahrazen inline pohledem Myšlenková mapa. Tabulkovou mapu není nutné držet jako čtvrtý režim; její informace pokryjí folder karty a mind map uzly.

### Test Suites

```text
PageHeader
┌ Hledání | Strom | Složky | Myšlenková mapa | Obnovit ┐
├ Suite navigator podle zvoleného režimu                 ┤
└─────────────────────────────────────────────────────────┘
┌ Detail vybrané suity ─────┬ Test cases ─────┬ Editace / vytvoření ┐
└───────────────────────────┴──────────────────┴──────────────────────┘
```

Tím zůstane navigace stejná v obou modulech a administrační obsah Test Suites nebude duplikován v jednotlivých pohledech.

## Sdílený stav a URL

Zdroj pravdy:

1. platný URL parametr;
2. uložená preference pro projekt a stránku;
3. výchozí režim stránky.

URL:

```text
/test-cases?view=folders&suite=42
/test-suites?view=mind-map&suite=42
```

`view` smí mít pouze `tree`, `folders` nebo `mind-map`. Neplatná hodnota se nahradí výchozí hodnotou.

Navržené klíče:

```text
fet-suite-view:repository:{projectId}
fet-suite-view:suites:{projectId}
```

Další pravidla:

- změna pohledu zachová `suite`, hledání a tagové filtry;
- Test Suites začne používat URL parametr `suite`, aby fungovalo obnovení stránky a browser Back/Forward;
- po změně projektu se ověří, zda vybraná suita patří do nového projektu;
- po smazání vybrané suity se vybere její rodič, případně kořen;
- rozbalené větve jsou lokální stav konkrétního pohledu a nemusí se přenášet mezi Stromem a Mind mapou.

## Technická architektura

Navržená struktura:

```text
frontend/src/components/test-suites/
  SuiteViewSwitcher.tsx
  SuiteNavigator.tsx
  NestedTreeView.tsx
  FolderView.tsx
  MindMapView.tsx
  SuiteNodeCard.tsx
  suiteTree.ts
  useSuiteViewState.ts
```

Odpovědnosti:

- `SuiteViewSwitcher`: pouze volba režimu a přístupnost;
- `SuiteNavigator`: společné hledání, toolbar, loading/error/empty stavy a výběr konkrétního pohledu;
- `suiteTree.ts`: čisté funkce pro indexaci, předky, potomky a viditelné větve;
- `NestedTreeView`: vykreslení hierarchických řádků;
- `FolderView`: breadcrumb a přímé děti;
- `MindMapView`: uzly, hrany, layout a viewport;
- stránky: načtení dat, URL integrace a obsah po výběru suity.

Společný odvozený model:

```ts
type SuiteIndex = {
  byId: Map<number, TestSuite>;
  childrenByParentId: Map<number | null, TestSuite[]>;
  roots: TestSuite[];
};
```

Děti se řadí podle `sort_order`, následně podle českého `name`. `path` a `level` se používají jako zobrazovací a validační data, ne jako jediný zdroj hierarchie.

## API a výkon

Pro první verzi používat na obou stránkách plochý endpoint `GET /projects/{project_id}/test-suites`. Tím se odstraní rozdíl mezi eager Repository a lazy Test Suites a všechny pohledy budou pracovat se stejným snapshotem dat.

Existující endpointy `/tree` a `/{id}/children` není nutné ihned odstranit. Po stabilizaci sdíleného navigatoru lze vyhodnotit, zda jsou ještě používány.

Výkonová pravidla:

- index stromu vytvořit jedním průchodem v `useMemo`;
- nevykreslovat test cases jako mind map uzly;
- při větším stromu zobrazit v Mind mapě nejprve kořeny a omezený počet úrovní;
- layout přepočítávat jen při změně dat nebo viditelných větví;
- vyhledání uzlu musí odkrýt a vycentrovat pouze relevantní větev;
- pro skutečné produkční limity nejprve změřit počet suit na projekt.

Pokud projekty běžně překročí přibližně 500–1000 suit, bude nutné samostatně vyhodnotit virtualizaci stromu a lazy data pro Mind map. Jde o pracovní hranici k ověření, nikoliv databázový limit.

## Hledání a filtry

Jeden vyhledávací vstup má stejné výsledky ve všech režimech:

- Strom: zobrazí shody a jejich předky;
- Složky: nabídne globální výsledky a po výběru otevře příslušnou cestu;
- Myšlenková mapa: odkryje větev, zvýrazní uzel a vycentruje viewport.

Repository zachová stávající hledání test cases i suit a tagové filtry. Parametr `type` používaný pro druh výsledku repository search se nesmí zaměnit s novým parametrem `view`.

Filtry test cases nemění počet suit v navigaci. Počty na suitách představují celková data projektu; filtrovaný počet lze případně doplnit později jako druhou hodnotu.

## Přístupnost a responzivita

- všechny režimy musí umožnit výběr suity klávesnicí;
- tlačítka přepínače mají text, tooltip a `aria-pressed`;
- strom používá odpovídající `tree`/`treeitem` role nebo rovnocennou klávesovou navigaci;
- Mind map musí mít dostupný seznam uzlů pro screen reader a nesmí být jedinou cestou k suitě;
- zoom nesmí měnit čitelnost celé stránky;
- na mobilu se detail a test cases skládají pod navigator;
- Mind map má minimální výšku a tlačítko pro otevření na celou dostupnou plochu.

## Co není součástí první verze

- drag-and-drop přesouvání suit;
- ukládání ručních pozic uzlů;
- test cases jako uzly Mind mapy;
- úprava názvu nebo parent vazby přímo v grafu;
- čtvrtý tabulkový režim;
- databázové změny.

Přesun pomocí drag-and-drop by vyžadoval samostatné řešení oprávnění, cyklů, potvrzení operace, optimistic update a rollbacku.

## Implementační fáze

Relativní odhad:

| Část | Složitost | Riziko |
|---|---|---|
| Sdílený index, URL stav a přepínač | střední | nízké |
| Strom a Složky na obou stránkách | střední | střední |
| Myšlenková mapa | vysoká | vysoké |
| Přístupnost, výkon a stabilizace | střední | střední |

Celá změna je větší frontendový refaktor. Nejbezpečnější je dodávat ji po fázích, přičemž každá fáze ponechá aplikaci použitelnou.


### Fáze 1 – sjednocení dat a stavu

1. Vytvořit `suiteTree.ts` a testy čistých transformačních funkcí.
2. Přidat `useSuiteViewState` s URL a `localStorage`.
3. Doplnit `suite` URL parametr do Test Suites.
4. Přepnout Test Suites na společný plochý seznam suit.

### Fáze 2 – Strom a Složky

1. Vytvořit `SuiteViewSwitcher`.
2. Extrahovat současný strom do `NestedTreeView`.
3. Extrahovat současné folder procházení Repository do `FolderView`.
4. Integrovat oba režimy do Repository a Test Suites.
5. Zachovat výběr suity při přepnutí pohledu.

### Fáze 3 – Myšlenková mapa

1. Udělat technický spike vykreslovací vrstvy.
2. Připravit převod viditelných suit na uzly a hrany.
3. Doplnit layout, pan, zoom a fit-to-view.
4. Doplnit sbalování větví, hledání a zvýraznění cesty.
5. Nahradit stávající `SuiteMapModal`.

### Fáze 4 – stabilizace

1. Doplnit klávesovou navigaci a screen-reader popisky.
2. Ověřit chování na mobilu.
3. Změřit výkon na velkém fixture stromu.
4. Odstranit nepoužívanou duplicitní tree/map logiku a případně staré API klienty.

## Testovací scénáře

### Jednotkové testy

Frontend nyní nemá nakonfigurovaný jednotkový test runner. Součástí první fáze proto musí být buď jeho cílené doplnění pro čisté funkce, nebo ekvivalentní ověření těchto invariantů v existujících smoke testech. Doporučená je první varianta.

- vytvoření indexu z neuspořádaného seznamu suit;
- správné řazení sourozenců;
- nalezení předků a potomků;
- odhalení chybějícího parentu nebo cyklu;
- výpočet viditelných uzlů sbaleného stromu;
- validace a fallback hodnoty `view`.

### UI / smoke testy

- přepnutí všech tří režimů na obou stránkách;
- zachování vybrané suity při přepnutí;
- obnovení stránky se stejným `view` a `suite`;
- browser Back/Forward;
- výběr suity z hledání v každém režimu;
- změna projektu;
- odstranění právě vybrané suity;
- prázdný projekt;
- neaktivní suita;
- Mind map pan, zoom a fit-to-view;
- ovládání přepínače a stromu klávesnicí.

## Akceptační kritéria

1. Repository i Test Suites obsahují stejný přepínač Strom / Složky / Myšlenková mapa.
2. Přepnutí pohledu nezmění vybranou suitu ani aktivní projekt.
3. Výběr suity ve všech režimech používá stejný callback a aktualizuje URL.
4. Repository po výběru stále zobrazí správné test cases.
5. Test Suites po výběru stále zobrazí správný detail, editaci a test cases.
6. Strom umožňuje rozbalení, sbalení a odkrytí výsledku hledání.
7. Složky zobrazují pouze přímé potomky a funkční breadcrumb.
8. Myšlenková mapa zobrazuje správné parent-child vazby a podporuje pan, zoom a fit-to-view.
9. Mind map neumožňuje nechtěnou změnu parent vazby.
10. Volba pohledu přežije reload a je oddělená pro projekt i stránku.
11. Všechny tři režimy mají loading, error a empty stav.
12. Backendové testy a frontendový build zůstávají zelené.

## Rizika a mitigace

| Riziko | Dopad | Mitigace |
|---|---|---|
| Tři odlišné kopie logiky výběru | rozdílné chování a chyby | jeden `SuiteNavigator` a callback `onSelectSuite` |
| URL parametr `type` už používá repository search | kolize stavů | pro pohled používat výhradně `view` |
| Mind map bude příliš hustá | nepoužitelný graf | sbalené větve, omezení úrovní, hledání a fit-to-view |
| Velký bundle grafické knihovny | pomalejší načtení | technický spike a lazy import pouze pro `mind-map` |
| Rozdílná data mezi stránkami | nekonzistentní počty a výběr | jednotný plochý endpoint a společný index |
| Změna parentu rozbije path | nekonzistentní navigace | v první verzi žádný drag-and-drop; změny jen existujícím formulářem |
| Mind map nebude přístupná | část uživatelů se k suitě nedostane | dostupný seznam uzlů a plnohodnotný Strom/Složky |

## Výsledné doporučení

Implementovat nejprve společný datový model, URL stav a režimy Strom/Složky. Myšlenkovou mapu přidat jako samostatnou třetí fázi po krátkém technickém spike. Tento postup přinese jednotné ovládání do obou obrazovek ještě před zavedením nejsložitější vizualizace a sníží riziko, že vznikne třetí samostatná implementace práce se suitami.

Tato analýza rozšiřuje a sjednocuje dřívější dokument `docs/interactive-test-suite-map-plan.md`.
