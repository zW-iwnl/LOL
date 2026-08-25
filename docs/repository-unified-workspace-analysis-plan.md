# Repository – sjednocená navigace a test cases

> Projektové endpointy v tomto původním návrhu byly nahrazeny globálním repository. Viz [Jedno globální repository bez projektů](single-repository-architecture.md).

Datum: 2026-08-21
Stav: návrh k implementaci
Reference:

- `docs/Jak_ma_vypadat_repository/Nested_tree_view.png`
- `docs/Jak_ma_vypadat_repository/Folders_view.png`
- `docs/Jak_ma_vypadat_repository/Mind_map_view.png`

## Cíl

Přestavět Repository tak, aby navigace v test suitách a samotné test cases nebyly ve dvou oddělených kartách, ale tvořily jednu pracovní plochu. Všechny tři režimy musí zobrazovat stejná data a používat stejné výběry a akce:

- Nested tree view;
- Folders view;
- Mind map view.

Existující vyhledávač Repository a filtry Business oblast / Aplikace-doména / Objekt zůstanou zachované nad pracovní plochou. Jejich API, URL parametry a význam se v tomto refaktoru nemění.

## Hlavní zjištění z referencí

Reference neukazují tři varianty samostatného navigátoru. Každý režim je kompletní způsob práce s Repository.

### Nested tree view

- Vlevo je kompaktní strom suit s počty a rozbalováním.
- Vpravo jsou ve stejné ploše za sebou sekce rozbalených suit.
- Sekce suity obsahuje kontextové akce a její přímo přiřazené test cases.
- Hierarchie je čitelná současně ve stromu i odsazením sekcí.
- Test case není vykreslen v oddělené kartě pod navigátorem.

### Folders view

- Vlevo zůstává strom jako rychlá navigace.
- Vpravo se zobrazuje obsah právě otevřené úrovně.
- Obsah tvoří současně přímé test cases i přímé podsložky; uživatel mezi nimi nepřepíná.
- Výběr, hromadné označení a rychlé vytvoření test case jsou součástí pravého panelu.
- Celá plocha se chová jako průzkumník souborů.

### Mind map view

- Kořen, suity i test cases jsou uzly jednoho grafu.
- Suity jsou větvící uzly, test cases jsou koncové listy.
- Přidání test case nebo suity je kontextová akce uzlu.
- Graf není pouze navigace k seznamu umístěnému pod ním; sám je Repository.

### Projektové přizpůsobení reference

Reference obsahuje samostatný uzel „Test cases without suite“. V aktuálním Test Manageru byl tento virtuální uzel záměrně odstraněn. Test cases s `suite_id = null` proto budou ve všech režimech přímými dětmi virtuálního kořene **Počátek vesmíru**.

## Současný stav a rozdíl proti cíli

Aktuální `TestCasesPage.tsx` skládá stránku takto:

```text
RepositorySearch + filtry
Oblíbené suity
SuiteNavigator
Samostatná karta vybrané suity a test cases
Samostatný náhled vybraného test case
```

`SuiteNavigator` přepíná pouze vizualizaci suit. `NestedTreeView`, `FolderView` a `MindMapView` neznají test cases. Stránka následně znovu vykresluje hlavičku suity, akce, formulář a seznam test cases v další kartě.

Konkrétní nedostatky:

1. Navigace a obsah mají dva rámečky, dva vizuální začátky a duplicitní kontext vybrané suity.
2. Nested tree není skutečný nested obsah; je to pouze strom následovaný jedním seznamem.
3. Folders view nezobrazuje podsložky a test cases v jednom průzkumníku.
4. Mind map obsahuje jen suity, a proto po kliknutí vyžaduje přesun pozornosti do jiné části stránky.
5. Toolbar navigatoru a toolbar seznamu rozdělují související akce.
6. Náhled test case vytváří další samostatný sloupec mimo navigační plochu.
7. Starší dokument `test-suite-view-switcher-analysis.md` označil test cases v Mind mapě jako mimo rozsah. Nové reference toto rozhodnutí pro Repository nahrazují.

## Doporučené cílové rozložení

```text
PageHeader
┌ Existující RepositorySearch + existující filtry ┐
└───────────────────────────────────────────────────┘

┌ RepositoryWorkspace – jeden společný rámeček ──────────────────────────┐
│ Pohled: Nested | Folders | Mind map | rozbalení | Nová suita           │
├─────────────────────────────────────────────────────────────────────────┤
│ Obsah zvoleného režimu: navigace + suity + test cases                  │
│                                                                         │
│ Volitelně vložený formulář nového test case nebo interní detail panel  │
└─────────────────────────────────────────────────────────────────────────┘
```

