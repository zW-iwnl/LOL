# Čisté Repository bez stromu test suit

Datum analýzy: 28. 8. 2026

## Cíl

Kompletně odstranit z Repository původní „cibulový“ systém založený na stromu
test suit a několika paralelních pohledech. V Repository zůstanou pouze:

- skupiny;
- test suity;
- test cases;
- tagy.

Test suity budou ploché položky, které mohou patřit do libovolného počtu skupin.
Skupiny budou moci být vložené do více dalších skupin. Test case bude vždy
povinně patřit právě do jedné test suity.

„Skupiny ve skupině opakovaně“ tato analýza interpretuje jako možnost jedné
skupiny patřit do více různých nadřazených skupin. Duplicitní vložení stejné
skupiny pod stejného rodiče povolené nebude.

## Závěr

Jde o změnu databázové architektury, API i hlavní obrazovky Repository, nikoliv
jen o úpravu frontendového zobrazení.

Současný „cibulový“ systém je tvořen zejména:

- stromem test suit přes `parent_suite_id`, `path` a `level`;
- virtuálním kořenem „Počátek vesmíru“;
- test cases bez suity přes `suite_id = NULL`;
- pohledy Strom, Složky, Myšlenková mapa a Skupiny;
- skupinami s nejvýše jedním rodičem přes `parent_group_id`.

Cílově budou test suity ploché a veškerou organizační strukturu převezmou
skupiny.

## Cílový datový model

```text
Skupina ── M:N ── Skupina
   │
   ├────── M:N ── Test suite
   │                    │
   │                    └── 1:N ── Test case
   │                                  │
   └──── volitelně M:N ───────────────┘
                                      │
                                      └── M:N ── Tag
```

### Hlavní pravidla

- Test suite již nemá rodičovskou test suitu.
- Test suite může být v nule až neomezeném počtu skupin.
- Skupina může být současně v několika nadřazených skupinách.
- Skupiny tvoří acyklický graf, nikoliv strom s jediným rodičem.
- Test case musí patřit právě do jedné test suity.
- Test case může být volitelně přímo označen ve více skupinách, ale jeho
  skutečným vlastníkem vždy zůstává test suite.
- Tagy zůstávají přiřazené test casům. Test suity a skupiny je pouze zdědí pro
  vyhledávání, filtrování a agregované počty.

## Databázové změny

| Současný stav | Cílový stav |
|---|---|
| `test_suites.parent_suite_id` | odstranit |
| `test_suites.path` | odstranit |
| `test_suites.level` | odstranit |
| `suite_groups.parent_group_id` | odstranit |
| Jediný rodič skupiny | nová M:N tabulka `suite_group_relations` |
| `test_cases.suite_id` nullable | změnit na `NOT NULL` |
| `suite_group_members` | zachovat |
| `suite_group_test_case_members` | zachovat jako volitelný organizační výběr |
| Stromové endpointy | odstranit |

### Nová tabulka vazeb skupin

```text
suite_group_relations
- parent_group_id
- child_group_id
- sort_order
- created_at
- updated_at

PRIMARY KEY (parent_group_id, child_group_id)
CHECK (parent_group_id <> child_group_id)
```

Doporučené databázové prvky:

- FK `parent_group_id -> suite_groups.id` s `ON DELETE CASCADE`;
- FK `child_group_id -> suite_groups.id` s `ON DELETE CASCADE`;
- index `(parent_group_id, sort_order, child_group_id)`;
- index `(child_group_id, parent_group_id)`;
- unikátní dvojice rodič–dítě pomocí složeného primárního klíče.

Úplný zákaz cyklů nelze jednoduše vyjádřit běžným `CHECK` omezením. Backend musí
před vložením vazby rekurzivně ověřit, že dítě již nedosahuje k rodiči. U
souběžných zápisů je vhodné použít transakční zamčení nebo databázový trigger,
aby dva paralelní požadavky nemohly společně vytvořit cyklus.

### Pořadí položek

Protože jedna skupina může být pod více rodiči, její pořadí nemůže být pouze
vlastností samotné skupiny. `sort_order` musí být uložený na vazbě
`suite_group_relations`.

Stejný princip již správně používá členství suit ve skupinách, kde je pořadí
uložené v `suite_group_members`.

## Povinná test suite u test case

Povinnost musí být vynucená ve všech vrstvách:

- `test_cases.suite_id` bude databázově `NOT NULL`;
- `TestCaseCreate.suite_id` bude povinné číslo;
- update test case odmítne `suite_id: null`;
- formulář bez vybrané suity nepůjde odeslat;
- hromadný přesun nebude nabízet „Počátek vesmíru“;
- akce „Odebrat ze suity“ se změní na „Přesunout do jiné suity“;
- smazání suity obsahující test cases zůstane zakázané.

Test case bude mít jednu kanonickou test suitu. Případná přímá členství test case
ve skupinách budou pouze organizační odkazy a nebudou měnit jeho vlastnictví.

## Přímá vazba skupina–test case

Současná aplikace umožňuje přidat do skupiny konkrétní test cases bez změny
jejich suity. Tato analýza doporučuje tabulku `suite_group_test_case_members`
v první verzi zachovat, protože:

- neporušuje pravidlo povinné suity;
- podporuje existující kurátorované výběry test casů;
- zabraňuje ztrátě již uložených vazeb;
- skupina může kombinovat celé suity a jednotlivé důležité test cases.

Při zobrazování a počítání obsahu skupiny musí být výsledkem sjednocení:

1. test cases z test suit přímo nebo nepřímo dostupných přes skupiny;
2. explicitně přidaných test casů;
3. obsahu podřazených skupin.

Stejný test case se při více cestách započítá pouze jednou pomocí `DISTINCT`.

Pokud bude později rozhodnuto, že skupiny smějí obsahovat pouze test suity, lze
přímou vazbu odstranit samostatnou migrací. Není nutné ji odstraňovat současně
se stromem suit.

## Nové Repository UI

Repository již nebude mít přepínač:

- Strom;
- Složky;
- Myšlenková mapa;
- Skupiny.

Doporučená je jedna stránka Repository se čtyřmi záložkami.

### Skupiny

- seznam a vyhledávání skupin;
- více nadřazených a podřazených skupin;
- přidávání a odebírání test suit;
- volitelné přidávání konkrétních test casů;
- filtrování podle zděděných tagů;
- ochrana před cyklickým vložením;
- zobrazení všech nadřazených skupin, nikoliv jedné breadcrumb cesty.

Protože skupina může mít více rodičů, klasická stromová breadcrumb navigace není
jednoznačná. Detail skupiny má místo ní zobrazit samostatné seznamy
„Nadřazené skupiny“ a „Podřazené skupiny“.

### Test suity

- plochá filtrovatelná tabulka;
- multi-select skupin;
- počet test casů;
- stav aktivní/neaktivní;
- virtuální filtr „Bez skupiny“;
- žádný parent, path, level nebo podsuita.

### Test cases

- povinná test suite;
- tagy a stav;
- vyhledávání a filtrování;
- přesun pouze mezi existujícími test suitami;
- žádný virtuální kořen ani test case bez suity.

### Tagy

- správa tagových číselníků;
- rozdělení podle kategorií;
- počty použití;
- vyhledávání hodnot;
- současnou samostatnou navigaci „Nastavení comboboxů“ lze po přesunu odstranit.

## API změny

### Odstranit

```text
GET /test-suites/tree
GET /test-suites/{suite_id}/children
GET /suite-groups/tree
```

Z payloadů test suite odstranit:

- `parent_suite_id`;
- `path`;
- `level`.

Z payloadů skupiny odstranit `parent_group_id`.

### Přidat

```text
POST   /suite-groups/{parent_group_id}/children
DELETE /suite-groups/{parent_group_id}/children/{child_group_id}
PUT    /suite-groups/{group_id}/parents
```

Příklad vložení dítěte:

```json
{
  "child_group_id": 42,
  "sort_order": 0
}
```

Bulk endpoint pro rodiče:

```json
{
  "parent_group_ids": [3, 7, 18]
}
```

Výsledek skupiny má obsahovat `parent_ids` a `child_ids`, nikoliv jeden
`parent_group_id`.

Existující M:N správa členství test suit přes `group_ids` může zůstat.

### Repository search

Repository vyhledávání již nebude vracet `suite_path`. Výsledek test suite má
vracet například:

- `id`;
- `name`;
- `group_ids` nebo stručný seznam skupin;
- `test_case_count`;
- zděděné tagy.

