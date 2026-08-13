from fastapi.testclient import TestClient


def login(client: TestClient) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@testmanager.cz", "password": "admin123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    return body["access_token"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@testmanager.cz", "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_login_and_me(client: TestClient) -> None:
    token = login(client)

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "admin@testmanager.cz"


def test_projects_are_protected(client: TestClient) -> None:
    response = client.get("/api/projects")

    assert response.status_code == 401


def test_authenticated_user_can_list_projects(client: TestClient) -> None:
    token = login(client)

    response = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()[0]["code"] == "ESHOP"


def test_authenticated_user_can_list_all_test_cases(client: TestClient) -> None:
    token = login(client)

    response = client.get("/api/test-cases", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == []
