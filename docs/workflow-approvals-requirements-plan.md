# Plán sjednocení workflow a odstranění Requirements

Stav analýzy: 2026-09-15. Podklad: aktuální frontend, API a modely v pracovním stromu, včetně kompaktního Repository a Test Execution. Plán byl realizován v pracovním stromu; stav, ověření a zbývající aplikace migrace při nasazení jsou v [popisu implementace](workflow-workspace-implementation.md). Následující analýza zachycuje výchozí stav.

## Cíl

Plynulý průchod Repository → návrh → nezávislé schválení → publikace → běh → provedení → případná úprava scénáře. Zachovat kontext, minimalizovat posouvání a opakované hledání. Requirements a jejich traceability odstranit z aplikace i aktuálního databázového schématu.

## Zjištěné problémy

| Oblast | Současný stav | Dopad |
| --- | --- | --- |
| Schvalovací fronta | Současně načítá žádosti i návrhy; hledání odesílá požadavek při každém znaku | Zbytečné dotazy, neaktivní panel může vyvolat chybu celé stránky |
| Moje žádosti | API `mine` zahrnuje autorství i přiřazení reviewerovi | Nejasný význam fronty |
| Rozpracované návrhy | Fronta přenáší celý obsah návrhů; nemá stejné hledání jako žádosti | Vyšší objem dat a horší dohledatelnost |
| Detail schválení | Dlouhá stránka, rozhodnutí pod obsahem i připomínkami | Opakované posouvání při každé žádosti |
| Porovnání | Technické názvy polí, kroky jako serializované struktury | Obtížná kontrola skutečných změn |
| Přechody | Zpět do schvalování/Repository vede na základní URL; zdrojový run neobnovuje konkrétní test a pokus | Ztráta pracovního kontextu |
| Oprávnění | Nabídka přiřazení nefiltruje všechny spoluautory ani neaktivní uživatele; UI nevyjadřuje všechny důvody blokace rozhodnutí | Akce nabízená v UI může skončit očekávatelnou chybou serveru |
| Test Runs | Dvě kolekce běhů, limit 100 bez úplného stránkování; KPI z této omezené kolekce; eager načítání test cases | Neúplné souhrny a zbytečný přenos |
| Dashboard | Názvy posledních běhů nejsou odkazy; průběh a pass rate mají pomlčky; délka výsledkových pruhů vychází z count × 8 | Slabá návaznost a nejasná interpretace údajů |
| Dokumentace | UX audit ještě předpokládá projekty a wizard; Requirements jsou popsány jako aktivní funkce | Neshoda se skutečným produktem |

## 1. Společné rozvržení a kontext

- Vyčlenit společné komponenty kompaktního workspace, lišty, menu, filtrů, stránkování a panelů z nynějších repository/execution komponent. Schvalování nebude záviset na třídách pojmenovaných podle jiné obrazovky.
- Stejné chování na desktopu a mobilu, klávesnice a viditelný focus, nezávislé posouvání seznamu a detailu.
- Udržovat v URL nebo navigačním stavu frontu, filtry, stránku a vybranou položku; scroll a rozepsané vstupy v uživatelsky odděleném stavu prohlížeče. Přímé odkazy musí fungovat i bez předchozí návštěvy seznamu.
- Návrat z detailu zachová skupinu včetně jejího umístění, suitu a filtr. Z review otevřít původní test/pokus v execution, pokud je vazba dostupná; jinak jasný odkaz na zdrojový běh.
- Lokální načítání a chyba pouze v dotčeném panelu. Chyba zápisu zachová text, výběr a pozici. Konflikt novější verze nabídne načtení aktuálního stavu bez automatického opakování rozhodnutí.

## 2. Schvalování jako kompaktní pracovní obrazovka

### Rozvržení

Horní lišta: fronta, hledání, rozbalovací filtry, aktivní štítky a počet výsledků.

Levý nastavitelný/skrytelný panel: stránkovaný seznam žádostí (kód, název, verze, stav, autor, reviewer, stáří, počet blokujících připomínek). Pravý panel: hlavička vybrané žádosti a záložky **Změny / Celý scénář / Připomínky / Historie**. Spodní rozhodovací lišta zůstává viditelná.

Na mobilu přepínání seznam/detail a snadný návrat se zachovaným filtrem. Detailové URL schvalování zůstanou funkční.

### Fronty a filtry

- Ke schválení: rychlé přepínače „Přiřazené mně“, „Nepřiřazené“, „Všechny“.
- Moje žádosti: pouze mnou odeslané, přehledně včetně vrácených k dopracování.
- Rozpracované návrhy: vlastní/všechny podle oprávnění, hledání a pokračování v editaci.
- Historie rozhodnutí: vyhledávání a vlastní filtry, bez akčních tlačítek pro uzavřené žádosti.
- Hledání bez české diakritiky s krátkým debounce. Filtry autor, reviewer, stav, suita, skupina a tagy; zdrojový běh vybírat podle názvu/čísla úkolu místo samotného číselného ID.
- Tagy a obsah review filtrovat podle posuzované neměnné verze. U skupin výslovně používat aktuální zařazení testu v Repository, respektovat DAG a `include_descendants`; historické zařazení skupin dnes není součástí verzovaného snapshotu.
- Stránky 25/50/100, stabilní pořadí s ID jako druhým klíčem. Výchozí čekající fronta od nejstarších, historie od nejnovějších. Souhrny odpovídají celé filtrované frontě.

### Rozhodnutí

- Primární akce „Schválit a publikovat“; samostatná volba „Schválit a další“ pro postupné review.
- Další položku určit z aktuální filtrované fronty; po úspěchu obnovit seznam i počty. Při chybě zůstat na žádosti. Na konci fronty zobrazit dokončení.
- Vrácení k dopracování vyžaduje důvod; zamítnutí jasně oddělit od běžné žádosti o opravu. Nedělat hromadné schvalování bez kontroly jednotlivých scénářů.
- Převzetí/přiřazení v kompaktní nabídce. Nabízet aktivní nezávislé reviewery, vyloučit autora i spoluautory. U blokované akce zobrazit konkrétní důvod a odkaz na otevřené blokující připomínky.
- Server zůstává autoritou oprávnění, nezávislosti, zámků a idempotence. Doplnit capability metadata do detailu, aby frontend nemusel duplikovat pravidla.

### Čitelné změny a připomínky

- České názvy polí, původní a navržená hodnota. Kroky porovnávat pomocí stabilního `step_key`; rozlišit přidání, odebrání, přesun a změnu akce/dat/očekávání.
- Výchozí pohled pouze na změněné položky, možnost zobrazit celý scénář. U první verze jasně uvést, že jde o nový scénář.
- Zachovat základ porovnání uložený v žádosti; nepřepínat ho tiše na později publikovanou verzi.
- Připomínky přímo k poli nebo kroku, jména autorů, počet otevřených/blokujících, filtr otevřených a přechod na související změnu.
- Rozepsané připomínky a důvod rozhodnutí ukládat odděleně pro každou žádost. Vymazat jen úspěšně odeslaný vstup.

## 3. Návazné workflow

### Repository a editor

- Oddělit životní stav testu od stavu změny: např. „Publikováno v3 · v4 čeká na schválení“.
- Do lehkých souhrnů doplnit existenci návrhu/pending review a přímé akce „Pokračovat v návrhu“ či „Otevřít schvalování“ bez dotazu pro každý řádek.
- Prohlížení schváleného testu otevře publikovaný obsah; explicitní editace otevře návrh. Nový/vrácený scénář nabídne pokračování práce.
- Po odeslání jasné potvrzení verze a přechod na konkrétní žádost. Po vrácení ukázat důvod a připomínky vedle návrhu.
- Sjednotit ochranu rozepsaných dat a indikaci uloženého/neuloženého stavu; změna publikované verze nesmí přepsat existující execution snapshot.

### Test Runs a Execution

- Doplnit skutečné serverové stránkování a celkové souhrny běhů; odpojit KPI od prvních 100 výsledků a odstranit duplicitní načítání.
- Výběr testů pro přidání načítat až při otevření akce, ve stránkách; zachovat pravidla pro způsobilé schválené testy.
- Jedna jasná akce „Pokračovat v testování“, vedle ní správa běhu. Filtry a vybraný běh se obnoví po návratu.
- Návrh z execution musí vést zpět ke konkrétnímu testu/pokusu. Viditelně oddělit schválenou definici, testovaný návrh a historický pokus.
- Nová publikace může nabídnout explicitní přechod na novou verzi podle existujících pravidel; historické výsledky a snapshoty zůstanou neměnné.

### Dashboard a texty