Vyhledávač a filtry zůstanou v současné samostatné horní sekci. Sjednocení se týká všeho od přepínače pohledu dolů.

Samostatná karta „Oblíbené“ nebude stát mezi vyhledáváním a pracovní plochou. Oblíbené suity se zachovají jako kompaktní sekce v levém navigačním panelu nebo jako rozbalovací zkratky v toolbaru pracovní plochy.

## Chování společné pro všechny režimy

### Zdroj pravdy

- Vybraná suita zůstane v URL parametru `suite`.
- Kořen reprezentuje `suite_id = null` a URL parametr `suite` nemá.
- Vybraný test case zůstane lokální stav náhledu; při otevření plného detailu se použije existující route `/test-cases/{id}`.
- Přepnutí režimu zachová projekt, suitu, filtry, dotaz, vybrané checkboxy i otevřený formulář, pokud je jeho cílová suita stále viditelná.

### Test cases

- Vždy se zobrazují pouze test cases přímo přiřazené dané suitě.
- Kořen zobrazuje pouze test cases s `suite_id = null`.
- Tagové filtry ovlivní test cases ve všech třech režimech stejně.
- Suity zůstanou v navigaci i tehdy, když po aplikaci filtrů nemají žádný viditelný test case.
- Počty mohou zobrazit `filtrované / celkem`, když je aktivní některý tagový filtr; bez filtru stačí celkový počet.

### Akce

- „Nová suita“ vytvoří dítě aktuální suity; na kořeni vytvoří kořenovou suitu.
- „Nový test case“ předvyplní aktuální suitu; na kořeni uloží `suite_id = null`.
- Editace a smazání suity jsou dostupné pouze pro skutečnou suitu, ne pro Počátek vesmíru.
- Checkboxy a „Vybrat vše“ pracují s test cases viditelnými v aktuálním obsahovém panelu.
- Hromadné mazání používá již implementovaný endpoint a zachová současné hlášení částečného selhání.
- Kliknutí na test case otevře interní náhled; samostatný odkaz otevře plný detail.

### Formulář a náhled

- Formulář nového test case zůstane inline v `RepositoryWorkspace`, přímo u místa, odkud byl otevřen.
- Náhled test case nebude samostatná karta vedle celé pracovní plochy. Doporučený je pravý drawer uvnitř stejného rámečku, který lze zavřít bez změny výběru suity.
- Na menších obrazovkách se drawer skládá pod aktivní obsah.

## Režim 1 – Nested tree

### Layout

```text
┌ Levý strom 260–320 px ┬ Pravý hierarchický obsah ─────────────────────┐
│ Počátek vesmíru       │ Počátek vesmíru  [+ test]                    │
│ ├─ Suita A            │   přímé test cases kořene                    │
│ │  ├─ Suita A1        │ Suita A  [+ test] [edit] [delete]            │
│ │  └─ Suita A2        │   přímé test cases A                         │
│ └─ Suita B            │   Suita A1 ...                               │
└───────────────────────┴───────────────────────────────────────────────┘
```

### Pravidla

- Levý strom je sticky v rámci pracovní plochy a má vlastní vertikální scroll.
- Pravý panel vykreslí kořen a všechny suity ve viditelných rozbalených větvích.
- Každá sekce má hlavičku, přímé test cases, rychlé přidání a kontextové akce.
- Sbalení suity v levém stromu skryje její potomky i v pravém panelu.
- Kliknutí ve stromu vybere suitu a plynule odscrolluje odpovídající sekci vpravo.
- Scroll pravého panelu může zvýrazňovat aktuální sekci vlevo pomocí `IntersectionObserver`; není nutné měnit URL při každém scrollu.
- Výběr Počátku vesmíru zobrazí jeho přímé test cases jako první sekci, nikoli virtuální „Bez suity“.

## Režim 2 – Folders

### Layout

```text
┌ Levý strom 260–320 px ┬ Obsah aktuální úrovně ───────────────────────┐
│ celá hierarchie       │ breadcrumb / název / akce                   │
│                       │ Vybrat vše + přímé test cases               │
│                       │ Přímé podsložky jako kompaktní řádky/karty  │
└───────────────────────┴───────────────────────────────────────────────┘
```

### Pravidla

