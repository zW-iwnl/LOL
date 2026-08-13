from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_suite(client: TestClient, headers: dict[str, str], name: str, parent_suite_id: int | None = None) -> dict:
    response = client.post(
        "/api/projects/1/test-suites",
        headers=headers,
        json={"name": name, "parent_suite_id": parent_suite_id},
    )
    assert response.status_code == 201
    return response.json()


def test_suite_cannot_be_moved_under_own_descendant(client: TestClient) -> None:
    headers = auth_headers(client)
    parent = create_suite(client, headers, "Parent")
    child = create_suite(client, headers, "Child", parent["id"])

    response = client.put(
        f"/api/test-suites/{parent['id']}",
        headers=headers,
        json={"parent_suite_id": child["id"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Suite nelze přesunout pod vlastní podstrom."


def test_suite_move_recalculates_descendant_paths(client: TestClient) -> None:
    headers = auth_headers(client)
    target_parent = create_suite(client, headers, "Target")
    parent = create_suite(client, headers, "Parent")
    child = create_suite(client, headers, "Child", parent["id"])

    response = client.put(
        f"/api/test-suites/{parent['id']}",
        headers=headers,
        json={"name": "Moved", "parent_suite_id": target_parent["id"]},
    )

    assert response.status_code == 200
    moved = response.json()
    assert moved["path"] == "/Target/Moved"
    assert moved["level"] == 1

    child_response = client.get(f"/api/test-suites/{child['id']}", headers=headers)
    assert child_response.status_code == 200
    moved_child = child_response.json()
    assert moved_child["path"] == "/Target/Moved/Child"
    assert moved_child["level"] == 2


def test_delete_empty_suite(client: TestClient) -> None:
    headers = auth_headers(client)
    suite = create_suite(client, headers, "Empty")

    response = client.delete(f"/api/test-suites/{suite['id']}", headers=headers)

    assert response.status_code == 204


def test_delete_suite_with_child_is_rejected(client: TestClient) -> None:
    headers = auth_headers(client)
    parent = create_suite(client, headers, "Parent")
    create_suite(client, headers, "Child", parent["id"])

    response = client.delete(f"/api/test-suites/{parent['id']}", headers=headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Nelze smazat suitu, která obsahuje podsuity."