- Proklik posledních běhů přímo na provedení; skutečný průběh, pass rate s definovaným jmenovatelem a proporcionální výsledkové pruhy.
- Rychlé vstupy „Pokračovat v testování“, „Moje review“, „Vrácené k dopracování“, „Rozpracované návrhy“ s odpovídajícími filtry.
- Sjednotit české názvy stavů a prázdné stavy s konkrétní navazující akcí. Neaktivní reportové placeholdery nevydávat za hotové reporty; nové reporty jsou samostatný rozsah.

## 4. Kompletní odstranění Requirements

### Frontend a API

- Odstranit `RequirementsPage.tsx`, `api/requirements.ts`, import a route v `App.tsx`, položku v hlavním i mobilním menu a všechny odkazy.
- Odstranit backend router, službu a schémata Requirements včetně `/api/traceability`.
- Odstranit model `Requirement`, tabulkový objekt `requirement_test_cases`, exporty modelů a relationship `TestCase.requirements`.
- Pro staré URL zajistit obecný srozumitelný stav nenalezené stránky. Requirements endpointy se neobjeví v OpenAPI.

### Databáze a nasazení

- Přidat novou navazující Alembic migraci (aktuálně po `0023_test_run_task_number`, při implementaci ověřit head).
- Nejprve zrušit spojovací tabulku `requirement_test_cases`, potom `requirements`, včetně jejich indexů a omezení. Zkontrolovat skutečné příchozí FK před provedením; žádné plošné CASCADE mimo tento modul.
- Nezasahovat do historických migrací, které Requirements vytvářely nebo měnily: čistá instalace projde celou posloupností a skončí bez modulu.
- Requirements data budou záměrně odstraněna. Před aplikací migrace na existující prostředí pořídit zálohu/export. Downgrade může obnovit strukturu tabulek, nikoli smazaný obsah; návrat dat vyžaduje zálohu.
- Koordinovat odstavení starých instancí aplikace, aktualizaci backendu a migraci, aby starý kód neběžel proti odstraněným tabulkám.
- Ověřit zachování počtů a vazeb test cases, návrhů, verzí, review, běhů a pokusů před/po migraci.

### Testy a dokumentace

- Odstranit testy samotných Requirements; v testu vyřazení test case ponechat ověření zachované historie a odstranit jen requirements část.
- Aktualizovat seed/fixtures, generátor DB diagramů, aktuální API/databázovou dokumentaci, roadmapu a AGENTS.md (Requirement priority). Historické audity označit jako historické, pokud popisují starý stav.
- Python `backend/requirements.txt` zachovat: jde o závislosti backendu, nikoli doménový modul.

## 5. Realizační pořadí

1. Odstranění Requirements jako samostatná uzavřená změna, migrační a regresní testy.
2. Společné workspace komponenty a zachování navigačního kontextu; ověřit Repository a Execution.
3. API front: oddělené autorství/přiřazení, lehké souhrny návrhů, batch načítání jmen/verzí místo dotazů po řádcích, filtry, počty a capability metadata.
4. Nová fronta a detail schvalování, porovnání kroků, připomínky a rozhodovací lišta.
5. Návaznosti Repository/editor/execution, stavy publikace a návrhu, ochrana rozepsaných vstupů.
6. Stránkování Test Runs, přesné souhrny a dotažení Dashboardu.
7. Celý průchod na PostgreSQL a v prohlížeči; aktualizace dokumentace.

## 6. Podmínky dokončení

- Na 1366×768 jsou vidět seznam, obsah a rozhodovací akce bez posunu celé stránky; mobil bez horizontálního přetečení.
- Fronta s více než 1 000 žádostmi nevyžaduje načítání všech detailů, kroky se načtou až pro výběr. Hledání a stránkování nemají skrytý limit prvních 100 položek.
- Přechody i reload obnoví kontext; změna žádosti nikdy nepřenese rozepsaný komentář na jinou žádost.
- Autor/spoluautor nemůže schválit vlastní verzi; nevyřešená blokující připomínka brání schválení; dvojí kliknutí ani konflikt nesmí způsobit dvojí rozhodnutí.
- Ověřit scénář vytvoření → review → vrácení → oprava → schválení → běh → provedení → nová verze, včetně návratu na původní pokus.
- Po migraci neexistují obě Requirements tabulky, API ani UI; zachované entity mají původní historii. Ověřit upgrade existující DB i čistou instalaci na PostgreSQL.
- Build/typecheck, unit, backend a browser testy včetně regrese Repository a Execution. Zátěžové UI testy doplnit kontrolou dotazů/odezvy reálné PostgreSQL, nejen mock API.
