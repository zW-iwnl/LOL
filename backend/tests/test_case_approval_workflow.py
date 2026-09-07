"""End-to-end domain tests. PostgreSQL concurrency is covered separately."""
from copy import deepcopy
from uuid import uuid4

import pytest

from app.core.security import hash_password
from app.models import User
from conftest import TestingSessionLocal
from tests.test_auth import login


def post(client, headers, path, payload=None, *, key=None):
    return client.post(f"/api{path}", headers={**headers, "Idempotency-Key": key or str(uuid4())}, json=payload or {})


def patch(client, headers, path, payload):
    return client.patch(f"/api{path}", headers={**headers, "Idempotency-Key": str(uuid4())}, json=payload)


@pytest.fixture
def actors(client):
    with TestingSessionLocal() as db:
        db.add(User(id=2, name="Reviewer", email="reviewer@example.cz", password_hash=hash_password("reviewer123"), role="reviewer", is_active=True))
        db.commit()
    author = {"Authorization": f"Bearer {login(client)}"}
    reviewer_login = client.post("/api/auth/login", json={"email": "reviewer@example.cz", "password": "reviewer123"})
    assert reviewer_login.status_code == 200
    reviewer = {"Authorization": f"Bearer {reviewer_login.json()['access_token']}"}
    return author, reviewer


def test_admin_can_create_reviewer_but_reviewer_cannot_manage_users(client, actors):
    author, reviewer = actors
    payload = {"name": "Nový reviewer", "email": "new-reviewer@example.cz", "password": "Review-only-pass123", "role": "reviewer"}
    assert client.post("/api/users", headers=reviewer, json=payload).status_code == 403
    created = client.post("/api/users", headers=author, json=payload)
    assert created.status_code == 201, created.text
    assert "password" not in created.text
    assert client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]}).status_code == 200
    assert client.post("/api/users", headers=author, json=payload).status_code == 409
    assert client.post("/api/users", headers=author, json={**payload, "password": "short"}).status_code == 422


def content(title="Scénář"):
    return {"title": title, "steps": [{"step_key": str(uuid4()), "step_order": 1, "action": "Otevřít stránku", "expected_result": "Stránka je zobrazena"}]}


def proposal(client, author, *, run_id=None):
    response = post(client, author, f"/test-runs/{run_id}/case-drafts" if run_id else "/case-proposals", {"suite_id": 1, "content": content()})
    assert response.status_code == 201, response.text
    return response.json()


def submit(client, author, draft):
    response = post(client, author, f"/test-case-drafts/{draft['id']}/submissions", {"lock_version": draft["lock_version"], "change_summary": "Nový regresní scénář"})
    assert response.status_code == 201, response.text
    return response.json()


def decide(client, reviewer, review, status="approved"):
    assigned = patch(client, reviewer, f"/test-case-reviews/{review['id']}/assignment", {"lock_version": review["lock_version"], "reviewer_id": 2})
    assert assigned.status_code == 200, assigned.text
    response = post(client, reviewer, f"/test-case-reviews/{review['id']}/decisions", {"lock_version": assigned.json()["lock_version"], "status": status, "reason": "Zkontrolováno"})
    assert response.status_code == 200, response.text
    return response.json()


def run(client, author):
    response = client.post("/api/test-runs", headers=author, json={"name": "Explorační testování"})
    assert response.status_code == 201
    return response.json()


def execution(client, author, run_id):
    response = client.get(f"/api/test-runs/{run_id}/execution", headers=author)
    assert response.status_code == 200, response.text
    return response.json()


def test_exact_version_review_and_no_self_approval(client, actors):
    author, reviewer = actors
    draft = proposal(client, author)
    review = submit(client, author, draft)
    assert post(client, author, f"/test-case-reviews/{review['id']}/decisions", {"lock_version": review["lock_version"], "status": "approved"}).status_code == 403
    saved = decide(client, reviewer, review)
    case = client.get(f"/api/test-cases/{draft['test_case_id']}", headers=author).json()
    assert case["current_approved_version_id"] == review["test_case_version_id"]
    assert case["status"] == "ready"
    assert case["code"] == draft["code"]
    assert saved["version"]["approval_state"] == "approved"
    assert client.get(f"/api/test-case-drafts/{draft['id']}", headers=author).json()["status"] == "closed"


def test_repeated_saves_do_not_create_versions_and_stale_edit_rejected(client, actors):
    author, _ = actors
    draft = proposal(client, author)
    stale = deepcopy(draft)
    for index in range(5):
        response = patch(client, author, f"/test-case-drafts/{draft['id']}", {"lock_version": draft["lock_version"], "content": draft["content"], "change_summary": str(index)})
        assert response.status_code == 200
        draft = response.json()
    assert client.get(f"/api/test-cases/{draft['test_case_id']}/versions", headers=author).json()["total"] == 0
    assert patch(client, author, f"/test-case-drafts/{draft['id']}", {"lock_version": stale["lock_version"], "content": stale["content"]}).status_code == 412


def test_submission_locks_draft_and_new_branch(client, actors):
    author, _ = actors
    draft = proposal(client, author)
    submit(client, author, draft)
    current = client.get(f"/api/test-case-drafts/{draft['id']}", headers=author).json()
    assert patch(client, author, f"/test-case-drafts/{draft['id']}", {"lock_version": current["lock_version"], "content": draft["content"]}).status_code == 409
    assert post(client, author, f"/test-cases/{draft['test_case_id']}/drafts").status_code == 409


def test_run_origin_freeze_reuse_and_history_per_attempt(client, actors):
    author, reviewer = actors
    test_run = run(client, author)
    draft = proposal(client, author, run_id=test_run["id"])
    first = post(client, author, f"/test-runs/{test_run['id']}/draft-executions", {"draft_id": draft["id"], "lock_version": draft["lock_version"]})
    assert first.status_code == 201, first.text
    first_attempt = first.json()["case_attempt_id"]
    result = client.put(f"/api/test-run-case-attempts/{first_attempt}/result", headers=author, json={"result": "failed"})
    assert result.status_code == 200
    original = execution(client, author, test_run["id"])["test_run_cases"][0]["test_case_snapshot"]
    review = submit(client, author, draft)
    assert review["test_case_version_id"] == first.json()["version_id"]
    decide(client, reviewer, review, "changes_requested")
    draft = client.get(f"/api/test-case-drafts/{draft['id']}", headers=author).json()
    draft["content"]["title"] = "Opravený scénář"
    saved = patch(client, author, f"/test-case-drafts/{draft['id']}", {"lock_version": draft["lock_version"], "content": draft["content"], "change_summary": "Oprava"})
    assert saved.status_code == 200
    draft = saved.json()
    rerun = post(client, author, f"/test-run-case-attempts/{first_attempt}/reruns", {"draft_id": draft["id"], "lock_version": draft["lock_version"]})
    assert rerun.status_code == 201, rerun.text
    item = rerun.json()["test_run_cases"][0]
    assert item["test_case_snapshot"]["title"] == "Opravený scénář"
    assert item["case_attempts"][0]["execution_snapshot"] == original
    assert item["case_attempts"][0]["result"] == "failed"
    assert item["case_attempts"][0]["closure_reason"] == "definition_changed"
    assert item["case_attempts"][-1]["result"] == "not_run"
    next_review = submit(client, author, draft)
    assert next_review["version_number"] == 2
    decide(client, reviewer, next_review)
    current = execution(client, author, test_run["id"])["test_run_cases"][0]
    assert current["case_attempts"][0]["approval_state_at_start"] == "unsubmitted"
    assert current["case_attempts"][0]["execution_snapshot"] == original


def test_draft_cannot_enter_standard_run_or_another_origin_run(client, actors):
    author, _ = actors
    source, other = run(client, author), run(client, author)
    draft = proposal(client, author, run_id=source["id"])
    assert client.post(f"/api/test-runs/{other['id']}/cases", headers=author, json={"test_case_ids": [draft["test_case_id"]]}).status_code == 409
    assert post(client, author, f"/test-runs/{other['id']}/draft-executions", {"draft_id": draft["id"], "lock_version": draft["lock_version"]}).status_code == 409


