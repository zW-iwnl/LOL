> Historický podklad: pro aktuální frontend a vlastní barvy použijte [analýzu vzhledu z 15. září 2026](appearance-settings-analysis.md). Níže uvedený rozsah a odhady již neodpovídají současným obrazovkám. Modul Requirements / traceability byl odstraněn migrací 0024. Aktuální workflow popisuje [implementační přehled](workflow-workspace-implementation.md).

# Dark mode – analýza a implementační plán

Datum: 2026-08-21
Stav: připraveno k implementaci

## Cíl

Doplnit do Test Manageru plnohodnotný tmavý vzhled inspirovaný GitLabem a umožnit uživateli přepínat mezi režimy:

- **Světlý**;
- **Tmavý**;
- **Podle systému**.

Volba se v první verzi ukládá lokálně v prohlížeči. Implementace musí zabránit probliknutí světlého tématu při načtení stránky a vytvořit systém barevných tokenů použitelný také pro nové obrazovky.

## Výsledek auditu současného frontendu

Frontend aktuálně používá React, TypeScript, Vite a Tailwind CSS 4. Téma zatím nemá vlastní provider ani sémantické barevné tokeny.

Audit našel:

- 34 souborů s UI nebo globálními styly;
- 29 souborů s explicitními světlými barvami;
- přibližně 917 použití barevných Tailwind utilit;
- pevné hexadecimální barvy v layoutu, přihlášení a ReactFlow mapách;
- opakované kombinace `bg-white`, `bg-slate-50`, `border-slate-200` a `text-slate-*`;
- samostatné inline styly uzlů a hran v obou Mind mapách.

Změna proto není architektonicky složitá, ale je plošná. Pouhé přidání jednotlivých `dark:` tříd by vedlo k obtížně udržovatelnému řešení. Doporučené je nejprve zavést theme tokeny a následně na ně převést obrazovky.

## Rozsah první verze

### Součástí

- přepínač Světlý / Tmavý / Podle systému v horní liště;
- uložení preference do `localStorage`;
- reakce režimu Podle systému na změnu `prefers-color-scheme`;
- aplikace tématu před prvním vykreslením Reactu;
- layout, přihlášení a všechny aktuální stránky;
- tabulky, formuláře, modaly, drawery, filtry a stavové hlášky;
- Repository ve všech třech režimech;
- obě ReactFlow Mind mapy včetně uzlů, hran, pozadí a ovládacích prvků;
- hover, focus, selected, disabled a destructive stavy;
- kontrola kontrastu a základní automatizované testy.

### Mimo první verzi

- synchronizace tématu mezi více zařízeními;
- ukládání preference do databáze uživatele;
- možnost definovat vlastní barevné téma;
- automatická změna firemních ilustrací nebo obrázků.

## Vizuální směr

Tmavý režim nemá používat čistě černé plochy. Podobně jako GitLab bude pracovat s několika vrstvami tmavě šedé:

| Účel | Světlý režim | Tmavý režim |
|---|---|---|
| Pozadí aplikace | velmi světlá šedá | nejtmavší šedomodrá |
| Navigace a karty | bílá | tmavá vyvýšená plocha |
| Vnořená plocha | `slate-50` | o stupeň světlejší tmavá plocha |
| Okraj | `slate-200` | tlumená šedomodrá |
| Primární text | `slate-900` | téměř bílá |
| Sekundární text | `slate-500` | světle šedá |
| Akcent | cyan | světlejší cyan s dostatečným kontrastem |

Stavové barvy passed, failed, blocked, skipped a informační barvy musí zachovat význam, ale jejich pozadí a kontrast budou mít samostatnou variantu pro tmavé plochy.

## Navržená architektura

### Datový model tématu

```ts
type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
```

Preference a skutečně aktivní téma budou oddělené. Hodnota `system` se přeloží podle `window.matchMedia("(prefers-color-scheme: dark)")`.

### Nové části frontendu

```text
frontend/src/theme/
  ThemeContext.tsx
  theme.ts

frontend/src/components/theme/
  ThemeSwitcher.tsx
```

- `theme.ts` bude obsahovat validaci uložené hodnoty, rozlišení systémového tématu a aplikaci atributu na `<html>`.
- `ThemeContext.tsx` poskytne preference, aktivní téma a setter.
- `ThemeSwitcher.tsx` bude přístupný ovládací prvek se třemi možnostmi.

### Uložení preference

Navržený klíč:

```text
fet-theme-preference
```

Chybějící nebo neplatná hodnota znamená `system`.

### Aplikace tématu bez probliknutí

Ještě před vykreslením React aplikace se na kořenový HTML element nastaví:

```html
<html data-theme="dark" class="dark">
```

Inicializace musí proběhnout před `ReactDOM.createRoot`. Provider následně převezme správu tématu a poslouchání systémové preference.

### Theme tokeny

V `styles.css` vzniknou sémantické CSS proměnné například:

