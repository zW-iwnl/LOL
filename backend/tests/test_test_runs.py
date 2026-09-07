from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_test_case(client: TestClient, headers: dict[str, str], code: str = "TC-RUN-1") -> dict:
    response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "suite_id": 1,
            "code": code,
            "title": "Run workflow case",
            "status": "ready",
            "automated": False,
            "steps": [{"step_order": 1, "action": "Open page", "expected_result": "Page is visible"}],
        },
    )
    assert response.status_code == 201
    return response.json()


def create_test_run(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/test-runs",
        headers=headers,
        json={"name": "Regression", "environment": "TEST", "status": "open"},
    )
    assert response.status_code == 201
    return response.json()


def add_case_to_run(client: TestClient, headers: dict[str, str], run_id: int, case_id: int) -> dict:
    response = client.post(
        f"/api/test-runs/{run_id}/cases",
        headers=headers,
        json={"test_case_ids": [case_id], "assigned_to": 1},
    )
    assert response.status_code == 201
    return response.json()


def test_run_case_assignment_can_be_changed_and_removed(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_run = create_test_run(client, headers)
    updated_run = add_case_to_run(client, headers, test_run["id"], test_case["id"])
    run_case = updated_run["test_run_cases"][0]

    assign_response = client.put(
        f"/api/test-run-cases/{run_case['id']}",
        headers=headers,
        json={"assigned_to": None},
    )
    assert assign_response.status_code == 200
    assert assign_response.json()["assigned_to"] is None

    delete_response = client.delete(f"/api/test-run-cases/{run_case['id']}", headers=headers)
    assert delete_response.status_code == 204

    run_response = client.get(f"/api/test-runs/{test_run['id']}", headers=headers)
    assert run_response.status_code == 200
    assert run_response.json()["test_run_cases"] == []


def test_executed_run_case_cannot_be_removed(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_run = create_test_run(client, headers)
    updated_run = add_case_to_run(client, headers, test_run["id"], test_case["id"])
    run_case = updated_run["test_run_cases"][0]

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/result",
        headers=headers,
        json={"result": "passed", "comment": "OK"},
    )
    assert result_response.status_code == 200

    delete_response = client.delete(f"/api/test-run-cases/{run_case['id']}", headers=headers)
    assert delete_response.status_code == 409
    assert delete_response.json()["detail"] == "Provedený test run case nelze odebrat z runu."


def test_archived_run_cannot_be_executed(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_run = create_test_run(client, headers)
    updated_run = add_case_to_run(client, headers, test_run["id"], test_case["id"])
    run_case = updated_run["test_run_cases"][0]

    archive_response = client.delete(f"/api/test-runs/{test_run['id']}", headers=headers)
    assert archive_response.status_code == 204

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/result",
        headers=headers,
        json={"result": "passed", "comment": "Late execution"},
    )
    assert result_response.status_code == 400
    assert result_response.json()["detail"] == "Archivovaný test run nelze exekuovat."


def test_test_run_list_uses_lightweight_case_contract(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers, code="TC-RUN-LIST")
    test_run = create_test_run(client, headers)
    add_case_to_run(client, headers, test_run["id"], test_case["id"])

    response = client.get("/api/test-runs", headers=headers)

    assert response.status_code == 200
    listed_case = response.json()[0]["test_run_cases"][0]
    assert set(listed_case) == {
        "id",
        "test_run_id",
        "test_case_id",
        "assigned_to",
        "result",
    }
