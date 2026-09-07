# Chytré výběry skupin

Datum návrhu: 7. 9. 2026

## Cíl

Umožnit použít obsah skupiny buď pouze z její aktuální úrovně, nebo včetně
všech jejích potomků, aniž by se měnil význam hran v organizačním DAG.

Příklad:

```text
Skupina 2
└── Skupina 4

Skupina 5 chce použít obsah Skupiny 2:
- pouze přímý obsah Skupiny 2, bez Skupiny 4; nebo
- celý obsah Skupiny 2 včetně Skupiny 4.
```

## Doporučení

Tuto potřebu je vhodné řešit jako **chytrý výběr** (uložený výběr), nikoli
příznakem na hraně `suite_group_relations`.

Hrana `Skupina 5 -> Skupina 2` má nadále jediný a předvídatelný význam:
Skupina 2 je potomkem Skupiny 5 a její zděděný obsah zahrnuje také Skupinu 4.
Volba, zda se mají potomci zahrnout, patří do práce s obsahem skupiny, ne do
definice jejího umístění v grafu.

## Navržené chování

Při načítání nebo výběru obsahu skupiny budou dostupné dva režimy:

- **Pouze tato skupina** (`include_descendants=false`) – přímí členové skupiny,
  tedy přímo vložené test suites a test cases;
- **Včetně podskupin** (`include_descendants=true`) – přímí členové a obsah
  všech dosažitelných potomků skupiny.

Výsledkem je vždy množina unikátních test cases. Pokud je stejný test case
dosažitelný více cestami v DAG, zobrazí se pouze jednou.

V českém UI se doporučuje označení **Uložený výběr** nebo **Chytrý výběr**.
Volba rozsahu může být zobrazena jako přepínač **Zahrnout podskupiny**.

## První fáze bez změny databáze

Pro první implementaci není nutná nová tabulka. Rozsah se předá jako parametr
API, například:

```http
GET /api/suite-groups/{group_id}/test-cases?include_descendants=false
GET /api/suite-groups/{group_id}/test-cases?include_descendants=true
```

Stejný parametr lze později použít při výběru test cases do Test Runu nebo v
dalších obrazovkách, které pracují s obsahem skupiny. Výchozí hodnota má být
`true`, aby odpovídala současnému pravidlu dědění obsahu z potomků.

## Pozdější ukládání výběrů

Pokud uživatelé budou potřebovat výběr pojmenovat, sdílet a opakovaně používat,
lze přidat samostatnou entitu. Uložený výběr by minimálně obsahoval:

- název;
- zdrojovou skupinu;
- volbu `include_descendants`;
- vlastníka nebo informaci, že je sdílený;
- čas vytvoření a poslední změny.

Obsah se nebude kopírovat. Při každém použití se znovu vyhodnotí nad aktuálním
obsahem skupin, takže změny ve Skupině 2 se automaticky projeví ve výběru.
Konkrétní databázový model bude navržen až při implementaci ukládání.

## Proč neměnit `suite_group_relations`

Přidání například `include_descendants` přímo k hraně by způsobilo, že stejná
skupina může mít podle rodiče rozdílný význam. To by komplikovalo:

- zobrazení a mentální model organizačního grafu;
- výpočet zděděného obsahu přes více cest v DAG;
- deduplikaci test cases;
- počítadla, vyhledávání a filtrování;
- budoucí výběr obsahu do Test Runu;
- cache a oprávnění, pokud budou doplněna.

Samostatný výběr drží organizační vztahy jednoduché a umožňuje funkci postupně
rozšířit bez migrace základního modelu skupin.

## Doporučený postup implementace

1. Doplnit do služby pro načítání obsahu skupiny volbu `include_descendants`.
2. Zajistit deduplikaci test cases dosažitelných více cestami v DAG.
3. Přidat parametr do REST API a zachovat výchozí rekurzivní chování.
4. Přidat do UI přepínač **Zahrnout podskupiny**.
5. Doplnit testy pro přímý obsah, rekurzivní obsah, více rodičů a duplicity.
6. Až podle reálného používání doplnit pojmenované a uložené výběry.

## Rozhodnutí

Chytré výběry jsou doporučené budoucí rozšíření. Organizační DAG zůstane
beze změny a hrany `suite_group_relations` nebudou mít volitelnou dědičnost.
První fáze má být pouze volba rozsahu při načítání obsahu; ukládání výběrů je
samostatná pozdější etapa.

## Implementační upřesnění po ověření v UI

Při praktickém ověření byl požadavek zpřesněn: volba rozsahu patří přímo ke
konkrétnímu vložení podřazené skupiny. Pokud se pod Skupinu 1 vloží Skupina 2
bez volby **Zahrnout podskupiny**, Skupina 2 se zobrazí a její přímý obsah se
zahrne, ale cesta už nepokračuje do Skupiny 3. Původní samostatná struktura
Skupiny 2 zůstává zachovaná.

Toto upřesnění nahrazuje výše uvedené rozhodnutí neměnit
`suite_group_relations`. Implementace proto ukládá `include_descendants` na
konkrétní hranu DAG. Existující vazby jsou po migraci nastavené na `true`, aby
se jejich dosavadní chování nezměnilo.
