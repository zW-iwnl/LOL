# Test Manager - zadání, fungování a architektura

## 1. Vysvětlení systému v jedné minutě

Test Manager je interní webová aplikace pro řízení manuálního testování. Na jednom místě udržuje projekty, požadavky, testovací scénáře, jejich kroky, testovací plány, konkrétní běhy testů, výsledky provedení a nalezené defecty.

![Jak funguje Test Manager](test-manager-fungovani.png)

Princip je následující:

1. Vedoucí nebo analytik založí projekt a požadavky.
2. Test analytik připraví test cases, zařadí je do stromu test suites a propojí je s požadavky.
3. Pro release, sprint nebo UAT vznikne test plan a jeden či více test runs.
4. Tester v execution obrazovce provede jednotlivé kroky a uloží výsledek.
5. Neúspěšný test může být převeden na defect, který se dále řeší a znovu testuje.
6. Dashboard z výsledků ukazuje stav a úspěšnost testování.

Systém tak vytváří dohledatelnou cestu od požadavku přes test až k výsledku a případné chybě.

## 2. Zadání projektu

### 2.1 Výchozí problém

Testovací tým potřebuje jednotné místo pro evidenci testů a jejich provádění. Bez něj bývají test cases rozptýlené v tabulkách a dokumentech, výsledky nejsou konzistentní, defecty nemají vazbu na konkrétní provedení a nelze rychle určit stav kvality projektu.

### 2.2 Cíl

Vytvořit interní alternativu k základním funkcím nástrojů JIRA/Xray/Zephyr, která umožní:

- řídit testovací aktivity po projektech;
- udržovat znovupoužitelné repository test cases;
- plánovat testování pro release, sprint nebo UAT;
- přiřazovat práci testerům a zaznamenávat výsledky;
- evidovat defecty včetně vazby na selhaný test;
- sledovat pokrytí požadavků a historii změn;
- zobrazit souhrnný stav testování na dashboardu.

### 2.3 Rozsah funkčních částí

| Oblast | Požadované chování |
| --- | --- |
| Přihlášení | Ověřit uživatele e-mailem a heslem, vydat JWT a chránit aplikační API. |
| Projekty | Zakládat, upravovat, vyhledávat a oddělovat data jednotlivých projektů. |
| Requirements | Evidovat požadavky a propojovat je s test cases pro traceability. |
| Test Suites | Organizovat testy v libovolně hlubokém stromu oblastí a podoblastí. |
| Test Cases | Evidovat popis, předpoklady, prioritu, typ, stav, verzi a jednotlivé kroky. |
| Test Plans | Seskupit testovací běhy pro release, milník, sprint nebo UAT. |
| Test Runs | Vybrat sadu test cases, verzi, prostředí, termín a přiřazené testery. |
| Execution | Postupně provádět testy a ukládat výsledek, komentář, čas a autora provedení. |
| Defects | Založit chybu ručně nebo ze selhaného testu a řídit její životní cyklus. |
| Dashboard | Ukázat KPI a souhrnné výsledky aktivního projektu. |
| Audit | Uchovat záznam důležitých změn včetně aktéra a změněných hodnot. |

### 2.4 Uživatelé systému

| Role v procesu | Odpovědnost |
| --- | --- |
| Test manager | Zakládá plán, připravuje test runs, sleduje průběh a vyhodnocuje výsledek. |
| Test analytik | Navrhuje test cases, kroky, strukturu suites a vazby na požadavky. |
| Tester | Provádí přidělené testy, ukládá výsledky a zakládá defecty. |
| Vývojář / řešitel | Analyzuje defect, mění jeho stav a předává opravu k retestu. |
| Vedoucí projektu | Sleduje dashboard, pokrytí, pass rate a otevřená rizika. |

Poznámka: aplikace ukládá roli uživatele, ale současná ochrana API je primárně založena na přihlášení. Detailní oprávnění pro jednotlivé role jsou vhodné jako další etapa.

## 3. Hlavní proces

