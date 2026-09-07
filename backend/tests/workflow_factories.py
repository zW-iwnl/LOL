"""Explicit approved fixtures for tests whose subject is not the review process."""
from uuid import uuid4

from app.core.security import hash_password
from app.models import User
from conftest import TestingSessionLocal


def create_reviewed_case(client, *, headers, json):
    payload = {**json, "status": "draft"}
    payload.setdefault("steps", [{"step_order": 1, "action": "Ověřit scénář", "expected_result": "Očekávané chování"}])
    created = client.post("/api/test-cases", headers=headers, json=payload)
    if created.status_code != 201:
        return created
    case_id = created.json()["id"]
    draft = client.get(f"/api/test-case-drafts?case_id={case_id}", headers=headers).json()["items"][0]
    review = client.post(f"/api/test-case-drafts/{draft['id']}/submissions", headers={**headers, "Idempotency-Key": str(uuid4())},
                         json={"lock_version": draft["lock_version"], "change_summary": "Schválený scénář pro integrační test"})
    assert review.status_code == 201, review.text
    with TestingSessionLocal() as db:
        if not db.get(User, 900):
            db.add(User(id=900, name="Independent fixture reviewer", email="fixture-reviewer@example.cz", role="reviewer",
                        password_hash=hash_password("fixture-reviewer-password"), is_active=True))
            db.commit()
    auth = client.post("/api/auth/login", json={"email": "fixture-reviewer@example.cz", "password": "fixture-reviewer-password"})
    reviewer = {"Authorization": f"Bearer {auth.json()['access_token']}"}
    assigned = client.patch(f"/api/test-case-reviews/{review.json()['id']}/assignment", headers={**reviewer, "Idempotency-Key": str(uuid4())},
                            json={"lock_version": review.json()["lock_version"], "reviewer_id": 900})
    assert assigned.status_code == 200, assigned.text
    decided = client.post(f"/api/test-case-reviews/{review.json()['id']}/decisions", headers={**reviewer, "Idempotency-Key": str(uuid4())},
                          json={"lock_version": assigned.json()["lock_version"], "status": "approved"})
    assert decided.status_code == 200, decided.text
    return client.get(f"/api/test-cases/{case_id}", headers=headers)
