# Souběžný strom a skupiny test suit

Datum návrhu: 24. 8. 2026

## Cíl

Umožnit používat současnou stromovou strukturu test suit a zároveň nový plochý pohled se skupinami. Oba pohledy budou pracovat se stejnými test suitami, takže se nebudou vytvářet kopie dat.

Toto řešení umožní skupiny bezpečně vyzkoušet. Pokud se osvědčí, strom lze později odstranit samostatnou migrací. Pokud se neosvědčí, skupiny lze odstranit bez poškození současné hierarchie.

## Navržené chování

Jedna test suite bude mít:

- nejvýše jedno umístění ve stromu pomocí existujícího `parent_suite_id`;
- členství v žádné, jedné nebo více skupinách;
- stále stejné test cases, detail, historii a použití v Test Runs.

Příklad:

```text
Test suite: Objednávka
├── strom: E-shop / Checkout
└── skupiny: Regrese, Smoke, Kritické
```

Změna názvu nebo obsahu suity se okamžitě projeví ve stromu i ve všech skupinách.

## Datový model

Existující tabulka `test_suites` zůstane během souběžného provozu beze změny.

Přidají se tři tabulky:

```text
suite_groups
- id
- parent_group_id (nullable FK na suite_groups.id)
- name
- description
- sort_order
- created_at
- updated_at

suite_group_members
- group_id
- suite_id
- sort_order
- created_at
- updated_at

suite_group_test_case_members
- group_id
- test_case_id
- sort_order
- created_at
- updated_at
```

Nad dvojicí `group_id + suite_id` bude unikátní omezení, aby stejná suita nebyla v jedné skupině vícekrát.

Stejně bude unikátní dvojice `group_id + test_case_id`. Toto členství je
explicitní organizační výběr: nemění `test_cases.suite_id`, strom suit ani data
Test Runů. Jeden test case může být současně vybrán ve více skupinách.

Skupiny tvoří víceúrovňový strom pomocí `parent_group_id`. Kořenová skupina má
`parent_group_id = null`; skupina může obsahovat libovolný počet podskupin a
libovolný počet suit. Při přesunu skupiny backend ověří, že novým rodičem není
skupina samotná ani žádný její potomek, aby nebylo možné vytvořit cyklus.

Názvy skupin musí být neprázdné a budou unikátní mezi sourozenci (včetně
kořenové úrovně). Stejný název je tedy možné použít v různých větvích stromu.

Při smazání skupiny se odstraní pouze její členství. Test suity ani test cases se nesmažou.
Skupinu s podskupinami nebude možné smazat, dokud uživatel podskupiny nepřesune
nebo nesmaže; tím se předejde nechtěnému odstranění celé větve.

## Repository UI

Repository dostane přepínač hlavního organizačního pohledu:

- **Strom** – současné řazení podle rodičovských suit;
- **Skupiny** – víceúrovňový strom skupin a suit, které do nich patří.

Ve skupinovém pohledu budou dostupné také položky:

- **Všechny suity**;
- **Bez skupiny**;
- uživatelsky vytvořené skupiny.

Nově vytvořená suita bude ve stromu standardně na kořenové úrovni, pokud uživatel nezvolí rodiče. Současně ji bude možné přidat do libovolného počtu skupin.

Skupiny mohou být vnořené do dalších skupin a tvořit libovolně hlubokou
strukturu nezávislou na stromu test suit. Suity přiřazené přímo do zvolené
skupiny se zobrazí pod jejími podskupinami. Pohled **Bez skupiny** obsahuje
suity, které nemají žádné přímé členství v žádné skupině.

Po otevření konkrétní skupiny lze vyhledat test cases podle kódu nebo názvu,
filtrovat je podle jednoho či více tagů v každé kategorii a zaškrtnout položky,
které mají do skupiny patřit. Výběr skupin i nadřazené skupiny je vyhledávatelný.

## Základní operace

Uživatel bude moci:

- vytvořit, přejmenovat a smazat skupinu;
- vytvořit podskupinu a přesouvat skupiny mezi úrovněmi bez vzniku cyklu;
- přidat jednu nebo více suit do skupiny;
- odebrat suitu ze skupiny bez smazání suity;
- zobrazit jednu suitu ve více skupinách;
- řadit suity uvnitř skupiny;
- filtrovat test cases podle tagů a hromadně je vybírat do skupiny;
- zobrazit jeden test case ve více skupinách bez změny jeho suity;
- přepínat mezi stromem a skupinami.

Přesunutí suity ve stromu nebude měnit její skupiny. Změna skupin nebude měnit `parent_suite_id` ani `path`.

## Doporučený postup implementace

1. Přidat modely `SuiteGroup`, `SuiteGroupMember` a `SuiteGroupTestCaseMember`, včetně self-reference `parent_group_id`.
2. Vytvořit Alembic migraci bez změny existujících suit.
3. Přidat REST endpointy pro skupiny a správu členství.
4. Přidat validace názvu, unikátnosti mezi sourozenci, cyklů, duplicity členství a existence suity.
5. Doplnit do Repository přepínač **Strom / Skupiny**.
6. Implementovat pohledy **Všechny suity** a **Bez skupiny**.
7. Přidat správu skupin a výběr více skupin u detailu suity.
8. Přidat vyhledávání a tagové filtrování při výběru test cases do skupiny.
9. Doplnit backend a frontend testy.
10. Po reálném používání rozhodnout, zda strom zachovat nebo odstranit.

## Možné pozdější odstranění stromu

Pokud se skupinový model osvědčí, samostatná pozdější změna může:

- odstranit `parent_suite_id`, `path` a `level`;
- odstranit stromový pohled;
- nahradit „Počátek vesmíru“ pohledy „Všechny suity“ a „Bez skupiny“;
- zachovat stejné identifikátory suit, test cases i vazby na Test Runs.

Toto odstranění není součástí první implementace skupin.

## Rozhodnutí pro první implementaci

1. Skupiny jsou společné pro všechny uživatele globálního repository.
2. Pořadí skupin i suit ve skupině je ruční přes `sort_order`.
3. Skupiny lze vybrat při vytvoření i editaci suity.
4. Skupiny v první verzi slouží pouze k organizaci; Test Run se z nich nevytváří.
5. Hlavní přepínač se jmenuje **Strom / Skupiny**.
6. Vnořování skupin je víceúrovňové a backend vždy odmítne cyklickou vazbu.

## Aktuální stav

Plán byl implementován 25. 8. 2026. Databázové modely a migrace, REST API,
víceúrovňový skupinový pohled, členství suit i test cases, vyhledávání skupin,
tagové filtrování se zaškrtáváním test cases a automatické testy jsou součástí
aplikace.
