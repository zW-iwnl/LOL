# Plán: interaktivní mapa test suit

## Cíl

Doplnit do Repository interaktivní diagram hierarchie test suit. Diagram usnadní orientaci ve velkých projektech a bude fungovat jako druhý pohled vedle existující tabulkové mapy.

## Uživatelské rozhraní

- Zachovat současnou tabulkovou mapu.
- Do mapy přidat přepínač `Diagram / Tabulka`.
- Každou suitu zobrazit jako kartu propojenou hranou s rodičovskou suitou.
- Na kartě zobrazit:
  - název suity,
  - celou cestu v tooltipu,
  - počet test cases přímo v suitě,
  - počet test cases včetně podsuit,
  - aktivní/neaktivní stav,
  - označení oblíbené suity.
- Barevně odlišit prázdné, zaplněné a neaktivní suity.

## Interakce

- Kliknutí na kartu vybere suitu a otevře ji v Repository.
- Dvojklik nebo ovládací prvek na kartě rozbalí či skryje podsuitu.
- Podporovat posouvání plochy, zoom a tlačítko `Přizpůsobit obrazovce`.
- Přidat tlačítko pro návrat na kořenovou úroveň.
- Hledání podle názvu nebo cesty:
  - zvýrazní odpovídající karty,
  - odkryje jejich rodičovské větve,
  - přesune pohled na vybraný výsledek.
- Umožnit přidání nebo odebrání suity z oblíbených přímo v kartě.
- Synchronizovat vybranou suitu s parametrem `suite` v URL.

## Chování pro velké projekty

- Při otevření zobrazit pouze kořenové suity a bezprostřední podsložky.
- Další úrovně načítat nebo vykreslovat až po rozbalení větve.
- Při změně stromu nepřepočítávat rozložení větví, které nejsou viditelné.
- Nabídnout filtr `Jen prázdné`, `Jen aktivní` a `Jen oblíbené`.
- U rozsáhlého stromu zobrazit počet skrytých potomků na sbalené kartě.

## Technický návrh

1. Připravit převod seznamu suit na uzly a hrany diagramu.
2. Oddělit stav rozbalených větví od stavu stromu v levém panelu Repository.
3. Vytvořit komponentu `SuiteDiagram` pro vykreslení a ovládání mapy.
4. Vytvořit komponentu `SuiteDiagramNode` pro jednotný vzhled karty.
5. Napojit existující souhrnné počty `direct_test_case_count` a `total_test_case_count`.
6. Znovu použít existující oblíbené a naposledy otevřené suity z `localStorage`.
7. Zachovat tabulkovou mapu jako alternativní a přístupnější zobrazení.
8. Stav zvoleného pohledu ukládat pro každý projekt do `localStorage`.

Databázová migrace není potřeba. Současné API již poskytuje hierarchii, cestu, stav i oba počty test cases.

## Přístupnost

- Všechny akce musí být dostupné také z klávesnice.
- Karty musí mít čitelné názvy pro screen reader.
- Zoom nesmí být jediný způsob, jak najít nebo otevřít suitu.
- Tabulkové zobrazení zůstane plnohodnotnou alternativou diagramu.

## Ověření

- Otestovat převod stromu na uzly a hrany.
- Otestovat rozbalování a skrývání větví.
- Otestovat hledání, odkrytí předků a přesun pohledu na výsledek.
