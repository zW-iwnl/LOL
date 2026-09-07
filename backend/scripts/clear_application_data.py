"""Remove application data while preserving users and the Alembic version."""

from sqlalchemy import text

from app import models as _models  # noqa: F401 - register all tables on Base.metadata
from app.core.database import Base, engine


PRESERVED_TABLES = {"users", "alembic_version"}


def clear_application_data() -> None:
    table_names = [
        table.name
        for table in Base.metadata.sorted_tables
        if table.name not in PRESERVED_TABLES
    ]
    if not table_names:
        return

    dialect = engine.dialect.name
    with engine.begin() as connection:
        if dialect == "postgresql":
            quoted = ", ".join(
                connection.dialect.identifier_preparer.quote(name)
                for name in table_names
            )
            connection.execute(
                text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE")
            )
        else:
            for table in reversed(Base.metadata.sorted_tables):
                if table.name not in PRESERVED_TABLES:
                    connection.execute(table.delete())

    print(
        "Aplikační data byla odstraněna; uživatelé a verze migrací zůstali zachováni."
    )


if __name__ == "__main__":
    clear_application_data()
