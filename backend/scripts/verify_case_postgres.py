"""API, row-lock and trigger checks in an explicitly isolated migrated database."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.main import app
from app.models import User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    live_url = make_url(settings.database_url)
    if not args.database.startswith("approval_verify_") or args.database == live_url.database:
        raise SystemExit("Refusing tests outside an isolated verification database")
    engine = create_engine(live_url.set(database=args.database), pool_size=5)
    sessions = sessionmaker(bind=engine, autoflush=False)
    def override():
        with sessions() as session:
            yield session
    app.dependency_overrides[get_db] = override
    with sessions() as session:
        for index in (1, 2):
            email = f"approval-reviewer{index}@example.cz"
            if not session.query(User).filter(User.email == email).first():
                session.add(User(name=f"Verification reviewer {index}", email=email,
                                 password_hash=hash_password("Review-only-pass123"), role="test_lead", is_active=True))
        session.commit()
    client = TestClient(app)
    def login(email, password):
        response = client.post("/api/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    author = login("admin@testmanager.cz", "admin123")
    reviewers = [login(f"approval-reviewer{i}@example.cz", "Review-only-pass123") for i in (1, 2)]
    def post(path, body, headers=author, expected=201, key=None):
        response = client.post("/api" + path, headers={**headers, "Idempotency-Key": key or str(uuid4())}, json=body)
        assert response.status_code == expected, response.text
        return response.json()
    content = {"title": "PostgreSQL version verification", "steps": [{"step_order": 1, "action": "Provést kontrolu", "expected_result": "Očekávaný stav"}]}
    draft = post("/case-proposals", {"suite_id": 1, "content": content})
    review = post(f"/test-case-drafts/{draft['id']}/submissions", {"lock_version": draft["lock_version"], "change_summary": "Concurrency verification"})
    def decide(headers):
        return client.post(f"/api/test-case-reviews/{review['id']}/decisions", headers={**headers, "Idempotency-Key": str(uuid4())},
                           json={"lock_version": review["lock_version"], "status": "approved"}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(decide, reviewers))
    assert sorted(outcomes) in ([200, 409], [200, 412]), outcomes
    with engine.connect() as connection:
        try:
            connection.execute(text("UPDATE test_case_versions SET content_hash='tampered' WHERE id=:id"), {"id": review["test_case_version_id"]})
            raise AssertionError("Immutable-version trigger did not reject change")
        except DBAPIError:
            connection.rollback()
    run = post("/test-runs", {"name": "PostgreSQL run-version verification"})
    run_draft = post(f"/test-runs/{run['id']}/case-drafts", {"suite_id": 1, "content": content})
    bound = post(f"/test-runs/{run['id']}/draft-executions", {"draft_id": run_draft["id"], "lock_version": run_draft["lock_version"]})
    first = client.get(f"/api/test-runs/{run['id']}/execution", headers=author).json()["test_run_cases"][0]
    original = deepcopy(first["test_case_snapshot"])
    step = original["steps"][0]
    result = client.put(f"/api/test-run-case-attempts/{bound['case_attempt_id']}/steps/{step['id']}/result", headers=author, json={"result": "failed"})
    assert result.status_code == 200, result.text
    changed = deepcopy(run_draft["content"])
    changed["title"] = "Corrected PostgreSQL scenario"
    saved = client.patch(f"/api/test-case-drafts/{run_draft['id']}", headers={**author, "Idempotency-Key": str(uuid4())},
                         json={"lock_version": run_draft["lock_version"], "content": changed, "change_summary": "Correction"})
    assert saved.status_code == 200, saved.text
    rerun = post(f"/test-run-case-attempts/{bound['case_attempt_id']}/reruns", {"draft_id": run_draft["id"], "lock_version": saved.json()["lock_version"]})
    history = rerun["test_run_cases"][0]["case_attempts"]
    assert history[0]["execution_snapshot"] == original
    assert history[0]["step_results"][0]["result"] == "failed"
    assert history[-1]["execution_snapshot"]["title"] == changed["title"]
    assert history[-1]["step_results"][0]["result"] == "not_run"
    key = str(uuid4())
    retry_payload = {"suite_id": 1, "content": content}
    first_retry = post("/case-proposals", retry_payload, key=key)
    second_retry = post("/case-proposals", retry_payload, key=key)
    assert first_retry == second_retry
    print("PASS: PostgreSQL approval race, immutable trigger, per-attempt snapshots, step results, idempotent retry")
    app.dependency_overrides.clear()


if __name__ == "__main__":
    main()