- Levý strom je shodný s levým stromem Nested view, aby se uživatel nemusel učit druhou navigaci.
- Pravý panel zobrazuje právě jednu úroveň.
- V jedné obsahové ploše jsou současně dvě sekce: přímé test cases nahoře a přímé podsuit(y) pod nimi, jako v referenci.
- Breadcrumb a tlačítko o úroveň výš zůstávají v pravém panelu.
- Kliknutí na podsložku ji otevře a aktualizuje `suite` v URL.
- Počátek vesmíru se chová jako běžná kořenová složka a obsahuje test cases s `suite_id = null`.
- Každá sekce má vlastní prázdný stav. Suita může mít test cases bez podsuit, podsuit(y) bez test cases, obojí současně nebo být úplně prázdná.

## Režim 3 – Mind map

### Layout a datový model

Mind map využije existující `@xyflow/react`, ale rozšíří graf o test cases:

```text
Počátek vesmíru
├─ TC bez suity
├─ Suita A
│  ├─ TC-1
│  ├─ TC-2
│  └─ Suita A1
└─ Suita B
```

Typ uzlu bude diskriminovaný:

```ts
type RepositoryMapNode =
  | { kind: "root" }
  | { kind: "suite"; suiteId: number }
  | { kind: "test-case"; testCaseId: number; suiteId: number | null };
```

### Pravidla

- Test cases jsou listové uzly s kódem a zkráceným názvem.
- Test cases bez suity jsou napojeny přímo na Počátek vesmíru.
- Kliknutí na suitu vybere větev; kliknutí na test case otevře interní náhled.
- `+` na suite otevře kontextovou nabídku „Nová podsuita“ / „Nový test case“.
- Sbalená suita skryje podsuitu i test-case listy pod ní a zobrazí počet skrytých položek.
- Zachová se pan, zoom, fit-to-view, fullscreen a zvýraznění cesty.
- Při aktivních tagových filtrech se vykreslí jen odpovídající test-case uzly; suite uzly zůstanou.
- Pro velké větve se nejprve zobrazí omezený počet test-case uzlů a agregační uzel „Dalších N“, který po kliknutí větev rozbalí. Doporučený počáteční limit je 30 přímých test cases na suitu.
- Mind map musí zachovat dostupný textový seznam uzlů pro klávesnici a screen reader; seznam bude obsahovat suity i test cases.

## Navržená komponentová architektura

Repository potřebuje vlastní kompozici, ale nemá duplikovat stromové utility používané stránkou Test Suites.

```text
frontend/src/components/repository/
  RepositoryWorkspace.tsx
  RepositoryWorkspaceToolbar.tsx
  RepositoryOutlineTree.tsx
  RepositoryNestedView.tsx
  RepositoryFoldersView.tsx
  RepositoryMindMapView.tsx
  RepositorySuiteSection.tsx
  RepositoryCaseList.tsx
  RepositoryCaseRow.tsx
  RepositoryPreviewDrawer.tsx
  repositoryModel.ts
```

Odpovědnosti:

- `RepositoryWorkspace`: jeden rámeček, společný toolbar, volba režimu a sdílené akce;
- `RepositoryOutlineTree`: levý strom pro Nested a Folders;
- `RepositoryNestedView`: synchronizovaný strom + sekce všech viditelných větví;
- `RepositoryFoldersView`: strom + obsah jedné úrovně;
- `RepositoryMindMapView`: suity a test cases v React Flow;
- `RepositoryCaseList`: checkboxy, select all, hromadné mazání a prázdný stav;
- `RepositorySuiteSection`: hlavička suity a její kontextové akce;
- `repositoryModel.ts`: čisté seskupení suit a test cases bez JSX.

Stávající komponenty zůstanou použitelné:

- `SuiteViewSwitcher` beze změny;
- `suiteTree.ts` jako zdroj indexu, předků a viditelných větví;
- `SuiteNavigator` pro stránku Test Suites;
- `RepositorySearch` a tagové filtry beze změny.

Nedoporučuje se přidávat další podmínky specifické pro Repository do současného `SuiteNavigator`. Výsledkem by byla komponenta s dvěma odlišnými odpovědnostmi: jednoduchá navigace pro Test Suites a kompletní workspace pro Repository.

## Odvozený model Repository

```ts
type RepositoryWorkspaceModel = {
  suiteIndex: SuiteIndex;
  directCasesBySuiteId: Map<number | null, TestCase[]>;
  filteredDirectCountBySuiteId: Map<number | null, number>;
  totalVisibleCaseCount: number;
};
```

Model se vytvoří jedním průchodem přes test cases a jedním průchodem přes suity v `useMemo`. Řazení test cases bude stabilní podle `code`, případně podle budoucího explicitního `sort_order`.

Invarianty:

- každý test case je právě v jedné skupině `suite_id` nebo `null`;
- kořenová skupina není falešná suita;
- změna filtru nemění suite index;
- všechny režimy dostávají stejný model a stejné callbacky;
- komponenty režimu nevolají API přímo.