def test_rejected_definition_preserves_failed_execution_and_blocks_rerun(client, actors):
    author, reviewer = actors
    source = run(client, author)
    draft = proposal(client, author, run_id=source["id"])
    first = post(client, author, f"/test-runs/{source['id']}/draft-executions", {"draft_id": draft["id"], "lock_version": draft["lock_version"]}).json()
    assert client.put(f"/api/test-run-case-attempts/{first['case_attempt_id']}/result", headers=author, json={"result": "failed"}).status_code == 200
    decide(client, reviewer, submit(client, author, draft), "rejected")
    assert post(client, author, f"/test-run-case-attempts/{first['case_attempt_id']}/reruns").status_code == 409
    assert execution(client, author, source["id"])["test_run_cases"][0]["result"] == "failed"


def test_idempotent_create_and_different_payload_conflict(client, actors):
    author, _ = actors
    key = str(uuid4())
    payload = {"suite_id": 1, "content": content()}
    payload["content"]["steps"][0].pop("step_key")
    a = post(client, author, "/case-proposals", payload, key=key)
    b = post(client, author, "/case-proposals", payload, key=key)
    assert a.status_code == b.status_code == 201
    assert a.json() == b.json()
    payload["content"]["title"] = "Jiné zadání"
    assert post(client, author, "/case-proposals", payload, key=key).status_code == 409


def test_cannot_bypass_review_through_old_crud(client, actors):
    author, _ = actors
    draft = proposal(client, author)
    assert client.put(f"/api/test-cases/{draft['test_case_id']}", headers=author, json={"status": "ready"}).status_code == 409
    assert client.post("/api/test-cases", headers=author, json={"suite_id": 1, "code": "BYPASS", "title": "Bypass", "status": "ready"}).status_code == 422
    assert client.post(f"/api/test-cases/{draft['test_case_id']}/steps", headers=author, json={"step_order": 1, "action": "Bypass"}).status_code == 409


def test_blocking_comment_and_decision_race_guard(client, actors):
    author, reviewer = actors
    review = submit(client, author, proposal(client, author))
    assigned = patch(client, reviewer, f"/test-case-reviews/{review['id']}/assignment", {"lock_version": review["lock_version"], "reviewer_id": 2}).json()
    comment = post(client, reviewer, f"/test-case-reviews/{review['id']}/comments", {"body": "Doplňte očekávání", "is_blocking": True})
    assert comment.status_code == 201
    detail = client.get(f"/api/test-case-reviews/{review['id']}", headers=author).json()
    assert post(client, reviewer, f"/test-case-reviews/{review['id']}/decisions", {"lock_version": detail["lock_version"], "status": "approved"}).status_code == 409
    assert post(client, author, f"/test-case-review-comments/{comment.json()['id']}/resolutions").status_code == 200
    detail = client.get(f"/api/test-case-reviews/{review['id']}", headers=author).json()
    assert post(client, reviewer, f"/test-case-reviews/{review['id']}/decisions", {"lock_version": detail["lock_version"], "status": "approved"}).status_code == 200
    assert post(client, reviewer, f"/test-case-reviews/{review['id']}/decisions", {"lock_version": assigned["lock_version"], "status": "rejected", "reason": "Pozdě"}).status_code in (409, 412)


def test_execution_creation_rolls_back_on_step_failure(client, actors, monkeypatch):
    from app.services import run_case_creation
    author, _ = actors
    source = run(client, author)
    draft = proposal(client, author, run_id=source["id"])
    def fail(*args):
        raise RuntimeError("Simulovaný výpadek při založení kroků")
    monkeypatch.setattr(run_case_creation, "add_steps", fail)
    with pytest.raises(RuntimeError):
        post(client, author, f"/test-runs/{source['id']}/draft-executions", {"draft_id": draft["id"], "lock_version": draft["lock_version"]})
    assert execution(client, author, source["id"])["test_run_cases"] == []
    assert client.get(f"/api/test-cases/{draft['test_case_id']}/versions", headers=author).json()["total"] == 0


def test_archive_preserves_drafts_and_versions(client, actors):
    author, reviewer = actors
    draft = proposal(client, author)
    decide(client, reviewer, submit(client, author, draft))
    assert client.delete(f"/api/test-cases/{draft['test_case_id']}", headers=author).status_code == 204
    assert client.get(f"/api/test-cases/{draft['test_case_id']}/versions", headers=author).json()["total"] == 1
    assert post(client, author, f"/test-cases/{draft['test_case_id']}/drafts").status_code == 409
