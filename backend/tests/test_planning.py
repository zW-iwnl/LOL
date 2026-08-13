from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def test_create_release_milestone_and_test_plan(client: TestClient) -> None:
    headers = auth_headers(client)

    release_response = client.post(
        "/api/projects/1/releases",
        headers=headers,
        json={"name": "2026.1", "status": "planned"},
    )
    assert release_response.status_code == 201
    release = release_response.json()

    milestone_response = client.post(
        "/api/projects/1/milestones",
        headers=headers,
        json={"name": "Regression window", "release_id": release["id"], "status": "planned"},
    )
    assert milestone_response.status_code == 201
    milestone = milestone_response.json()

    run_response = client.post(
        "/api/projects/1/test-runs",
        headers=headers,
        json={"name": "Regression run", "environment": "TEST", "status": "open"},
    )
    assert run_response.status_code == 201
    test_run = run_response.json()

    plan_response = client.post(
        "/api/projects/1/test-plans",
        headers=headers,
        json={
            "name": "Release 2026.1 test plan",
            "release_id": release["id"],
            "milestone_id": milestone["id"],
            "status": "active",
            "test_run_ids": [test_run["id"]],
        },
    )
    assert plan_response.status_code == 201
    plan = plan_response.json()
    assert plan["name"] == "Release 2026.1 test plan"
    assert plan["test_runs"][0]["id"] == test_run["id"]


def test_milestone_rejects_dates_in_wrong_order(client: TestClient) -> None:
    response = client.post(
        "/api/projects/1/milestones",
        headers=auth_headers(client),
        json={
            "name": "Bad milestone",
            "planned_start": "2026-05-10T00:00:00Z",
            "planned_end": "2026-05-01T00:00:00Z",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Začátek milestone musí být před koncem."


def test_test_plan_rejects_test_run_from_another_project(client: TestClient) -> None:
    headers = auth_headers(client)
    project_response = client.post(
        "/api/projects",
        headers=headers,
        json={"name": "CRM", "code": "CRM", "description": None, "status": "active"},
    )
    assert project_response.status_code == 201

    run_response = client.post(
        "/api/projects/2/test-runs",
        headers=headers,
        json={"name": "CRM run", "environment": "TEST", "status": "open"},
    )
    assert run_response.status_code == 201
    test_run = run_response.json()

    plan_response = client.post(
        "/api/projects/1/test-plans",
        headers=headers,
        json={"name": "Invalid plan", "test_run_ids": [test_run["id"]]},
    )

    assert plan_response.status_code == 400
    assert plan_response.json()["detail"] == f"Test runy neexistují v projektu: [{test_run['id']}]"