## API a výkon

Databázová změna není nutná. První implementace může použít již načítaná data `getTestCases()` a `getTestSuites()`.

Současný endpoint test cases ale vrací i kroky a detailní pole, která strom, folder view ani mapa nepotřebují. Před nasazením na velké projekty je doporučen lehký read model:

```text
GET /api/projects/{project_id}/test-case-summaries
  ?business_area_id=
  &application_domain_id=
  &object_type_id=
```

Minimální odpověď:

```ts
type TestCaseSummary = {
  id: number;
  project_id: number;
  suite_id: number | null;
  code: string;
  title: string;
  status: TestCaseStatus;
  automated: boolean;
  business_area: TestCaseTag | null;
  application_domain: TestCaseTag | null;
  object_type: TestCaseTag | null;
};
```

Detail v draweru se může lazy načíst přes existující `GET /test-cases/{id}`. Tím se kroky nestahují pro každý řádek Repository.

Výkonová pravidla:

- levý strom virtualizovat až podle měření, ne preventivně;
- Nested pravý panel vykresluje jen rozbalené větve;
- Mind map nevykresluje test cases pod sbalenou suitou;
- transformace grafu a seskupení musí být v `useMemo`;
- `RepositoryCaseRow` memoizovat až po profileru;
- nad přibližně 500 současně viditelných řádků nebo 300 grafových uzlů provést měření a případně zavést virtualizaci/agregaci.

## Responzivita a přístupnost

- Desktop: levý outline + pravý obsah v jednom rámečku.
- Tablet: levý panel lze sbalit na ikonové tlačítko nebo drawer.
- Mobil: outline se otevře jako modal/drawer nad obsahem; aktivní obsah zůstane pod toolbarem.
- Nested a Folders musí být plně ovladatelné klávesnicí.
- Přesun focusu ze stromu na sekci nesmí způsobit neočekávaný page scroll.
- Checkboxy musí mít label s kódem test case.
- Kontextové ikonové akce musí mít český `aria-label` a tooltip.
- Mind map nesmí být jedinou cestou k test case; dostupný seznam uzlů zůstává povinný.

## Implementační plán

### Fáze 1 – společný model a základ workspace

1. Přidat `repositoryModel.ts` a jednotkové testy seskupení podle `suite_id`, kořenových test cases a filtrovaných počtů.
2. Vytvořit `RepositoryWorkspace` s jedním vnějším rámečkem a přesunout do něj toolbar pohledů a kontextové akce.
3. Přesunout současný formulář nového test case a preview do workspace bez změny jejich API.
4. Zachovat `RepositorySearch`, tagové filtry, URL parametry a serverové výsledky beze změny.
5. Integrovat oblíbené jako zkratky uvnitř levého panelu nebo toolbaru.

### Fáze 2 – Folders view jako první cílový režim

1. Vytvořit sdílený `RepositoryOutlineTree` z existujících funkcí `suiteTree.ts`.
2. Vytvořit dvoupanelový `RepositoryFoldersView`.
3. Do pravého panelu přesunout breadcrumb, hlavičku, přímé test cases, podsložky a všechny stávající akce.
4. Ověřit kořenové test cases pod Počátkem vesmíru.
5. Zachovat checkboxy, select all, mazání, tvorbu a editaci suit.

Folders view má být implementován první, protože nejvíce odpovídá současnému výběru jedné suity a přináší nejmenší riziko změny chování.

### Fáze 3 – Nested tree view

1. Znovu použít `RepositoryOutlineTree` v levém panelu.
2. Vytvořit `RepositorySuiteSection` a pravý seznam viditelných rozbalených sekcí.
3. Synchronizovat výběr stromu s odscrollováním sekce.
4. Doplnit kontextové akce a rychlé vytvoření pro každou sekci.
5. Doplnit jednotkové testy výpočtu viditelných sekcí a UI test synchronizace.

### Fáze 4 – Mind map s test cases

1. Rozšířit mapový model o diskriminované root/suite/test-case uzly.
2. Napojit test cases na jejich suitu a kořenové test cases na Počátek vesmíru.
3. Doplnit odlišné komponenty uzlu pro suitu a test case.
4. Doplnit kliknutí na test case, kontextové přidání a preview drawer.
5. Doplnit omezení velkých větví, agregační uzel a dostupný seznam všech viditelných uzlů.
6. Ověřit pan, zoom, fit-to-view, fullscreen, hledání a zvýraznění cesty.

### Fáze 5 – lehký API read model a stabilizace

