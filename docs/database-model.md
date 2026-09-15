# Databázový model PostgreSQL

Aktualizováno: 2026-09-15

Zdrojem pravdy jsou SQLAlchemy modely v backend/app/models a Alembic migrace 0001 až 0024. Aplikace používá PostgreSQL 16 a jedno globální repository bez projektového dělení.

## Organizační model repository

Repository má pouze jednu hierarchickou vrstvu: SuiteGroup.

- SuiteGroup tvoří orientovaný acyklický graf a může mít více rodičů.
- Hrany grafu jsou v suite_group_relations; include_descendants určuje, zda se konkrétní cesta rozvine i do potomků vložené skupiny.
- TestSuite je plochý kontejner bez parent_suite_id, path a level.
- Test suite může být členem více skupin přes suite_group_members.
- Test case povinně patří právě do jedné test suite.
- Test case může být současně vložen přímo do více skupin přes suite_group_test_case_members.
- Test cases viditelné ve skupině jsou sjednocením přímých členů, cases z členských suit a cases zděděných z potomků skupiny.

## Aktivní tabulky

| Tabulka | Účel | Hlavní integritní pravidla |
|---|---|---|
| users | uživatelé a přihlášení | unikátní email |
| suite_groups | uzly organizačního DAG | nezáporné sort_order |
| suite_group_relations | orientované hrany DAG | PK rodič/potomek, zákaz self-edge, volitelný průchod do potomků, indexy v obou směrech |
| test_suites | ploché kontejnery test cases | povinný autor, nezáporné sort_order |
| suite_group_members | M:N skupiny a suity | složený PK, reverse index podle suite |
| suite_group_test_case_members | přímé M:N členství cases ve skupinách | složený PK, reverse index podle case |
| test_case_tags | číselníky kategorizace | unikátní category/name, povolené kategorie |
| test_case_tag_assignments | M:N test cases a tagy | složený PK a reverse index |
| test_cases | definice test case | unikátní code, povinná suite, validní status a verze |
| test_steps | kroky test case | unikátní test_case_id/step_order |
| test_runs | testovací běhy | validní status a plánované časové pořadí |
| test_run_cases | snapshot case vložený do runu | unikátní test_run_id/test_case_id |
| test_run_attempts | historie rerunů celého runu | unikátní test_run_id/attempt_number |
| test_run_case_attempts | historie rerunů jednotlivého case | unikátní run-attempt/case/číslo |
| test_run_step_results | výsledky kroků konkrétního case attemptu | pokus a run case musí vzájemně odpovídat |

## Historie a mazání

TestRunCase.test_case_snapshot uchovává podobu test case v okamžiku přidání do runu. Execution attempts a výsledky kroků jsou historická data.

- Použitý nebo jinak publikovaný test case se přes DELETE pouze označí jako deprecated.
- Fyzicky lze odstranit jen nepoužitý draft.
- Starší case attempt v aktuálním run attemptu je neměnný.
- Archivovaný test run nelze dále exekuovat.
- Odstranění nadřazeného execution záznamu používá řízené ON DELETE CASCADE, aby nezůstaly sirotky; odstranění zdrojového test case historii nekaskáduje.

## Indexová strategie

Bez produkčních statistik se udržují pouze indexy podložené constraintem nebo konkrétním query patternem:

- FK/reverse indexy pro členství skupin, tagy a schvalování;
- unikátní run/case a case/order indexy;
- created_at/id pro stabilní pořadí test run listu;
- partial index historie case attempts s provedeným výsledkem;
- obousměrné indexy hran skupinového DAG.

Trigramové search indexy ani odstranění překrývajících se indexů se nemají provádět bez EXPLAIN a pg_stat_user_indexes.

## Migrace a deployment

Produkční Docker Compose spouští Alembic v jednorázové službě migrate. Backend čeká na její úspěšné dokončení a sám migrace znovu nespouští. Samostatný backend nebo Railway používá omezený retry v docker-entrypoint.sh.

Migrace 0019 převádí původní strom suit na ploché suity a skupinový DAG. Její downgrade nedokáže věrně vyjádřit více rodičů; produkční návrat proto používá pre-deployment dump nebo forward-fix.

Migrace 0020 nejprve kontroluje existující data, potom v jedné transakci přidává execution constraints a workload-backed indexy. Vytvoření unikátních omezení může po dobu sestavení indexů blokovat zápisy do dotčených tabulek, proto se délka migrace musí předem změřit na stagingové kopii produkčních dat.

## Povinné produkční ověření

Před nasazením nové databázové revize:

1. otestovat alembic upgrade head na PostgreSQL 16;
2. otestovat upgrade kopie nebo fixture předchozí revize;
3. zkontrolovat duplicity a neplatné stavové hodnoty;
4. ověřit zálohu a postup obnovy;
5. po nasazení sledovat locky, chyby migrace, velikost indexů a latency kritických endpointů.

## Schvalování a odstranění modulu požadavků

Návrhy (`test_case_drafts`), neměnné verze (`test_case_versions`), review (`test_case_reviews`),
připomínky (`test_case_review_comments`), události (`test_case_events`), idempotentní operace
(`test_case_operations`) a verzované tagy (`test_case_version_tags`) zůstávají zachované.
Migrace `0024_remove_requirements` odstraňuje pouze tabulky požadavků a jejich propojení s testy.
Historické migrace zůstávají součástí instalační posloupnosti. Downgrade obnoví prázdné tabulky;
odstraněné záznamy se obnovují ze zálohy.
