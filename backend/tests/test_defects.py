from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def test_create_defect_requires_existing_test_run_case(client: TestClient) -> None:
    response = client.post(
        "/api/projects/1/defects",
        headers=auth_headers(client),
        json={
            "title": "Neplatná vazba",
            "test_run_case_id": 999999,
            "priority": "high",
            "severity": "high",
            "status": "open",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Test run case neexistuje."


def test_create_defect(client: TestClient) -> None:
    response = client.post(
        "/api/projects/1/defects",
        headers=auth_headers(client),
        json={
            "title": "Chyba v košíku",
            "description": "Košík nejde uložit.",
            "priority": "medium",
            "severity": "high",
            "status": "open",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Chyba v košíku"
    assert body["project_id"] == 1
