# Verzování a archivace test cases

Datum návrhu: 24. 8. 2026

## Cíl

Doplnit skutečnou historii test case tak, aby každá publikovaná změna vytvořila dohledatelnou verzi. Stará verze se nesmaže, ale zůstane pouze pro čtení. Test Run musí vždy zachovat přesný obsah a číslo verze, se kterými byl vytvořen.

## Současný stav

Backend již obsahuje část potřebného základu:

- `test_cases.version` se zvyšuje při změně verzovaných polí a test steps;
- `test_run_cases.test_case_version` ukládá použité číslo verze;
- `test_run_cases.test_case_snapshot` uchovává obsah použitý při exekuci;

To chrání historii Test Runů, ale neumožňuje otevřít úplný obsah libovolné starší verze test case ani z ní vytvořit novou verzi.

## Doporučené rozdělení stavů

Stav celé test case a stav konkrétní verze nemají být jedna hodnota.

### Stav test case

Určuje, zda se test case jako celek stále používá:

- `active` – test case je dostupná v Repository;
- `archived` – test case byla jako celek vyřazena a standardně se nezobrazuje.

Archivace celé test case nesmí smazat její verze ani historické Test Runy.

### Stav verze

Doporučené stavy konkrétní verze:

- `draft` – rozpracovaná verze, kterou lze upravovat;
- `valid` – právě platná publikovaná verze;
- `archived` – dříve platná verze, automaticky nahrazená novější verzí;
- `cancelled` – rozpracovaná verze byla zrušena a nikdy nebyla platná.

České UI názvy:

- Rozpracovaná
- Platná
- Archivovaná
- Zrušená

Stav **Zrušená** má smysl pouze pro opuštěný draft. Platná verze se při publikování náhrady automaticky změní na Archivovanou, nikoli na Zrušenou.

## Povolené přechody

```text
Rozpracovaná ── publikovat ──> Platná
      │                         │
      └────── zrušit ───────> Zrušená

Platná ── publikování nové verze ──> Archivovaná

Archivovaná ── obnovit ──> nová Rozpracovaná verze
Zrušená    ── obnovit ──> nová Rozpracovaná verze
```

Archivovaná ani zrušená verze se už neupravuje. Obnovení vždy vytvoří novou verzi s novým číslem; historický záznam se nepřepisuje.

## Datový model

Doporučená nová tabulka:

```text
test_case_versions
- id
- test_case_id
- version_number
- status
- snapshot
- change_summary
- created_by
- published_by
- published_at
- archived_at
- cancelled_at
- created_at
- updated_at
```

`snapshot` bude typu PostgreSQL `JSONB` a uloží úplný obsah verze:

- kód a název;
- popis;
- preconditions;
- expected summary;
- automatizaci;
- tagy a jejich názvy;
- test steps včetně pořadí, typu, akce, poznámky, dat a očekávaného výsledku.

Tabulka `test_cases` zůstane stabilní identitou test case a bude obsahovat minimálně:

```text
test_cases
- id
- code
- lifecycle_status
- current_version_id
- suite_id
- created_by
- created_at
- updated_at
```

`code` zůstane stabilní identifikátor napříč verzemi. `suite_id` je organizační umístění, proto se jeho změna nemusí považovat za novou obsahovou verzi. Snapshot verze ale může původní umístění evidovat pro audit.

## Databázová pravidla

- Kombinace `test_case_id + version_number` musí být unikátní.
- Jedna test case smí mít nejvýše jednu platnou verzi.
- Doporučeně smí mít nejvýše jeden otevřený draft.
- Číslo verze se přiděluje transakčně, aby při souběžné editaci nevznikly duplicity.
- Historické verze se fyzicky nemažou.
- Smazání test case přes běžné API se nahradí archivací.
- Tvrdé smazání bude případně pouze administrátorská operace a nesmí být možné, pokud existuje vazba na Test Run.

Pro PostgreSQL je vhodné vynutit jednu platnou verzi částečným unikátním indexem nad `test_case_id` pro řádky se stavem `valid`.

## Chování při editaci

1. Uživatel otevře platnou verzi.
2. Zvolí **Vytvořit novou verzi**.
3. Systém vytvoří draft jako kopii platné verze s následujícím číslem.
4. Uživatel upravuje pouze draft.
5. Akce **Publikovat** v jedné transakci:
   - archivuje dosavadní platnou verzi;
   - označí draft jako platný;
   - nastaví `current_version_id`;
   - zapíše audit událost.
