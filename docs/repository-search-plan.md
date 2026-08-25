# Repository vyhledávání – analýza a implementační plán

> Projektové endpointy v tomto původním plánu byly nahrazeny globálním `/api/repository/search`. Viz [Jedno globální repository bez projektů](single-repository-architecture.md).

## Cíl

Doplnit jednotné a škálovatelné vyhledávání test cases a test suites v rámci aktivního projektu. Stejnou vyhledávací logiku má používat Repository i horní globální vyhledávač aplikace.

## Současný stav

- Repository načítá všechny suity a test cases aktivního projektu.
- Vyhledávání v Repository probíhá lokálně v prohlížeči:
  - test suites podle `name` a `path`,
  - test cases podle `code`, `title` a cesty suity.
- Výsledky lze filtrovat na „Vše“, „Suity“ a „Test cases“.
- Samostatná stránka suit používá serverový endpoint `GET /projects/{project_id}/test-suites/search`.
- Endpoint pro hledání suit nejprve načte všechny suity a následně je filtruje v Pythonu.
- Test cases nemají backendový parametr `q`, limit ani stránkování.
- Horní vyhledávač naviguje na `/test-cases?search=...`, ale Repository parametr `search` nenačítá. Zadaný dotaz se proto neprovede.
- API seznamu test cases vrací celé položky včetně kroků, což je pro našeptávač zbytečně objemné.
- Textová pole nemají vyhledávací indexy. Existují pouze indexy pro vazby a cestu suity.

## Hlavní problémy

1. Výsledek závisí na datech, která má frontend právě načtená.
2. Aktivní tagové filtry mohou nečekaně skrýt výsledky vyhledávání.
3. Lokální hledání nebude dobře škálovat pro velká repository.
4. Hledání suit je implementováno jinak na stránce suit a jinak v Repository.
5. Horní vyhledávač není funkčně propojený s Repository.
6. Pro našeptávač chybí lehký datový kontrakt bez kroků test case.
7. Chybí jednotné řazení výsledků podle relevance.

## Doporučené chování

Vyhledávání bude ve výchozím stavu omezené na aktivní projekt.

### Prohledávaná pole

Test case:

- `code`,
- `title`,
- volitelně `description` a `preconditions`.

Test suite:

- `name`,
- `path`,
- volitelně `description`.

V první verzi se nebudou prohledávat testovací kroky. Hledání přes `test_steps` by vyžadovalo další joiny, řešení duplicit a složitější prezentaci důvodu shody.

### Řazení podle relevance

1. Přesná shoda kódu test case.
2. Kód test case začínající dotazem.
3. Název test case nebo suite začínající dotazem.
4. Výskyt v názvu.
5. Výskyt v cestě suity nebo popisu.

Při shodném skóre se výsledky seřadí deterministicky podle typu, názvu a ID.

### Obsah výsledku

Test case:

- ID a typ výsledku,
- kód a název,
- status,
- ID suity a její cesta.

Test suite:

- ID a typ výsledku,
- název a cesta,
- aktivní/neaktivní stav,
- počet test cases.

## Návrh API

```http
GET /api/projects/{project_id}/repository/search
    ?q=login
    &types=test_case,test_suite
    &limit=20
```

Příklad odpovědi:

```json
{
  "query": "login",
  "items": [
    {
      "type": "test_case",
      "id": 42,
      "project_id": 1,
      "label": "TC-LOGIN-01 Přihlášení uživatele",
      "code": "TC-LOGIN-01",
      "title": "Přihlášení uživatele",
      "suite_id": 7,
      "suite_path": "/Autentizace/Login",
      "status": "ready"
    },
    {
      "type": "test_suite",
      "id": 7,
      "project_id": 1,
      "label": "Login",
      "path": "/Autentizace/Login",
      "test_case_count": 12,
      "is_active": true
    }
  ]
}
```

### Validace API

