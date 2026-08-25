# Repository – omezení vnořeného posouvání a připnutý kontext

Datum: 2026-08-24
Stav: implementováno

## Cíl

Zpřehlednit práci v Repository na notebooku a u dlouhých stromů test suit:

- odstranit souběžné svislé posouvání stránky, výsledků hledání, stromu a pravého obsahu;
- přizpůsobit výšku pracovní plochy dostupnému viewportu;
- používat ve workspace jeden společný hlavní svislý scroll;
- ponechat během posouvání viditelný název a cestu aktuální suity.

## Původní problém

Pohledy Složky a Strom používaly pevnou výšku `760px`. Strom i pravý obsah měly vlastní
`overflow-auto` a výsledky hledání další samostatný scroll. Na menších displejích proto
nebylo vždy zřejmé, která část obrazovky se právě posouvá. Při dlouhém obsahu navíc mizel
kontext vybrané suity.

## Implementované řešení

### Jeden hlavní scroll workspace

- `RepositoryWorkspace` má na desktopu výšku odvozenou z viewportu.
- Toolbar pohledů zůstává mimo rolovací obsah.
- Pohled Složky, Strom nebo Myšlenková mapa je vložen do jednoho společného rolovacího
  kontejneru.
- Levý strom a pravý obsah již nemají dva nezávislé svislé scrolly.
- Výsledky hledání se roztahují v toku stránky a nevytvářejí další rolovací oblast.
- Na malých obrazovkách zůstává přirozené posouvání celé stránky, aby nevznikl stísněný
  viewport uvnitř viewportu.

### Připnutý kontext suity

- V pohledu Složky je hlavička s breadcrumbem, názvem, popisem a akcemi připnutá k horní
  hraně společného scrollu.
- V pohledu Strom je nad sekcemi kompaktní připnutá lišta s cestou, názvem a počtem
  přímých test cases.
- Kontext ve Stromu sleduje sekci, která je právě nejvýše ve viditelné části workspace.
- Kliknutí na suitu ve stromu nadále odscrolluje odpovídající sekci do viditelné oblasti.

## Responsivní chování

- Desktop (`lg` a větší): workspace používá jeden scroll a minimální bezpečnou výšku.
- Menší obrazovky: komponenty jsou v běžném toku dokumentu bez pevné výšky a bez
  vnořeného svislého scrollu.
- Myšlenková mapa si ponechává vlastní pan a zoom, ale nevytváří další svislý seznam.

## Akceptační kritéria

1. Strom a pravý obsah se neposouvají nezávisle na sobě.
2. Výsledky hledání nemají vlastní svislý scrollbar.
3. Toolbar Repository zůstává viditelný nad hlavním obsahem workspace.
4. V pohledu Složky zůstává při posouvání viditelná cesta a název aktuální suity.
5. V pohledu Strom zůstává při posouvání viditelná cesta a název aktuálně sledované sekce.
6. Výběr suity a automatické odscrollování sekce fungují stejně jako před změnou.
7. Mobilní zobrazení nepoužívá pevnou výšku desktopového workspace.

## Dodatečné zpřehlednění levého stromu

- Levý strom není připnutý; posouvá se společně s obsahem v jednom hlavním scrollu.
- Desktopová šířka levého panelu je zmenšena z `290px` na `260px`.
- Zkrácené názvy suit ukazují celý název po najetí myší.
- Přímé podsuit(y) v pohledu Složky jsou pod sebou v kompaktním seznamu, nikoli vedle
  sebe v několika sloupcích.
- V pohledu Strom má každá úroveň vlastní odsazení; zobrazení již neslučuje úrovně 4 a
  hlubší do stejné vizuální úrovně.

### Návrat k předchozí variantě

Původní variantu lze vrátit pouze změnou prezentačních tříd bez zásahu do dat nebo API:

1. v `RepositoryOutlineTree.tsx` obnovit `lg:sticky lg:top-0 lg:self-start`;
2. v `RepositoryFoldersView.tsx` a `RepositoryNestedView.tsx` změnit `260px` zpět na `290px`.