6. Akce **Zrušit verzi** nastaví draft na `cancelled`.

Není vhodné vytvářet novou historickou verzi při každém stisku tlačítka Uložit. Historická verze vznikne až publikováním; průběžná uložení mění pouze draft.

## Test Runs

Do nového Test Runu půjde standardně přidat pouze platná verze test case.

`test_run_cases` bude odkazovat na konkrétní `test_case_version_id` a současný JSON snapshot zůstane jako dodatečná ochrana neměnnosti exekuce.

Díky tomu:

- již vytvořený Test Run se po publikování nové verze nezmění;
- tester vždy vidí přesné kroky vybrané při založení runu;
- výsledek lze jednoznačně spojit s konkrétní verzí;
- archivovanou test case lze stále zobrazit v historických runech.

## Repository UI

Na kartě nebo řádku test case zobrazit například:

```text
TC-142 · Objednávka produktu
v4 · Platná
```

Detail test case dostane:

- číslo a stav aktuální verze;
- tlačítko **Vytvořit novou verzi**;
- tlačítko **Publikovat** nebo **Zrušit verzi** u draftu;
- záložku **Historie verzí**;
- porovnání vybraných verzí;
- akci **Obnovit jako novou verzi**;
- pole se stručným popisem změny.

Archivované test cases budou v Repository skryté výchozím filtrem, ale půjde je zobrazit volbou **Zahrnout archivované**.

## API návrh

```text
GET  /test-cases/{test_case_id}/versions
GET  /test-cases/{test_case_id}/versions/{version_number}
POST /test-cases/{test_case_id}/versions
PUT  /test-case-versions/{version_id}
POST /test-case-versions/{version_id}/publish
POST /test-case-versions/{version_id}/cancel
POST /test-case-versions/{version_id}/restore
POST /test-cases/{test_case_id}/archive
POST /test-cases/{test_case_id}/restore
```

Editace `PUT /test-case-versions/{version_id}` bude povolena pouze pro draft.

## Migrace současných dat

Při zavedení verzování:

1. Pro každou existující test case vytvořit snapshot s jejím současným číslem `version`.
2. Současný stav `ready` převést na platnou verzi.
3. Současný stav `draft` převést na rozpracovanou verzi.
4. Současný stav `deprecated` převést na archivovanou test case a archivovanou verzi.
5. Doplnit `current_version_id` pro platné verze.
6. Existující snapshoty v Test Runech ponechat beze změny.
7. Ověřit návaznost čísel verzí a audit událostí.

## Doporučené pořadí implementace

1. Potvrdit názvy a význam stavů.
2. Přidat model `TestCaseVersion` a Alembic migraci s převodem dat.
3. Přesunout tvorbu snapshotu do sdílené služby.
4. Implementovat transakční vytvoření draftu, publikování, zrušení a obnovu.
5. Napojit Test Runs na konkrétní `test_case_version_id`.
6. Nahradit fyzické mazání test case archivací.
7. Přidat historii a ovládání verzí do detailu test case.
8. Přidat filtr archivovaných test cases do Repository.
9. Doplnit testy stavových přechodů, souběžného publikování a historických Test Runů.

## Testovací scénáře

- První publikování draftu vytvoří jednu platnou verzi.
- Publikování nové verze automaticky archivuje předchozí platnou verzi.
- Nelze mít dvě platné verze stejné test case.
- Archivovanou nebo zrušenou verzi nelze upravit.
- Obnovení staré verze vytvoří nový draft s novým číslem.
- Zrušení draftu nezmění současnou platnou verzi.
- Archivace celé test case nezmění historický Test Run.
- Test Run nad verzí v2 zůstane na v2 i po publikování v3.
- Souběžné publikování dvou draftů skončí jednou platnou verzí.
- Výchozí Repository nezobrazuje archivované test cases.

## Doporučení

Použít čtyři stavy verze: **Rozpracovaná, Platná, Archivovaná, Zrušená**. Pouhé tři stavy bez Rozpracované by nutily označit nehotovou změnu jako platnou, nebo vytvářet historii při každém uložení.

Stav **Archivovaná** znamená „dříve platná verze“. Stav **Zrušená** znamená „tato rozpracovaná verze nikdy nezačala platit“.

## Aktuální stav

Tento dokument je návrh. Databázová migrace, endpointy ani UI verzování zatím nebyly implementovány.