```css
--color-page;
--color-surface;
--color-surface-muted;
--color-surface-raised;
--color-border;
--color-border-strong;
--color-text;
--color-text-muted;
--color-accent;
--color-focus;
```

Pro passed, failed, blocked, skipped, warning a info vzniknou samostatné tokeny pro text, pozadí a okraj. Komponenty mají používat význam tokenu, nikoli znalost konkrétního odstínu.

## Postup implementace

### 1. Základ tématu

- vytvořit typy a utility tématu;
- přidat inicializaci před React render;
- vytvořit ThemeProvider;
- podporovat změnu systémového tématu za běhu;
- přidat unit testy pro validaci a rozlišení preference.

### 2. Přepínač

- umístit ThemeSwitcher do pravé části horní lišty;
- nabídnout Světlý / Tmavý / Podle systému;
- doplnit ikony slunce, měsíce a monitoru;
- přidat přístupné názvy a ovládání klávesnicí;
- zajistit dostupnost volby také na přihlašovací stránce.

### 3. Globální tokeny a základní layout

- převést `:root`, `body`, App a AppLayout;
- převést sidebar, horní lištu, globální vyhledávání a uživatelský blok;
- převést přihlášení;
- odstranit základní pevné hodnoty `#f6f8fb`, `#f7f9fc` a `#172033`.

### 4. Sdílené komponenty

- PageHeader;
- loading a error stavy;
- RepositorySearch;
- tagy, selecty a filtry;
- tlačítka, formulářová pole, checkboxy a focus ring;
- modaly, drawery a potvrzovací plochy.

### 5. Hlavní stránky

Doporučené pořadí podle rozsahu barevných deklarací:

1. Test Runs;
2. Repository / Test Cases;
3. Test Case Detail;
4. Requirements;
5. Execution;
6. Projects;
7. Test Suites;
8. Dashboard, Reports a Settings.

Každá stránka se dokončí včetně empty, loading, error, disabled, hover a selected stavů.

### 6. Repository a Mind map

- převést RepositoryWorkspace, Folders a Nested tree;
- upravit zvýraznění vybrané suity a test case;
- převést ReactFlow canvas a controls;
- nahradit inline hexadecimální barvy uzlů a hran tokeny odvozenými od tématu;
- zkontrolovat fullscreen režim;
- zachovat dostatečný kontrast cyan hran a textů.

### 7. Ověření

- unit test preference light, dark, system a neplatné uložené hodnoty;
- test reakce na změnu systémového tématu;
- build a TypeScript kontrola;
- smoke test přepnutí tématu a zachování preference po reloadu;
- vizuální kontrola všech hlavních obrazovek při desktopové i mobilní šířce;
- kontrola kontrastu textů a ovládacích prvků;
- kontrola, že načtení stránky neproblikne světlým tématem.

## Akceptační kritéria

1. Uživatel může z horní lišty zvolit Světlý, Tmavý nebo Podle systému.
2. Preference zůstane zachovaná po reloadu a novém otevření aplikace.
3. Režim Podle systému reaguje bez reloadu na změnu systému.
4. Při načtení tmavého režimu nedojde k viditelnému probliknutí světlé stránky.
5. Všechny současné stránky jsou použitelné v obou tématech.
6. Repository Folders, Strom i Mind map mají úplnou tmavou variantu.
7. Formuláře, tabulky, modaly a drawery mají čitelné hover, focus, selected a disabled stavy.
8. Stavové barvy zachovávají význam a mají dostatečný kontrast.
9. Přepínač je dostupný klávesnicí a má čitelné accessible labels.
10. Unit testy, frontend build a smoke test tématu projdou.

## Odhad náročnosti

| Varianta | Odhad |
|---|---:|
| Základní přepínač a hlavní obrazovky | 1–2 vývojové dny |
| Kompletní GitLab-like provedení všech aktuálních obrazovek | 3–5 vývojových dnů |
| Ukládání preference k uživatelskému účtu | přibližně +0,5 dne |

Největší část práce není přepínač, ale systematická náhrada explicitních světlých barev a vizuální ověření všech stavů.

## Rizika

- mechanická náhrada `bg-white` nemusí vždy znamenat stejný tmavý povrch;
- stavové barvy mohou mít v tmavém tématu nízký kontrast;
- ReactFlow používá inline barvy mimo běžné Tailwind třídy;
- modaly a absolutně umístěné drawery mohou odhalit nepřevedené podkladové plochy;
- bez testu počáteční inicializace může docházet k probliknutí tématu;
- budoucí komponenty mohou znovu zavést přímé barvy, pokud nebude používání tokenů součástí code review.

## Volitelné pokračování

Pokud má být preference synchronizovaná mezi zařízeními, doplní se například `theme_preference` k uživateli, databázová migrace, API schema a aktualizační endpoint. Lokální hodnota může zůstat jako rychlá cache a fallback před načtením přihlášeného uživatele.
