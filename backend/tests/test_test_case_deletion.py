from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def test_delete_test_case_removes_case_from_repository(client: TestClient) -> None:
    headers = auth_headers(client)
    create_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "suite_id": 1,
            "code": "TC-DELETE-1",
            "title": "Case urceny ke smazani",
            "status": "draft",
            "automated": False,
            "steps": [
                {
                    "step_order": 1,
                    "action": "Provest kontrolni krok",
                    "step_type": "test",
                    "expected_result": "Krok probehne",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    test_case_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/test-cases/{test_case_id}", headers=headers)

    assert delete_response.status_code == 204
    assert client.get(f"/api/test-cases/{test_case_id}", headers=headers).status_code == 404
    repository_response = client.get("/api/test-cases", headers=headers)
    assert repository_response.status_code == 200
    assert test_case_id not in {item["id"] for item in repository_response.json()}


def test_delete_used_test_case_archives_case_and_preserves_history(client: TestClient) -> None:
    headers = auth_headers(client)
    create_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "suite_id": 1,
            "code": "TC-DELETE-LINKED",
            "title": "Case pouzity v runu a requirementu",
            "status": "ready",
            "steps": [
                {
                    "step_order": 1,
                    "action": "Provest krok",
                    "step_type": "test",
                    "expected_result": "Hotovo",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    test_case_id = create_response.json()["id"]

    requirement_response = client.post(
        "/api/requirements",
        headers=headers,
        json={
            "code": "REQ-DELETE-LINKED",
            "title": "Requirement s mazanym test case",
            "test_case_ids": [test_case_id],
        },
    )
    assert requirement_response.status_code == 201
    requirement_id = requirement_response.json()["id"]

    run_response = client.post(
        "/api/test-runs",
        headers=headers,
        json={"name": "Run s mazanym test case", "test_case_ids": [test_case_id]},
    )
    assert run_response.status_code == 201
    test_run_id = run_response.json()["id"]

    delete_response = client.delete(f"/api/test-cases/{test_case_id}", headers=headers)

    assert delete_response.status_code == 204
    archived_case = client.get(f"/api/test-cases/{test_case_id}", headers=headers)
    assert archived_case.status_code == 200
    assert archived_case.json()["status"] == "deprecated"

    requirement_after_delete = client.get(f"/api/requirements/{requirement_id}", headers=headers)
    assert requirement_after_delete.status_code == 200
    assert [item["id"] for item in requirement_after_delete.json()["test_cases"]] == [test_case_id]

    run_after_delete = client.get(f"/api/test-runs/{test_run_id}", headers=headers)
    assert run_after_delete.status_code == 200
    assert [item["test_case_id"] for item in run_after_delete.json()["test_run_cases"]] == [test_case_id]


def test_delete_unused_ready_case_archives_instead_of_hard_delete(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    create_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "suite_id": 1,
            "code": "TC-ARCHIVE-READY",
            "title": "Publikovany case",
            "status": "ready",
        },
    )
    assert create_response.status_code == 201
    test_case_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/test-cases/{test_case_id}", headers=headers)

    assert delete_response.status_code == 204
    archived_response = client.get(f"/api/test-cases/{test_case_id}", headers=headers)
    assert archived_response.status_code == 200
    assert archived_response.json()["status"] == "deprecated"