```mermaid
flowchart LR
    A[Projekt] --> B[Požadavky]
    A --> C[Test Suites]
    C --> D[Test Cases]
    B <-->|pokrytí| D
    D --> E[Test Plan]
    E --> F[Test Run]
    D --> F
    F --> G[Execution]
    G --> H{Výsledek}
    H -->|Passed| I[Úspěšný test]
    H -->|Failed| J[Defect]
    H -->|Blocked| K[Odstranění překážky]
    H -->|Skipped| L[Vědomě vynecháno]
    J --> M[Oprava]
    M --> N[Retest]
    N --> G
    I --> O[Dashboard a vyhodnocení]
    J --> O
    K --> O
    L --> O
```

### Popis procesu

**Příprava:** Projekt je nejvyšší organizační celek. V něm vznikají požadavky a repository test cases. Test suites slouží jako složky ve stromu, zatímco test case je znovupoužitelný předpis testu s očíslovanými kroky a očekávanými výsledky.

**Plánování:** Test plan představuje větší testovací aktivitu, například ověření releasu. Obsahuje jeden nebo více test runs. Test run je konkrétní provedení vybrané sady test cases v určené verzi a prostředí.

**Provedení:** Přidáním test case do runu vznikne samostatná položka `TestRunCase`. Ta drží aktuální výsledek, komentář, přiřazeného testera a snímek verze test case platné v době vytvoření runu. Pozdější změna repository testu tak nezmění historický obsah běhu.

**Vyhodnocení:** Tester ukládá `passed`, `failed`, `blocked` nebo `skipped`. Selhání lze propojit s defectem. Souhrny test runu a dashboard se počítají z výsledků jednotlivých `TestRunCase` položek.

## 4. Životní cykly

### Test case

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> ready: kontrola a schválení
    ready --> draft: požadavek na úpravu
    ready --> deprecated: test již není platný
    draft --> deprecated: test se nebude používat
```

- `draft`: test je rozpracovaný;
- `ready`: test je připravený k použití;
- `deprecated`: test je zastaralý a nemá se vybírat do nových běhů.

### Test run

```mermaid
stateDiagram-v2
    [*] --> open
    open --> in_progress: zahájení execution
    in_progress --> completed: dokončení testování
    completed --> archived: uzavření historie
```

### Defect

```mermaid
stateDiagram-v2
    [*] --> open
    open --> in_progress: zahájit řešení
    in_progress --> fixed: oprava dokončena
    fixed --> retest: předat testerovi
    retest --> closed: retest úspěšný
    retest --> open: retest selhal
    open --> rejected: chyba zamítnuta
    in_progress --> rejected: chyba zamítnuta
```

## 5. Technická architektura

```mermaid
flowchart TB
    U[Uživatel v prohlížeči]

    subgraph FE[Frontend - React + TypeScript + Vite]
        UI[České uživatelské rozhraní]
        CTX[Auth a aktivní projekt]
        API[API klient]
        UI --> CTX
        CTX --> API
    end

    subgraph BE[Backend - FastAPI]
        ROUTES[REST API routes]
        AUTH[JWT autentizace]
        SCHEMAS[Pydantic validace]
        SERVICES[Doménové services]
        ORM[SQLAlchemy ORM]
        ROUTES --> AUTH
        ROUTES --> SCHEMAS
        ROUTES --> SERVICES
        SERVICES --> ORM
    end

    DB[(PostgreSQL)]
    MIG[Alembic migrace]
    AUDIT[Audit events]

    U -->|HTTP, port 5173| UI
    API -->|JSON REST + Bearer JWT| ROUTES
    ORM -->|SQL, port 5432| DB
    SERVICES --> AUDIT
    AUDIT --> ORM
    MIG --> DB
```

### Odpovědnosti vrstev

| Vrstva | Odpovědnost |
| --- | --- |
| React stránky a komponenty | Zobrazení dat, formuláře, filtry, strom suites a execution obrazovka. |
| Auth a projektové contexty | Uchování přihlášeného uživatele a právě vybraného projektu. |
| Frontend API klient | Sestavení HTTP požadavků, přidání JWT a zpracování odpovědí API. |
| FastAPI routes | REST endpointy, parametry požadavku, odpovědi a HTTP stavové kódy. |
| Pydantic schemas | Kontrola povinných polí, datových typů a formátu vstupních dat. |
| Services | Obchodní pravidla, práce s entitami, výpočty a audit změn. |
| SQLAlchemy models | Mapování doménových entit a vazeb do databázových tabulek. |
| Alembic | Verzované změny databázového schématu. |
| PostgreSQL | Trvalé uložení uživatelů, projektů, testů, výsledků a defectů. |

### Tok jednoho požadavku

1. Uživatel provede akci ve frontendu, například uloží výsledek testu.
2. API klient odešle JSON požadavek s JWT v hlavičce `Authorization`.
3. FastAPI ověří token a Pydantic zvaliduje vstupní data.
4. Route předá operaci service vrstvě.
5. Service provede obchodní pravidlo, aktualizuje SQLAlchemy model a případně zapíše audit event.
6. SQLAlchemy uloží transakci do PostgreSQL.
7. API vrátí JSON odpověď a React aktualizuje obrazovku.

## 6. Sekvence provedení testu a založení defectu

```mermaid
sequenceDiagram
    actor Tester
    participant UI as React frontend
    participant API as FastAPI
    participant Service as Test run service
    participant DB as PostgreSQL

    Tester->>UI: Otevře execution test runu
    UI->>API: GET /test-runs/{id}/execution
    API->>Service: Načti run, položky a snapshoty testů
    Service->>DB: SELECT test_run_cases + vazby
    DB-->>Service: Data běhu
    Service-->>API: Execution model
    API-->>UI: JSON

    Tester->>UI: Zvolí Failed a doplní komentář
    UI->>API: PUT /test-run-cases/{id}/result
    API->>Service: Ulož výsledek a autora
    Service->>DB: UPDATE test_run_case + audit
    DB-->>Service: Potvrzení transakce
    Service-->>UI: Aktualizovaná položka

    Tester->>UI: Založí defect
    UI->>API: POST /projects/{id}/defects
    API->>DB: INSERT defect s vazbou na test_run_case
    DB-->>UI: Vytvořený defect