1. Změřit payload a render na realistickém velkém projektu.
2. Pokud je detailní payload významný, přidat `TestCaseSummary` schema, service a endpoint.
3. Lazy načítat detail test case až při otevření draweru.
4. Doplnit responzivní outline drawer.
5. Odstranit z Repository starou kompozici `SuiteNavigator` + samostatná karta test cases; `SuiteNavigator` ponechat pro Test Suites.
6. Spustit celý backend test suite, frontend unit testy, build a smoke testy.

## Testovací plán

### Jednotkové testy

- seskupení test cases do správné suity;
- `suite_id = null` pod Počátkem vesmíru;
- stabilní řazení test cases;
- filtrované a celkové počty;
- viditelné sekce podle rozbalených větví;
- folder children pouze pro aktuální parent;
- mind-map hrany root → suite, suite → suite a suite/root → test case;
- agregační uzel pro velkou větev;
- zákaz parent možnosti na vlastní suitu a potomky při editaci.

### Komponentové a smoke testy

- přepnutí všech tří režimů bez ztráty výběru;
- Folders: levý strom a pravý obsah aktualizují stejnou suitu;
- Nested: kliknutí ve stromu odkryje a odscrolluje správnou sekci;
- Mind map: kliknutí na test case otevře správný preview;
- kořen zobrazí pouze test cases s `suite_id = null`;
- tagové filtry ovlivní všechny tři režimy stejně;
- vyhledání suity a test case funguje stejně jako před refaktorem;
- select all a hromadné mazání v kořeni i suitě;
- vytvoření test case do správné suity ze všech tří režimů;
- vytvoření, editace a smazání suity;
- reload a browser Back/Forward zachovají `view` a `suite`;
- mobilní otevření navigačního draweru;
- ovládání stromu a dostupného seznamu mapy klávesnicí.

## Akceptační kritéria

1. Pod zachovaným vyhledávačem a filtry je právě jeden hlavní rámeček Repository.
2. Navigace, suity a test cases jsou uvnitř tohoto rámečku ve všech třech režimech.
3. Folders view obsahuje levý strom a v pravém obsahu současně přímé test cases i přímé podsuit(y) aktuální úrovně.
4. Nested tree view obsahuje levý strom a pravé inline sekce viditelných suit s jejich test cases.
5. Mind map obsahuje Počátek vesmíru, suity i test cases jako propojené uzly.
6. Test cases bez suity jsou přímé děti Počátku vesmíru a nikde se neobjeví „Bez suity“.
7. Přepnutí režimu zachová aktivní projekt, suitu, dotaz a tagové filtry.
8. Stávající vytvoření a editace suity, vytvoření test case, checkboxy a hromadné mazání zůstanou funkční.
9. Formulář a náhled test case jsou součástí workspace, nikoli další samostatné karty stránky.
10. Stránka Test Suites zůstane funkční a může nadále používat `SuiteNavigator`.
11. Mind map je lazy načtená a má dostupnou alternativu pro klávesnici/screen reader.
12. Frontend unit testy, build a relevantní backend testy projdou.

## Rizika a mitigace

| Riziko | Dopad | Mitigace |
|---|---|---|
| Nested vykreslí příliš mnoho test cases | pomalý render | jen rozbalené větve, později virtualizace |
| Mind map bude přeplněná | nepoužitelný graf | sbalování, limit 30, agregační uzel |
| Sdílené komponenty se příliš větví podle stránky | obtížná údržba | Repository-specific kompozice nad společnými utilitami |
| Filtry skryjí cases, ale počty suit zůstanou globální | nejasné počty | při filtru zobrazit filtrované / celkem |
| Výběr ve stromu a scroll pravého panelu se zacyklí | poskakující UI | jeden zdroj výběru, scroll observer bez zápisu do URL |
| Detailní endpoint vrací kroky pro všechny cases | velký payload | následný `TestCaseSummary` read model a lazy detail |
| Refaktor rozbije Test Suites | regresní chyba | `SuiteNavigator` ponechat, nové komponenty omezit na Repository |

## Výsledné doporučení

Implementovat změnu jako nový `RepositoryWorkspace`, nikoli jako další rozšiřování současného `SuiteNavigator`. Začít Folders view, protože používá dnešní výběr jedné suity, potom doplnit Nested inline sekce a nakonec rozšířit Mind map o test-case uzly. Vyhledávač a filtry ponechat nad workspace beze změny po celou dobu implementace.

Tento dokument pro Repository nahrazuje části `docs/test-suite-view-switcher-analysis.md`, které popisují oddělený navigator a vylučují test cases z Mind mapy. Pro stránku Test Suites zůstává původní dokument platný.