Vyhledávání skupin musí procházet graf přes rekurzivní CTE s deduplikací.
`UNION ALL` bez evidence navštívených uzlů není bezpečné, protože stejná skupina
může být dosažená více cestami.

## Migrace existujících dat

Migrace musí být provedena jako řízený expand/contract postup, ne jako jediný
nevratný zásah.

### 1. Datový audit

Před změnou zjistit:

- počet test casů s `suite_id IS NULL`;
- počet suit s rodičem;
- maximální hloubku stromu suit;
- duplicitní názvy suit v různých větvích;
- počet skupin a jejich hloubku;
- počet přímých vazeb skupina–test case;
- test cases nebo suity dosažitelné více organizačními cestami.

### 2. Test cases bez suity

Pro existující orphan test cases vytvořit technickou suitu například:

```text
Migrace – nezařazené test cases
```

Všechny test cases bez suity do ní převést. Až poté lze nastavit databázové
`NOT NULL`.

Alternativou je zablokovat migraci a vyžádat ruční zařazení, ale automatická
technická suita je bezpečnější a nezpůsobí ztrátu dat.

### 3. Převod současných skupin

Pro každý současný záznam s `parent_group_id` vložit odpovídající záznam do
`suite_group_relations`. Kořenová skupina nebude mít žádnou příchozí vazbu.

Po ověření počtů a grafu lze `parent_group_id` odstranit.

### 4. Převod stromu test suit

Odstranění stromu nesmí zahodit existující organizační informaci. Bezpečná
automatická varianta:

1. pro každou původní test suitu vytvořit migrační skupinu;
2. vazby migračních skupin zkopírují původní `parent_suite_id`;
3. původní test suite se vloží do odpovídající migrační skupiny;
4. test suite i všechny její test cases si ponechají původní ID;
5. po ověření se odstraní `parent_suite_id`, `path` a `level`.

Migrační skupiny je vhodné zařadit pod společnou skupinu například
„Původní struktura test suit“, aby se nepletly s již existujícími ručně
vytvořenými skupinami.

Výsledkem může být dočasně skupina a suite se stejným názvem. Jde o cenu za
bezeztrátovou automatickou migraci. Následné slučování a přejmenování může být
uživatelské nebo realizované samostatným cleanupem.

### 5. Odstranění stromových sloupců

Sloupce odstranit až poté, co:

- jsou všechny test cases přiřazené k suitě;
- je původní struktura zachycená ve skupinách;
- nové API i frontend čtou nový model;
- proběhla kontrola počtů a vazeb.

## Mazání a přesuny

### Skupina

- Smazání skupiny odstraní pouze její vztahy k rodičům, dětem, suitám a
  explicitním test casům.
- Test suity ani test cases se nesmažou.
- Odebrání jedné rodičovské vazby nesmí odstranit ostatní rodiče skupiny.

### Test suite

- Smazání suity s test cases bude odmítnuto.
- Smazání prázdné suity odstraní její členství ve skupinách.
- Odebrání suity ze skupiny nesmaže suitu ani její test cases.
- Test suite může zůstat bez skupiny.

### Test case

- Test case nelze odebrat ze suity bez současného výběru jiné suity.
- Přesun mezi suitami proběhne v jedné transakci.
- Historické `TestRunCase` snapshoty a výsledky zůstanou zachované.

## Názvy a identita

Po odstranění `path` mohou mít dvě ploché test suity stejný název a jejich výběr
by byl nejednoznačný. Před implementací je nutné rozhodnout jednu z variant:

1. globálně unikátní název test suite;
2. nový globálně unikátní kód test suite;
3. duplicitní názvy povolit a v UI vždy zobrazovat ID a skupiny.

Doporučená je varianta s unikátním krátkým kódem test suite. Umožní zachovat
uživatelské názvy a současně poskytne stabilní identifikaci v importech,
vyhledávání a integracích.

U skupin je vhodné použít stejný princip nebo alespoň interní unikátní slug,
protože jedna skupina může být zobrazená pod více rodiči.

## Dopad do backendu

Hlavní oblasti změn:

- SQLAlchemy modely `TestSuite`, `SuiteGroup`, `TestCase`;
- nové vztahy skupina–skupina;
- Pydantic schémata;
- služby test suit a skupin;
- Repository search;
- agregace tagů a počtů přes graf;
- Alembic migrace;
- odstranění stromových endpointů;
- validace povinné suity;
- testy cyklů, více rodičů a migrace.

