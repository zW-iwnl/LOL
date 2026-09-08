import pytest
from fastapi.testclient import TestClient

from conftest import TestingSessionLocal
from app.models import TestCase as CaseModel, TestRun as RunModel, TestRunAttempt as AttemptModel
from tests.test_suite_groups import add_child, create_group
from tests.test_test_runs import auth_headers, create_test_case
from tests.test_test_suites import create_suite
from tests.workflow_factories import create_reviewed_case


def preview(client, headers, selection):
    response = client.post("/api/test-runs/selection-preview", headers=headers, json=selection)
    assert response.status_code == 200, response.text
    return response.json()


def create_from_selection(client, headers, selection, snapshot, **fields):
    return client.post("/api/test-runs", headers=headers, json={
        "name": "Výběr repository", "selection": selection,
        "selection_fingerprint": snapshot["fingerprint"], **fields,
    })


def test_group_suite_and_explicit_case_overlap_creates_one_bound_attempt(client: TestClient):
    headers = auth_headers(client)
    case = create_test_case(client, headers)
    first = create_group(client, headers, "Regrese")
    second = create_group(client, headers, "Smoke")
    for group in [first, second]:
        assert client.post(f"/api/suite-groups/{group['id']}/members", headers=headers,
                           json={"suite_id": 1}).status_code == 201
    selection = {"groups": [{"group_id": first["id"]}, {"group_id": second["id"]}],
                 "suite_ids": [1, 1], "test_case_ids": [case["id"], case["id"]]}
    snapshot = preview(client, headers, selection)
    assert [item["id"] for item in snapshot["cases"]] == [case["id"]]
    created = create_from_selection(client, headers, selection, snapshot,
                                    name="  Regrese  ", task_number="  QA-123  ", assigned_to=1,
                                    planned_end="2026-10-01T12:00:00+02:00")
    assert created.status_code == 201, created.text
    run = created.json()
    assert run["name"] == "Regrese"
    assert run["task_number"] == "QA-123"
    assert len(run["test_run_cases"]) == 1
    assert run["test_run_cases"][0]["assigned_to"] == 1
    execution = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers).json()
    attempts = execution["test_run_cases"][0]["case_attempts"]
    assert len(attempts) == 1
    assert attempts[0]["test_case_version_id"] == case["current_approved_version_id"]
    assert attempts[0]["execution_snapshot"]["title"] == case["title"]
    found = client.get("/api/test-runs?q=QA-123", headers=headers).json()
    assert [item["id"] for item in found] == [run["id"]]
    updated = client.put(f"/api/test-runs/{run['id']}", headers=headers, json={"task_number": "QA-456"})
    assert updated.status_code == 200
    assert updated.json()["task_number"] == "QA-456"
    for group in [first, second]:
        assert client.delete(f"/api/suite-groups/{group['id']}/members/1", headers=headers).status_code == 204
    after = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers).json()
    assert after["test_run_cases"][0]["case_attempts"][0]["execution_snapshot"] == attempts[0]["execution_snapshot"]


def test_selection_respects_dag_edge_scope_and_direct_group_cases(client: TestClient):
    headers = auth_headers(client)
    root = create_group(client, headers, "Root")
    middle = create_group(client, headers, "Middle")
    leaf = create_group(client, headers, "Leaf")
    add_child(client, headers, root["id"], middle["id"], include_descendants=False)
    add_child(client, headers, middle["id"], leaf["id"])
    own = create_test_case(client, headers, "OWN")
    nested = create_test_case(client, headers, "NESTED")
    for group, case in [(middle, own), (leaf, nested)]:
        assert client.put(f"/api/suite-groups/{group['id']}/test-case-members", headers=headers,
                          json={"test_case_ids": [case["id"]]}).status_code == 200
    def ids(group, descendants=True):
        return {item["id"] for item in preview(client, headers, {
            "groups": [{"group_id": group["id"], "include_descendants": descendants}],
        })["cases"]}
    assert ids(root) == {own["id"]}
    assert ids(root, False) == set()
    assert ids(middle) == {own["id"], nested["id"]}
    assert ids(middle, False) == {own["id"]}