- `q`: po oříznutí minimálně 2 znaky, rozumné maximum například 200 znaků.
- `types`: pouze `test_case` a `test_suite`.
- `limit`: minimálně 1 a maximálně 50.
- Projekt musí existovat a uživatel musí být přihlášený.
- Výsledky nesmí obsahovat entity z jiného projektu.

## Hledání a filtrování podle tagů

Vyhledávání test cases bude zahrnovat také názvy přiřazených tagů: business oblast (`business_area`), aplikace/doména (`application_domain`) a objekt (`object_type`).

### Chování

- Běžný textový dotaz bude hledat také v názvech všech tří tagů.
- Vedle textového hledání budou dostupné přesné filtry podle ID tagu.
- Více vybraných tagových filtrů se kombinuje logikou AND; test case musí odpovídat všem zadaným filtrům.
- Pokud je použitý tagový filtr, výsledkem jsou pouze test cases, protože test suites vlastní tagy nemají.

### API

```http
GET /api/projects/{project_id}/repository/search
    ?q=platby
    &business_area_id=10
    &application_domain_id=20
    &object_type_id=30
```

Parametr `q` může být prázdný, pokud je zadaný alespoň jeden tagový filtr. Backend ověří existenci tagu i jeho správnou kategorii.

### Implementační dopady

- Backend pro textové hledání připojí `test_case_tags` samostatným aliasem pro každou kategorii.
- Přesné filtry se aplikují přes FK sloupce `business_area_id`, `application_domain_id` a `object_type_id`.
- Lehký výsledek test case bude obsahovat názvy a ID všech tří přiřazených tagů.
- Repository zobrazí tagy ve výsledku jako kompaktní štítky a zachová existující tři výběry jako serverové filtry.
- Dotaz a tagové filtry se synchronizují s URL, aby šlo hledání sdílet a obnovit.
- Testy pokryjí hledání názvu tagu, každý přesný filtr, kombinaci filtrů, hledání bez `q` a odmítnutí tagu z nesprávné kategorie.

## Implementační plán

### 1. Backendový kontrakt

- Přidat `backend/app/schemas/repository_search.py`.
- Definovat diskriminované typy výsledků a `RepositorySearchResponse`.
- Přidat `backend/app/api/routes/repository_search.py`.
- Zaregistrovat route mezi chráněné endpointy v `backend/app/api/router.py`.
- Umístit vyhledávací logiku do `backend/app/services/repository_search.py`.

### 2. Databázové vyhledávání

- Hledat přímo pomocí SQL dotazů, ne filtrováním seznamu v Pythonu.
- Z databáze vybírat pouze sloupce potřebné pro výsledek.
- Implementovat case-insensitive hledání.
- Samostatně sestavit dotaz pro test cases a test suites a výsledky spojit podle skóre.
- Omezit počet výsledků už na úrovni databáze.
- Současný `search_suites` přesměrovat na společnou logiku, nebo jej po migraci klientů odstranit.

Pro menší MVP lze začít s `ILIKE`. Pokud repository očekává tisíce až desetitisíce záznamů, doplnit Alembic migraci s PostgreSQL `pg_trgm` indexy pro:

- `test_cases.code`,
- `test_cases.title`,
- `test_suites.name`,
- `test_suites.path`.

Migrace musí zohlednit, že automatické backendové testy používají SQLite, zatímco produkční databáze je PostgreSQL.

### 3. Backendové testy

Přidat testy pro:

- přesnou shodu kódu,
- částečnou shodu kódu,
- case-insensitive hledání,
- hledání názvu test case,
- hledání názvu a cesty suity,
- pořadí podle relevance,
- filtraci podle typu výsledku,
- izolaci mezi projekty,
- minimální délku dotazu,
- maximální limit,
- autentizaci,
- odstranění duplicit.

### 4. Frontendový API klient