## Dopad do frontendu

Odstranit nebo nahradit:

- `SuiteViewSwitcher`;
- `RepositoryFoldersView`;
- `RepositoryNestedView`;
- `RepositoryMindMapView`;
- stromové utility `suiteTree.ts`;
- virtuální výběr `root`;
- ukládání stavu rozbalených stromových větví;
- pole parent suite ve formulářích;
- zobrazení `path` a `level`;
- všechny akce přesouvající test case do „Počátku vesmíru“.

Nahradit jednou Repository stránkou se záložkami Skupiny, Test suity,
Test cases a Tagy.

## Testovací scénáře

### Skupiny

- skupina může mít více rodičů;
- skupina může mít více dětí;
- odebrání jednoho rodiče zachová ostatní;
- duplicitní hrana je odmítnuta;
- přímý i nepřímý cyklus je odmítnut;
- jedna suite může být v libovolném počtu skupin;
- stejný test case se při více cestách započítá jednou;
- tagy se správně dědí přes více cest grafem.

### Test suity

- suite nemá parent, path ani level;
- suite může být bez skupiny;
- suite může být ve více skupinách;
- odebrání členství nemaže suitu;
- suitu s test cases nelze smazat.

### Test cases

- vytvoření bez suity vrátí 422;
- update na `suite_id: null` vrátí 422;
- přesun mezi suitami funguje;
- tagy, kroky, requirements a Test Runs zůstávají funkční.

### Migrace

- žádný test case po migraci nemá `suite_id IS NULL`;
- počet suit a test casů se nezmění;
- ID suit a test casů se nezmění;
- původní strom je dohledatelný v migračních skupinách;
- existující skupinová členství zůstanou zachována;
- downgrade nebo záložní návrat je předem ověřený.

## Doporučené pořadí implementace

1. Potvrdit význam více rodičů skupiny a pravidla názvů.
2. Provést datový audit produkční databáze.
3. Přidat `suite_group_relations` a převést současné rodiče skupin.
4. Upravit API skupin na více rodičů a doplnit ochranu před cykly.
5. Zařadit všechny orphan test cases do technické suity.
6. Nastavit `test_cases.suite_id NOT NULL` a upravit validační vrstvu.
7. Převést původní strom suit do migračních skupin.
8. Přepnout test suity na plochý model.
9. Implementovat nové Repository se čtyřmi záložkami.
10. Přesunout správu tagů do Repository.
11. Odstranit staré stromové endpointy a frontendové komponenty.
12. Po ověření odstranit staré databázové sloupce.
13. Spustit kompletní backend, frontend a migrační testy.

## Rizika

| Riziko | Dopad | Opatření |
|---|---|---|
| Ztráta původního pořadí suit | uživatelé nenajdou data | převést strom do migračních skupin |
| Orphan test cases blokují `NOT NULL` | migrace selže | technická migrační suite |
| Cyklus mezi skupinami | nekonečné rekurzivní dotazy | validační CTE a transakční ochrana |
| Více cest násobí počty | chybné KPI a tagy | `UNION` a `COUNT(DISTINCT test_case_id)` |
| Duplicitní názvy po odstranění path | nejednoznačné UI | unikátní kód/slug |
| Jednorázový breaking deploy | výpadek aplikace | expand/contract migrace ve více fázích |
| Odstranění přímých group-case vazeb | ztráta kurátorovaných výběrů | v první verzi vazby zachovat |

## Rozhodnutí potřebná před implementací

1. Potvrdit, že jedna skupina smí mít více rodičů.
2. Rozhodnout, zda se přímé vazby skupina–test case dlouhodobě zachovají.
3. Rozhodnout způsob unikátní identifikace plochých test suit.
4. Potvrdit automatický převod původního stromu do migračních skupin.
5. Rozhodnout, zda se samostatná stránka Test Suity odstraní, nebo pouze
   přesměruje na záložku Repository → Test suity.

## Doporučení

Implementovat změnu jako nový čistý model Repository, nikoliv postupným
větvením současných stromových komponent. Nejdříve rozšířit databázi a API,
potom přepnout UI a až nakonec odstranit staré sloupce a komponenty.

Tím se zachovají ID, historie, Test Runs a existující data a současně se zabrání
tomu, aby nový graf skupin zůstal svázaný se starým stromem test suit.
