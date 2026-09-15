# Sjednocené workflow, schvalování a odstranění Requirements

Realizace plánu ze dne 2026-09-15. Navazuje na [plán](workflow-approvals-requirements-plan.md), [Repository](repository-workspace-compact.md) a [Test Execution](test-execution-workspace.md).

## Chování aplikace

- Schvalování používá kompaktní seznam a detail s nezávislým posouváním, nastavitelnou šířkou, mobilním přepínáním a stále dostupným rozhodováním. Záložky oddělují změny, scénář, připomínky a historii.
- Fronty Ke schválení, Moje žádosti, Rozpracované návrhy a Historie načítají pouze aktivní obsah. Moje žádosti znamenají autorství; přiřazení reviewerovi má samostatný filtr. Stránkování nabízí 25/50/100 položek, hledání ignoruje českou diakritiku.
- Rozšířené filtry zahrnují suitu, skupinu, autora, reviewera, stav, tagy a zdrojový běh. Skupiny odpovídají aktuálnímu zařazení v Repository a respektují DAG; tagy žádosti odpovídají posuzované verzi.
- Detail ukazuje čitelné porovnání polí a kroků, autory připomínek a důvody blokace. Oprávnění a nezávislost reviewera určuje server. Schválit a další pokračuje ve filtrované frontě až po úspěšném rozhodnutí.
- URL a stav prohlížeče uchovávají kontext fronty, výběr a rozepsané vstupy. Připomínky a důvody jsou oddělené podle uživatele a žádosti; návrhy podle uživatele a návrhu. Uložená lokální data při konfliktu nepřepisují automaticky serverovou verzi. Persistence je v dané kartě prohlížeče, nejde o synchronizaci mezi zařízeními.
- Repository ukazuje publikovanou verzi i rozpracovanou změnu a nabízí přímý přechod do návrhu či review. Detail publikovaného testu otevírá schválený obsah; vrácený návrh ukazuje důvod a odkaz na připomínky.
- Odkazy mezi review, editorem a execution uchovávají návratovou cestu i konkrétní pokus, pokud je dostupný. Publikace nemění existující execution snapshoty.
- Test Runs mají serverové stránkování a souhrny celé kolekce. Výběr způsobilých testů se načítá po stránkách až při otevření akce. Dashboard zobrazuje skutečný průběh, pass rate a přímé odkazy na práci.

## Requirements a migrace

Frontendová stránka, navigace, API včetně traceability, modely, schémata, služby a vazba z TestCase byly odstraněny. Staré URL obslouží obecná stránka nenalezeného obsahu. Pythonový `backend/requirements.txt` zůstává souborem závislostí.

Migrace `0024_remove_requirements` navazuje na `0023_test_run_task_number`. Odstraní nejprve `requirement_test_cases`, potom `requirements`; nepoužívá CASCADE. Historické migrace zůstávají zachované. Downgrade obnovuje pouze prázdnou strukturu, původní data lze obnovit ze zálohy.

**Stav nasazení:** nakonfigurovaná aplikační databáze nebyla z pracovního prostředí dostupná (`OperationalError`). Migrace je připravená a ověřená na izolovaném PostgreSQL; na skutečné aplikační databázi zde provedena nebyla.

Při nasazení:

1. Před odstraněním dat vytvořit a ověřit zálohu cílové databáze.
2. Odstavit staré instance backendu, nasadit nový kód a spustit `alembic upgrade head` v prostředí backendu se správným `DATABASE_URL`.
3. Spustit nový backend/frontend a ověřit revizi `0024_remove_requirements`, nepřítomnost obou tabulek a dostupnost původních testů, verzí a pokusů.

Aktuální API a databázový model jsou popsány v `api-spec.md` a `database-model.md`; diagram byl znovu vygenerován z ORM. Starší audity jsou označené jako historické.

## Ověření

- Backendová sada: **74 testů prošlo**. Zahrnuje nezávislé review, blokující připomínky, zachování historie a nové fronty/stránkování.
- Frontend: build/typecheck a **18 unit testů prošlo**.
- Browser: **20 scénářů** pro schvalování, Repository, Execution a vytváření běhů prošlo. Kontroly zahrnují notebook 1366×768, mobil 375×812, virtuální seznam, chybu rozhodnutí bez ztráty důvodu a oddělené rozepsané komentáře.
- Skutečný browser průchod se dvěma uživateli nad PostgreSQL prošel: návrh z běhu, provedení, vrácení, oprava, nový pokus, opětovné odeslání a schválení se zachovanými snapshoty.
- Migrační zkouška na PostgreSQL 15: naplněná databáze v revizi 0023, export Requirements, upgrade na 0024 a porovnání dat všech **22 ostatních tabulek beze změny**. Prošla i čistá instalace a downgrade/upgrade struktury. Compose cílově používá PostgreSQL 16; jeho nasazení v tomto prostředí ověřeno nebylo.
- Měření na izolovaném PostgreSQL: **1 000 žádostí po 40 krocích**, stránka 20 po 50 položkách, **2 SELECT dotazy**, odpověď 32 175 bajtů a přibližně **99 ms**. Jde o jednorázové lokální měření, nikoli garanci produkční odezvy.

Opakovatelná migrační zkouška je v `backend/scripts/verify_workflow_workspace.py`; záměrně přijímá jen prázdnou testovací databázi s názvem začínajícím `approval_verify_`. Nelze ji spouštět proti živým datům.