def test_catalog_exposes_case_tags_for_suite_and_group_search_and_exclusions(client: TestClient):
    headers = auth_headers(client)
    tag = client.post("/api/test-case-tags", headers=headers,
                      json={"name": "Platby", "category": "business_area"}).json()
    ready = create_reviewed_case(client, headers=headers, json={
        "suite_id": 1, "code": "TAGGED", "title": "Platba kartou", "tag_ids": [tag["id"]],
    }).json()
    draft = client.post("/api/test-cases", headers=headers,
                        json={"suite_id": 1, "code": "DRAFT", "title": "Návrh", "status": "draft"}).json()
    catalog = client.get("/api/test-runs/selection-catalog", headers=headers)
    assert catalog.status_code == 200, catalog.text
    assert next(item for item in catalog.json()["cases"] if item["id"] == ready["id"])["tags"] == ["Platby"]
    snapshot = preview(client, headers, {"suite_ids": [1]})
    assert [item["id"] for item in snapshot["cases"]] == [ready["id"]]
    assert [(item["id"], item["exclusion_reason"]) for item in snapshot["excluded_cases"]] == [(draft["id"], "Chybí schválená verze")]


@pytest.mark.parametrize("change", ["membership", "approval", "deprecated"])
def test_changed_selection_requires_new_preview_without_creating_run(client: TestClient, change):
    headers = auth_headers(client)
    case = create_test_case(client, headers)
    selection = {"suite_ids": [1]}
    snapshot = preview(client, headers, selection)
    if change == "membership":
        create_test_case(client, headers, "ADDED")
    else:
        with TestingSessionLocal() as db:
            model = db.get(CaseModel, case["id"])
            if change == "approval":
                model.current_approved_version_id = None
            else:
                model.status = "deprecated"
            db.commit()
    response = create_from_selection(client, headers, selection, snapshot)
    assert response.status_code == 409, response.text
    with TestingSessionLocal() as db:
        assert db.query(RunModel).count() == 0
        assert db.query(AttemptModel).count() == 0


def test_failed_assignment_rolls_back_run_and_attempt(client: TestClient):
    headers = auth_headers(client)
    create_test_case(client, headers)
    selection = {"suite_ids": [1]}
    response = create_from_selection(client, headers, selection, preview(client, headers, selection), assigned_to=99999)
    assert response.status_code == 400, response.text
    with TestingSessionLocal() as db:
        assert db.query(RunModel).count() == 0
        assert db.query(AttemptModel).count() == 0


def test_failure_after_adding_cases_does_not_commit_partial_run(client: TestClient, monkeypatch):
    from app.services import test_runs
    headers = auth_headers(client)
    create_test_case(client, headers)
    selection = {"suite_ids": [1]}
    snapshot = preview(client, headers, selection)
    original = test_runs.add_test_cases

    def fail_after_add(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Simulated failure after binding")

    monkeypatch.setattr(test_runs, "add_test_cases", fail_after_add)
    with pytest.raises(RuntimeError, match="Simulated failure"):
        create_from_selection(client, headers, selection, snapshot)
    with TestingSessionLocal() as db:
        assert db.query(RunModel).count() == 0
        assert db.query(AttemptModel).count() == 0


def test_inactive_suites_and_deprecated_cases_are_reported_in_preview(client: TestClient):
    headers = auth_headers(client)
    inactive = create_suite(client, headers, "Neaktivní")
    ready = create_reviewed_case(client, headers=headers, json={
        "suite_id": inactive["id"], "code": "INACTIVE", "title": "Neaktivní suita",
    }).json()
    deprecated = create_test_case(client, headers, "DEPRECATED")
    assert client.put(f"/api/test-suites/{inactive['id']}", headers=headers, json={"is_active": False}).status_code == 200
    assert client.delete(f"/api/test-cases/{deprecated['id']}", headers=headers).status_code == 204
    snapshot = preview(client, headers, {"suite_ids": [1, inactive["id"]]})
    assert snapshot["cases"] == []
    assert {item["id"]: item["exclusion_reason"] for item in snapshot["excluded_cases"]} == {
        ready["id"]: "Neaktivní test suita", deprecated["id"]: "Vyřazený test case",
    }


def test_empty_and_missing_selection_are_rejected(client: TestClient):
    headers = auth_headers(client)
    assert create_from_selection(client, headers, {}, preview(client, headers, {})).status_code == 422
    assert client.post("/api/test-runs/selection-preview", headers=headers, json={"suite_ids": [99999]}).status_code == 422
    assert client.post("/api/test-runs/selection-preview", headers=headers, json={"groups": [{"group_id": 99999}]}).status_code == 422
    assert client.post("/api/test-runs/selection-preview", headers=headers, json={"test_case_ids": [-1]}).status_code == 422


@pytest.mark.parametrize("fields", [{"name": "   "}, {"task_number": "x" * 101},
    {"planned_start": "2026-10-02T12:00:00Z", "planned_end": "2026-10-01T12:00:00Z"}])
def test_run_metadata_validation(client: TestClient, fields):
    headers = auth_headers(client)
    assert client.post("/api/test-runs", headers=headers, json={"name": "Run", **fields}).status_code == 422