```

## 7. Datový model

```mermaid
erDiagram
    USER ||--o{ PROJECT : creates
    USER ||--o{ TEST_CASE : creates
    USER ||--o{ TEST_RUN_CASE : executes
    USER ||--o{ DEFECT : reports

    PROJECT ||--o{ TEST_SUITE : contains
    PROJECT ||--o{ TEST_CASE : contains
    PROJECT ||--o{ REQUIREMENT : contains
    PROJECT ||--o{ RELEASE : plans
    PROJECT ||--o{ MILESTONE : plans
    PROJECT ||--o{ TEST_PLAN : plans
    PROJECT ||--o{ TEST_RUN : executes
    PROJECT ||--o{ DEFECT : tracks

    TEST_SUITE o|--o{ TEST_SUITE : parent_of
    TEST_SUITE o|--o{ TEST_CASE : groups
    TEST_CASE ||--o{ TEST_STEP : consists_of
    REQUIREMENT }o--o{ TEST_CASE : covered_by

    RELEASE o|--o{ MILESTONE : contains
    RELEASE o|--o{ TEST_PLAN : scopes
    MILESTONE o|--o{ TEST_PLAN : scopes
    TEST_PLAN }o--o{ TEST_RUN : groups

    TEST_RUN ||--o{ TEST_RUN_CASE : contains
    TEST_CASE ||--o{ TEST_RUN_CASE : instantiated_as
    TEST_RUN_CASE ||--o{ DEFECT : produces
    USER ||--o{ AUDIT_EVENT : performs
```

### Klíčové entity

| Entita | Význam |
| --- | --- |
| `User` | Přihlášený uživatel, jeho role a aktivita. |
| `Project` | Izolovaný prostor pro všechna testovací data konkrétního produktu. |
| `TestSuite` | Uzel stromové struktury; odkazuje na volitelnou nadřazenou suite. |
| `TestCase` | Znovupoužitelný testovací scénář s prioritou, stavem a verzí. |
| `TestStep` | Jeden krok testu: akce, testovací data a očekávaný výsledek. |
| `Requirement` | Požadavek propojitelný s více test cases; podklad pro pokrytí. |
| `Release` / `Milestone` | Časový a produktový kontext plánovaného testování. |
| `TestPlan` | Nadřazený plán sdružující více test runs. |
| `TestRun` | Konkrétní sada testů prováděná pro verzi a prostředí. |
| `TestRunCase` | Jedno provedení jednoho test case v konkrétním runu. |
| `Defect` | Nalezená chyba, volitelně napojená na konkrétní selhané provedení. |
| `AuditEvent` | Historie změn entity, provedená akce, aktér a změněné hodnoty. |

## 8. Důležitá obchodní pravidla

- Veškerá pracovní data musí patřit ke konkrétnímu projektu.
- Kód projektu a kód test case musí být jednoznačné.
- Test suite může mít nadřazenou suite a ukládá cestu pro rychlé načítání podstromu.
- Test case může existovat bez suite, ale vždy patří do projektu.
- Kroky test case mají jednoznačné pořadí.
- Do test runu se přidávají konkrétní test cases; jejich provedení se ukládá odděleně jako `TestRunCase`.
- Výchozí výsledek nového provedení je `not_run`.
- Při provedení se ukládá verze a snapshot test case, aby historie zůstala reprodukovatelná.
- Výsledek provedení je právě jeden z `not_run`, `passed`, `failed`, `blocked`, `skipped`.
- Defect může vzniknout samostatně nebo s vazbou na `TestRunCase`.
- Archivovaný test run se považuje za historický a nemá se dále měnit.
- Změny důležitých entit mají vytvářet auditní záznam.

## 9. Nefunkční požadavky

- Uživatelské rozhraní je v češtině a musí být použitelné na běžném desktopovém rozlišení.
- API používá konzistentní REST styl a JSON.
- Všechny neveřejné endpointy vyžadují platný JWT.
- Vstupy jsou validované před zápisem do databáze.
- Databázové změny se provádějí pouze verzovanými Alembic migracemi.
- Aplikace je lokálně spustitelná jedním příkazem přes Docker Compose.
- Frontend, backend a databáze jsou samostatné služby.
- Historické výsledky testování musí zůstat dohledatelné i po úpravě repository test case.
- Chyby API mají vracet srozumitelný HTTP stav a nesmí zanechat částečně uloženou transakci.

## 10. Akceptační scénář

Řešení lze předvést následujícím průchodem:

1. Uživatel se přihlásí a zvolí aktivní projekt.
2. Založí požadavek `REQ-001`.
3. Ve stromu vytvoří suite a v ní test case se dvěma kroky.
4. Propojí test case s požadavkem a ověří traceability.
5. Založí test plan a test run pro konkrétní verzi a prostředí.
6. Přidá test case do runu a přiřadí testera.
7. Tester otevře execution, provede kroky a uloží výsledek `failed` s komentářem.
8. Ze selhaného provedení založí defect.
9. Defect projde stavy `open`, `in_progress`, `fixed`, `retest` a `closed`.
10. Dashboard a detail runu zobrazí aktualizovaný průběh a výsledky.

## 11. Aktuální stav a hranice řešení

Aktuální aplikace má implementované hlavní stránky a REST operace pro přihlášení, projekty, requirements, test suites, test cases, plánování, test runs, execution, defecty, dashboard a audit.

Reporty a nastavení jsou zatím připravené jako základní obrazovky, nikoliv jako plně dokončené moduly. Detailní role a oprávnění, externí integrace, přílohy, notifikace a automatizované importy/exporty patří do navazující etapy.

## 12. Lokální provoz

| Služba | Adresa |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend health | `http://localhost:8000/health` |
| OpenAPI dokumentace | `http://localhost:8000/docs` |
| PostgreSQL | `localhost:5432` |

Lokální demo účet:

- e-mail: `admin@testmanager.cz`
- heslo: `admin123`

Spuštění z kořenového adresáře aplikace:

```powershell
docker compose up --build -d
```
