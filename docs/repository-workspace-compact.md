# Kompaktní Repository

Repository používá kompaktní hlavní menu a ovládací prvky jako Test Execution. Na desktopu od 1024 px a výšky 600 px vyplňuje dostupné okno. Navigace a obsah mají samostatný posuvník; na menších obrazovkách jsou panely pod sebou.

## Skupiny

- Strom a plochý seznam; hledání bez české diakritiky podle názvu, ID a tagů v obsahu; oblíbené a filtry kořenových nebo sdílených skupin.
- Strom prochází pouze rozbalené větve. Virtuální seznam vykresluje viditelné řádky s malou rezervou. Vyhledávání zobrazuje každou skupinu jednou i při více rodičích.
- Výběr obsahuje ID a cestu umístění (`group`, `groupPath` v URL). Zastavená vazba `include_descendants=false` nepokračuje do dalších potomků. Detail upozorňuje na omezený rozsah a umožňuje otevřít celou skupinu.
- „Ukázat vybranou ve struktuře“ otevře jednu cestu bez vyčíslení všech cest DAG. Šířku navigace lze upravit nebo ji skrýt.
- **Obsah:** přímé skupiny a suity s hledáním a stránkováním; přímé odkazy na testy nebo všechny testy v rozsahu. Původ ukazuje členství přes suity i přímé odkazy. Stejný test se ve výsledcích a počtech neopakuje.
- **Vazby:** rodiče, děti, suity a explicitní testy. Vyhledávací dialog přidává vztah a vylučuje známé cykly; server zůstává autoritou validace. Lze změnit rozsah konkrétní vazby nebo ji odebrat. Smazání celé skupiny je samostatná potvrzovaná akce.
- **Podrobnosti:** název, popis, pořadí a zděděné tagy. Rozepsané úpravy přežijí přepnutí skupiny/záložky a lze je výslovně zahodit.

## Suity, testy a hledání

Suity mají prohledávatelný seznam a detail s tabulkou testů. Tabulka testů používá serverové stránky po 25, 50 nebo 100 řádcích, hledání, stav a tagy. Testy lze otevřít v náhledu a přejít do plného editoru; přesun a vyřazení zůstávají v nabídce akcí v seznamech suit/testů. Vytváření testu používá stávající editor přímo ve stránce.

Globální hledání je rychlý rozcestník do skupin, suit a testů (nejvýše 20 výsledků). Filtry Business oblast / Aplikace/doména / Objekt se vztahují na tento rozcestník; filtry tabulek jsou samostatné. Výběr výsledku zachovává dotaz a zavře nabídku. Aktivní globální i tabulkové tagy lze jednotlivě odstranit.

Filtry, otevřené větve, oblíbené, šířka a rozepsaná metadata se uchovávají v `sessionStorage` pro daného uživatele a kartu prohlížeče. Posun seznamů se také obnovuje. Nastavení se nesynchronizuje mezi zařízeními.

## Data a výkon

- `GET /api/repository/groups`: lehký graf, počty přímých členství, agregované tagy a celkový počet testů. Nevrací scénáře ani seznamy testů pro každou skupinu.
- `GET /api/repository/cases`: souhrny testů; `group_id`, `suite_id`, `include_descendants`, `direct_only`, `q`, `status`, opakovaný `tag_id`, `offset`, `limit`. `total` odpovídá filtrům, `scope_total` rozsahu před textovým/stavovým/tagovým filtrem. Více tagů se kombinuje pomocí AND.
- Dotaz na obsah prochází potomky pouze vybrané skupiny. Původy a tagy testů se načítají jen pro vrácenou stránku. Scénář s kroky se načte až při otevření náhledu/detailu.
- Změna vazby obnovuje strukturu a vybraný detail; nenačítá celou kolekci scénářů. Zápisová API, review, verzování a execution historie používají existující služby. Databázová migrace není potřeba.

## Ověření

- Backend: stránkování 123 testů, lehká odpověď, diakritika a doslovné `%`/`_`, stav, AND tagy, zděděné tagy, validace parametrů a přihlášení; DAG, zastavená vazba, více původů a deduplikace.
- Unit: 1 000 skupin ve vrstveném DAG, omezené rozbalování, nalezení cesty přes alternativního rodiče, hledání názvů a zděděných tagů.
- Chromium s izolovaným mock API: 1 000 skupin, omezený počet DOM řádků, obnova výběru/filtru, rozsah umístění, tři stránky testů, líný náhled, neúspěšný zápis vazby a opakování, rozepsaná metadata, globální hledání a mobilní editor. Regrese Test Execution a tvorby běhů.

Prohlížečové testy ověřují chování a rozměry rozhraní; nejsou měřením odezvy produkční PostgreSQL. Agregace zděděných tagů stále závisí na velikosti grafu a jeho obsahu.
