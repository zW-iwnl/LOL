# Databázová dokumentace pomocí SchemaSpy

SchemaSpy se připojí k běžící PostgreSQL databázi, načte její skutečné schéma a vytvoří statickou HTML dokumentaci včetně ER diagramů a vazeb mezi tabulkami.

## Vygenerování dokumentace

Pro databázi, na které už jsou aplikované Alembic migrace, stačí spustit:

```powershell
docker compose --profile docs run --rm schemaspy
```

Při prvním spuštění projektu použij celý postup:

```powershell
docker compose up -d postgres
docker compose run --rm backend alembic -c alembic.ini upgrade head
docker compose --profile docs run --rm schemaspy
```

Výsledek se uloží do:

```text
docs/database-reference/index.html
```

Součástí výstupu jsou přehledy tabulek, sloupců, indexů, cizích klíčů a ER diagramy. Dokumentaci znovu vygeneruj po každé změně databázových migrací.

## Konfigurace

- Připojení používá stejné hodnoty `POSTGRES_DB`, `POSTGRES_USER` a `POSTGRES_PASSWORD` jako lokální PostgreSQL.
- Výchozí schéma je `public`; lze ho změnit proměnnou `SCHEMASPY_SCHEMA` v `.env`.
- SchemaSpy běží pouze v Compose profilu `docs` a neovlivňuje běžný start aplikace.
- Vygenerované soubory nejsou verzované v Gitu; vznikají vždy z aktuální databáze.

Pokud se změny v ERD neobjeví, ověř nejdřív, že migrace doběhly na `head`, a generování spusť znovu.
