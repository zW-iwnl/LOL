from fastapi.testclient import TestClient

from tests.test_auth import login


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_suite(client: TestClient, headers: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/test-suites",
        headers=headers,
        json={"name": name},
    )
    assert response.status_code == 201
    return response.json()


def test_suites_are_flat_and_tree_endpoints_are_removed(client: TestClient) -> None:
    headers = auth_headers(client)
    suite = create_suite(client, headers, "Platby")

    assert "parent_suite_id" not in suite
    assert "path" not in suite
    assert "level" not in suite
    assert suite["test_case_count"] == 0

    assert client.get("/api/test-suites/tree", headers=headers).status_code != 200
    assert (
        client.get(
            f"/api/test-suites/{suite['id']}/children",
            headers=headers,
        ).status_code
        == 404
    )


def test_suite_counts_only_its_own_cases(client: TestClient) -> None:
    headers = auth_headers(client)
    first = create_suite(client, headers, "Platby")
    second = create_suite(client, headers, "Karty")

    for code, suite_id in (("TC-PAY", first["id"]), ("TC-CARD", second["id"])):
        response = client.post(
            "/api/test-cases",
            headers=headers,
            json={"code": code, "title": code, "suite_id": suite_id},
        )
        assert response.status_code == 201

    suites = {
        suite["id"]: suite
        for suite in client.get("/api/test-suites", headers=headers).json()
    }
    assert suites[first["id"]]["test_case_count"] == 1
    assert suites[second["id"]]["test_case_count"] == 1

    search = client.get(
        "/api/test-suites/search",
        headers=headers,
        params={"q": "Karty"},
    )
    assert search.status_code == 200
    assert [suite["id"] for suite in search.json()] == [second["id"]]


def test_empty_suite_can_be_deleted_but_suite_with_cases_cannot(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    empty = create_suite(client, headers, "Prázdná")
    used = create_suite(client, headers, "Použitá")
    created = client.post(
        "/api/test-cases",
        headers=headers,
        json={"code": "TC-USED", "title": "Použitý test", "suite_id": used["id"]},
    )
    assert created.status_code == 201

    assert (
        client.delete(f"/api/test-suites/{empty['id']}", headers=headers).status_code
        == 204
    )
    rejected = client.delete(f"/api/test-suites/{used['id']}", headers=headers)
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "Nelze smazat suitu, která obsahuje test cases."


def test_test_case_requires_suite_on_create_and_update(client: TestClient) -> None:
    headers = auth_headers(client)
    missing = client.post(
        "/api/test-cases",
        headers=headers,
        json={"code": "TC-NO-SUITE", "title": "Bez suity"},
    )
    assert missing.status_code == 422

    suite = create_suite(client, headers, "Povinná suita")
    created = client.post(
        "/api/test-cases",
        headers=headers,
        json={"code": "TC-SUITE", "title": "Se suitou", "suite_id": suite["id"]},
    )
    assert created.status_code == 201

    cleared = client.put(
        f"/api/test-cases/{created.json()['id']}",
        headers=headers,
        json={"suite_id": None},
    )
    assert cleared.status_code == 422
    assert (
        client.get(
            f"/api/test-cases/{created.json()['id']}",
            headers=headers,
        ).json()["suite_id"]
        == suite["id"]
    )


def test_duplicate_suite_names_remain_unambiguous_by_id(client: TestClient) -> None:
    headers = auth_headers(client)
    first = create_suite(client, headers, "Smoke")
    second = create_suite(client, headers, "Smoke")

    assert first["id"] != second["id"]
    assert [suite["id"] for suite in client.get(
        "/api/test-suites/search",
        headers=headers,
        params={"q": "Smoke"},
    ).json()] == [first["id"], second["id"]]
