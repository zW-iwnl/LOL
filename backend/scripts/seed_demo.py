from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import TestCase, TestRun, TestRunCase, TestStep, TestSuite, User


ADMIN_EMAIL = "admin@testmanager.cz"
ADMIN_PASSWORD = "admin123"


def get_or_create_admin(db: Session) -> User:
    user = db.query(User).filter(User.email == ADMIN_EMAIL).one_or_none()
    if user:
        if user.password_hash == "$2b$12$demo.hash.replace.before.production":
            user.password_hash = hash_password(ADMIN_PASSWORD)
        return user

    user = User(
        name="Admin Tester",
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def get_or_create_suite(
    db: Session,
    *,
    admin: User,
    name: str,
    sort_order: int,
) -> TestSuite:
    suite = (
        db.query(TestSuite)
        .filter(TestSuite.name == name)
        .order_by(TestSuite.id)
        .first()
    )
    if suite:
        return suite

    suite = TestSuite(
        name=name,
        description=f"Demo test suite {name}.",
        sort_order=sort_order,
        is_active=True,
        created_by=admin.id,
    )
    db.add(suite)
    db.flush()
    return suite


def get_or_create_test_case(
    db: Session,
    *,
    suite: TestSuite,
    admin: User,
    code: str,
    title: str,
    steps: list[tuple[str, str, str | None]],
) -> TestCase:
    test_case = db.query(TestCase).filter(TestCase.code == code).one_or_none()
    if test_case:
        return test_case

    test_case = TestCase(
        suite_id=suite.id,
        code=code,
        title=title,
        description=f"Demo test case {code}.",
        preconditions="Uživatel má dostupné testovací prostředí.",
        expected_summary="Scénář proběhne bez chyby.",
        status="ready",
        automated=False,
        created_by=admin.id,
    )
    db.add(test_case)
    db.flush()

    for order, (action, expected_result, test_data) in enumerate(steps, start=1):
        db.add(
            TestStep(
                test_case_id=test_case.id,
                step_order=order,
                action=action,
                expected_result=expected_result,
                test_data=test_data,
            )
        )

    return test_case


def get_or_create_test_run(
    db: Session,
    *,
    admin: User,
    test_cases: list[TestCase],
) -> TestRun:
    test_run = (
        db.query(TestRun)
        .filter(TestRun.name == "Smoke test E-shop")
        .one_or_none()
    )
    if test_run:
        return test_run

    test_run = TestRun(
        name="Smoke test E-shop",
        description="Demo test run pro ověření základních funkcí e-shopu.",
        version="2026.05",
        environment="staging",
        status="open",
        created_by=admin.id,
    )
    db.add(test_run)
    db.flush()

    for test_case in test_cases:
        db.add(
            TestRunCase(
                test_run_id=test_run.id,
                test_case_id=test_case.id,
                assigned_to=admin.id,
                result="not_run",
            )
        )

    return test_run


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        admin = get_or_create_admin(db)
        authentication_api = get_or_create_suite(
            db,
            admin=admin,
            name="Authentication API",
            sort_order=10,
        )
        checkout = get_or_create_suite(
            db,
            admin=admin,
            name="Checkout",
            sort_order=20,
        )

        test_cases = [
            get_or_create_test_case(
                db,
                suite=authentication_api,
                admin=admin,
                code="ESHOP-TC-001",
                title="Přihlášení platného uživatele",
                steps=[
                    ("Odeslat platné přihlašovací údaje.", "API vrátí access token.", "admin@example.com"),
                    ("Načíst profil přihlášeného uživatele.", "API vrátí detail uživatele.", None),
                ],
            ),
            get_or_create_test_case(
                db,
                suite=authentication_api,
                admin=admin,
                code="ESHOP-TC-002",
                title="Odmítnutí neplatného hesla",
                steps=[
                    ("Odeslat login s neplatným heslem.", "API vrátí chybu 401.", "wrong-password"),
                ],
            ),
            get_or_create_test_case(
                db,
                suite=checkout,
                admin=admin,
                code="ESHOP-TC-003",
                title="Dokončení objednávky kartou",
                steps=[
                    ("Přidat produkt do košíku.", "Produkt je v košíku.", "SKU-1001"),
                    ("Vyplnit dodací údaje.", "Dodací údaje jsou uloženy.", None),
                    ("Potvrdit platbu kartou.", "Objednávka je vytvořena.", "test-card"),
                ],
            ),
        ]

        get_or_create_test_run(db, admin=admin, test_cases=test_cases)
        db.commit()
        print("Demo data byla úspěšně založena nebo už existovala.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
