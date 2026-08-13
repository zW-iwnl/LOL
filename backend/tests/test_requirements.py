from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_test_case(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/api/projects/1/test-cases",
        headers=headers,
        json={
            "code": "TC-REQ-1",
            "title": "Requirement coverage case",
            "priority": "high",
            "status": "ready",
            "type": "manual",
            "automated": False,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_requirement_with_test_case_link(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)

    response = client.post(
        "/api/projects/1/requirements",
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


def test_requirement_rejects_test_case_from_another_project(client: TestClient) -> None:
    headers = auth_headers(client)
    project_response = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "CRM", "code": "CRM", "description": None, "status": "active"},
    )
    assert project_response.status_code == 201
    case_response = client.post(
        "/api/projects/2/test-cases",
        headers=headers,
        json={"code": "CRM-1", "title": "CRM case", "priority": "medium", "status": "ready"},
    )
    assert case_response.status_code == 201

    response = client.post(
        "/api/projects/1/requirements",
        headers=headers,
        json={"code": "REQ-CRM", "title": "Invalid link", "test_case_ids": [case_response.json()["id"]]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == f"Test cases neexistují v projektu: [{case_response.json()['id']}]"


def test_traceability_matrix_reports_latest_result_and_open_defect(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    requirement_response = client.post(
        "/api/projects/1/requirements",
        headers=headers,
        json={"code": "REQ-TRACE", "title": "Traceable requirement", "test_case_ids": [test_case["id"]]},
    )
    assert requirement_response.status_code == 201

    run_response = client.post(
        "/api/projects/1/test-runs",
        headers=headers,
        json={"name": "Traceability run", "test_case_ids": [test_case["id"]]},
    )
    assert run_response.status_code == 201
    run_case = run_response.json()["test_run_cases"][0]

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/result",
        headers=headers,
        json={
            "result": "failed",
            "comment": "Fails",
            "defect": {
                "title": "Checkout defect",
                "priority": "high",
                "severity": "high",
                "status": "open",
            },
        },
    )
    assert result_response.status_code == 200

    matrix_response = client.get("/api/projects/1/traceability", headers=headers)

    assert matrix_response.status_code == 200
    row = matrix_response.json()[0]
    assert row["requirement_code"] == "REQ-TRACE"
    assert row["coverage_status"] == "covered"
    assert row["latest_result"] == "failed"
    assert row["open_defects"][0]["title"] == "Checkout defect"
