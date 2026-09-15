from conftest import TestingSessionLocal
from app.models import TestCase as CaseModel
from tests.test_suite_groups import add_child, create_group
from tests.test_test_runs import auth_headers, create_test_case, create_test_run, add_case_to_run


def test_navigation_is_scoped_to_attempt_and_keeps_retired_cases(client):
    headers = auth_headers(client)
    first = create_test_case(client, headers, "FIRST")
    second = create_test_case(client, headers, "SECOND")
    outside = create_test_case(client, headers, "OUTSIDE")
    run = create_test_run(client, headers)
    add_case_to_run(client, headers, run["id"], first["id"])
    before = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers).json()
    original_snapshot = before["test_run_cases"][0]["test_case_snapshot"]
    first_attempt_id = before["selected_attempt_id"]
    result = client.put(f"/api/test-run-case-attempts/{before['test_run_cases'][0]['case_attempt_id']}/result",
                        headers=headers, json={"result": "failed"})
    assert result.status_code == 200, result.text
    rerun = client.post(f"/api/test-runs/{run['id']}/reruns", headers=headers)
    assert rerun.status_code == 201, rerun.text
    add_case_to_run(client, headers, run["id"], second["id"])
    group = create_group(client, headers, "Aktuální skupina")
    assert client.post(f"/api/suite-groups/{group['id']}/members", headers=headers, json={"suite_id": 1}).status_code == 201
    # Execution must not inherit the creation catalog's eligibility filters.
    with TestingSessionLocal() as db:
        case = db.get(CaseModel, first["id"])
        case.status = "deprecated"
        case.current_approved_version_id = None
        db.commit()
    assert client.put("/api/test-suites/1", headers=headers, json={"is_active": False}).status_code == 200
    current = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers).json()
    assert current["navigation"]["suites"][0]["case_ids"] == [first["id"], second["id"]]
    assert outside["id"] not in current["navigation"]["groups"][0]["case_ids"]
    historical = client.get(f"/api/test-runs/{run['id']}/execution?attempt_id={first_attempt_id}", headers=headers).json()
    assert historical["navigation"]["groups"][0]["case_ids"] == [first["id"]]
    assert historical["test_run_cases"][0]["test_case_snapshot"] == original_snapshot


def test_navigation_keeps_dag_placements_direct_cases_and_edge_scope(client):
    headers = auth_headers(client)
    own = create_test_case(client, headers, "OWN")
    leaf_case = create_test_case(client, headers, "LEAF")
    run = create_test_run(client, headers)
    add_case_to_run(client, headers, run["id"], own["id"])
    add_case_to_run(client, headers, run["id"], leaf_case["id"])
    root = create_group(client, headers, "Root")
    alternate = create_group(client, headers, "Alternate")
    middle = create_group(client, headers, "Middle")
    leaf = create_group(client, headers, "Leaf")
    add_child(client, headers, root["id"], middle["id"], include_descendants=False)
    add_child(client, headers, alternate["id"], middle["id"])
    add_child(client, headers, middle["id"], leaf["id"])
    for group, case in [(middle, own), (leaf, leaf_case)]:
        assert client.put(f"/api/suite-groups/{group['id']}/test-case-members", headers=headers,
                          json={"test_case_ids": [case["id"]]}).status_code == 200
    response = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers)
    assert response.status_code == 200, response.text
    groups = {group["id"]: group for group in response.json()["navigation"]["groups"]}
    assert groups[root["id"]]["case_ids"] == [own["id"]]
    assert groups[root["id"]]["children"] == [{"group_id": middle["id"], "include_descendants": False}]
    assert groups[alternate["id"]]["case_ids"] == [own["id"], leaf_case["id"]]
    assert groups[middle["id"]]["direct_case_ids"] == [own["id"]]
    assert groups[middle["id"]]["own_case_ids"] == [own["id"]]
    assert len(response.json()["test_run_cases"]) == 2


def test_empty_execution_has_empty_navigation(client):
    headers = auth_headers(client)
    run = create_test_run(client, headers)
    response = client.get(f"/api/test-runs/{run['id']}/execution", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["navigation"] == {"groups": [], "suites": []}
