from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_test_case(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "suite_id": 1,
            "code": "TC-REQ-1",
            "title": "Requirement coverage case",
            "status": "ready",
            "automated": False,
        },
    )
    assert response.status_code == 201
    test_case = response.json()
    assert "priority" not in test_case
    assert "type" not in test_case
    return test_case


def test_create_requirement_with_test_case_link(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)

    response = client.post(
        "/api/requirements",
        headers=headers,
        json={
            "code": "REQ-1",
            "title": "Checkout must work",
            "priority": "critical",
            "status": "approved",
            "test_case_ids": [test_case["id"]],
        },
    )

    assert response.status_code == 201
    requirement = response.json()
    assert requirement["code"] == "REQ-1"
    assert requirement["test_cases"][0]["id"] == test_case["id"]


def test_requirement_rejects_missing_test_case(client: TestClient) -> None:
    headers = auth_headers(client)
    response = client.post(
        "/api/requirements",
        headers=headers,
        json={"code": "REQ-MISSING", "title": "Invalid link", "test_case_ids": [9999]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Test cases neexistují: [9999]"


def test_traceability_matrix_reports_latest_result(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    requirement_response = client.post(
        "/api/requirements",
        headers=headers,
        json={"code": "REQ-TRACE", "title": "Traceable requirement", "test_case_ids": [test_case["id"]]},
    )
    assert requirement_response.status_code == 201

    run_response = client.post(
        "/api/test-runs",
        headers=headers,
        json={"name": "Traceability run", "test_case_ids": [test_case["id"]]},
    )
    assert run_response.status_code == 201
    run_case = run_response.json()["test_run_cases"][0]

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/result",
        headers=headers,
        json={"result": "failed", "comment": "Fails"},
    )
    assert result_response.status_code == 200

    matrix_response = client.get("/api/traceability", headers=headers)

    assert matrix_response.status_code == 200
    row = matrix_response.json()[0]
    assert row["requirement_code"] == "REQ-TRACE"
    assert row["coverage_status"] == "covered"
    assert row["latest_result"] == "failed"
    assert row["risk_status"] == "failing"
    assert row["failed_case_count"] == 1


def test_traceability_keeps_latest_executed_result_during_case_rerun(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    requirement_response = client.post(
        "/api/requirements",
        headers=headers,
        json={
            "code": "REQ-TRACE-RERUN",
            "title": "Traceability during rerun",
            "test_case_ids": [test_case["id"]],
        },
    )
    assert requirement_response.status_code == 201

    run_response = client.post(
        "/api/test-runs",
        headers=headers,
        json={"name": "Traceability rerun", "test_case_ids": [test_case["id"]]},
    )
    assert run_response.status_code == 201
    first_case_attempt_id = (
        client.get(
            f"/api/test-runs/{run_response.json()['id']}/execution",
            headers=headers,
        )
        .json()["test_run_cases"][0]["case_attempt_id"]
    )

    result_response = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/result",
        headers=headers,
        json={"result": "failed", "comment": "Still relevant during rerun"},
    )
    assert result_response.status_code == 200
    rerun_response = client.post(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/reruns",
        headers=headers,
    )
    assert rerun_response.status_code == 201
    assert rerun_response.json()["test_run_cases"][0]["result"] == "not_run"

    matrix_response = client.get("/api/traceability", headers=headers)

    assert matrix_response.status_code == 200
    row = matrix_response.json()[0]
    assert row["latest_result"] == "failed"
    assert row["risk_status"] == "failing"
    assert row["failed_case_count"] == 1
