from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Project, TestCase, TestRun, TestRunCase, TestStep, TestSuite, User


ADMIN_EMAIL = "admin@testmanager.cz"
ADMIN_PASSWORD = "admin123"
PROJECT_CODE = "ESHOP"


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


def get_or_create_project(db: Session, admin: User) -> Project:
    project = db.query(Project).filter(Project.code == PROJECT_CODE).one_or_none()
    if project:
        return project

    project = Project(
        name="E-shop",
        code=PROJECT_CODE,
        description="Demo projekt pro regresní testování e-shopu.",
        status="active",
        created_by=admin.id,
    )
    db.add(project)
    db.flush()
    return project


def get_or_create_suite(
    db: Session,
    *,
    project: Project,
    admin: User,
    name: str,
    path: str,
    level: int,
    sort_order: int,
    parent_suite: TestSuite | None = None,
) -> TestSuite:
    suite = (
        db.query(TestSuite)
        .filter(TestSuite.project_id == project.id, TestSuite.path == path)
        .one_or_none()
    )
    if suite:
        return suite

    suite = TestSuite(
        project_id=project.id,
        parent_suite_id=parent_suite.id if parent_suite else None,
        name=name,
        description=f"Demo test suite {name}.",
        path=path,
        level=level,
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
    project: Project,
    suite: TestSuite,
    admin: User,
    code: str,
    title: str,
    priority: str,
    steps: list[tuple[str, str, str | None]],
) -> TestCase:
    test_case = db.query(TestCase).filter(TestCase.code == code).one_or_none()
    if test_case:
        return test_case

    test_case = TestCase(
        project_id=project.id,
        suite_id=suite.id,
        code=code,
        title=title,
        description=f"Demo test case {code}.",
        preconditions="Uživatel má dostupné testovací prostředí.",
        expected_summary="Scénář proběhne bez chyby.",
        priority=priority,
        type="manual",
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
    project: Project,
    admin: User,
    test_cases: list[TestCase],
) -> TestRun:
    test_run = (
        db.query(TestRun)
        .filter(TestRun.project_id == project.id, TestRun.name == "Smoke test E-shop")
        .one_or_none()
    )
    if test_run:
        return test_run

    test_run = TestRun(
        project_id=project.id,
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
                defect_count=0,
            )
        )

    return test_run


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        admin = get_or_create_admin(db)
        project = get_or_create_project(db, admin)

        backend_api = get_or_create_suite(
            db,
            project=project,
            admin=admin,
            name="Backend API",
            path="/Backend API",
            level=0,
            sort_order=10,
        )
        authentication_api = get_or_create_suite(
            db,
            project=project,
            admin=admin,
            name="Authentication API",
            path="/Backend API/Authentication API",
            level=1,
            sort_order=10,
            parent_suite=backend_api,
        )
        checkout = get_or_create_suite(
            db,
            project=project,
            admin=admin,
            name="Checkout",
            path="/Checkout",
            level=0,
            sort_order=20,
        )

        test_cases = [
            get_or_create_test_case(
                db,
                project=project,
                suite=authentication_api,
                admin=admin,
                code="ESHOP-TC-001",
                title="Přihlášení platného uživatele",
                priority="high",
                steps=[
                    ("Odeslat platné přihlašovací údaje.", "API vrátí access token.", "admin@example.com"),
                    ("Načíst profil přihlášeného uživatele.", "API vrátí detail uživatele.", None),
                ],
            ),
            get_or_create_test_case(
                db,
                project=project,
                suite=authentication_api,
                admin=admin,
                code="ESHOP-TC-002",
                title="Odmítnutí neplatného hesla",
                priority="medium",
                steps=[
                    ("Odeslat login s neplatným heslem.", "API vrátí chybu 401.", "wrong-password"),
                ],
            ),
            get_or_create_test_case(
                db,
                project=project,
                suite=checkout,
                admin=admin,
                code="ESHOP-TC-003",
                title="Dokončení objednávky kartou",
                priority="critical",
                steps=[
                    ("Přidat produkt do košíku.", "Produkt je v košíku.", "SKU-1001"),
                    ("Vyplnit dodací údaje.", "Dodací údaje jsou uloženy.", None),
                    ("Potvrdit platbu kartou.", "Objednávka je vytvořena.", "test-card"),
                ],
            ),
        ]

        get_or_create_test_run(db, project=project, admin=admin, test_cases=test_cases)
        db.commit()
        print("Demo data byla úspěšně založena nebo už existovala.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