- Přidat `frontend/src/api/repositorySearch.ts`.
- Definovat diskriminovanou TypeScript union podle hodnoty `type`.
- Přidat funkci `searchRepository(projectId, params)`.
- Nepřidávat další API a vyhledávací logiku přímo do rozsáhlého `TestCasesPage.tsx`.
- Duplicitní implementace `getTestCases` v `client.ts` a `testCases.ts` sjednotit v samostatném následném refaktoru.

### 5. Repository UI

- Vyčlenit vyhledávání do komponenty `RepositorySearch.tsx`.
- Uchovávat dotaz a typ výsledku v URL, například `?q=login&type=all`.
- Zachovat kompatibilitu s existujícími parametry `suite` a `new`.
- Inicializovat vyhledávací pole z URL a synchronizovat změny zpět do URL.
- Použít debounce přibližně 250–300 ms.
- Zajistit, aby starší pomalá odpověď nepřepsala novější výsledky.
- Zobrazit samostatnou ikonu pro test case a test suite.
- U test case zobrazit kód, název a cestu suity.
- U suity zobrazit název, cestu a počet testů.
- Doplnit stav načítání, chybu a prázdný stav.

Kliknutí na suitu:

- vybere suitu v Repository,
- odkryje její větev stromu,
- aktualizuje parametr `suite` v URL.

Kliknutí na test case:

- otevře detail `/test-cases/{id}`.

Otevření detailu je doporučené, protože je jednoznačné a funguje stejně z Repository i z horního vyhledávače.

### 6. Horní vyhledávač

Minimální varianta:

- změnit navigaci na `/test-cases?q=...`,
- načíst `q` na stránce Repository,
- automaticky spustit serverové hledání.

Rozšířená varianta:

- použít společnou komponentu jako dropdown našeptávač,
- podporovat šipky, Enter a Escape,
- zavřít výsledky kliknutím mimo komponentu,
- při změně aktivního projektu vyčistit výsledky a hledat v novém projektu.

### 7. Frontendové testy

Ověřit:

- načtení dotazu z URL,
- debounce,
- přepnutí typu výsledků,
- ignorování zastaralé odpovědi,
- navigaci na detail test case,
- výběr suity,
- prázdný stav a API chybu,
- předání dotazu z horního vyhledávače do Repository.

Rozšířit Playwright smoke scénář o vyhledání test case podle kódu a suity podle názvu.

## Doporučené pořadí realizace

1. Opravit předávání dotazu z horní lišty do Repository.
2. Přidat jednotný backendový endpoint a jeho testy.
3. Napojit Repository na serverové hledání.
4. Vyčlenit znovupoužitelnou frontendovou komponentu.
5. Napojit nebo rozšířit horní vyhledávač.
6. Podle očekávaného objemu dat doplnit trigramové indexy.
7. Spustit backendové testy, frontend typecheck/build a Playwright smoke test.

## Akceptační kritéria

- Dotaz z horního vyhledávače se skutečně zobrazí a provede v Repository.
- Uživatel najde test case podle celého i částečného kódu a názvu.
- Uživatel najde suitu podle názvu i cesty.
- Výsledky obsahují pouze data aktivního projektu.
- Vyhledávání není ovlivněno již načteným seznamem ani lokálními tagovými filtry, pokud nejsou výslovně předány do vyhledávacího API.
- Přesná shoda kódu je před částečnými shodami.
- Výsledek má omezenou velikost a neobsahuje kroky test case.
- Kliknutí na test case otevře jeho detail.
- Kliknutí na suitu vybere a odkryje suitu v Repository.
- Backendové testy a frontendový build/typecheck projdou.

## Mimo rozsah první verze

- Hledání v testovacích krocích.
- Fulltextové hledání v requirements, test runs a auditních událostech.
- Ukládání historie hledání na serveru.
- Pokročilé operátory nebo dotazovací jazyk.
- Fuzzy oprava překlepů a synonymní slovník.
