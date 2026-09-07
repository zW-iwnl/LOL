from fastapi.testclient import TestClient

from tests.test_auth import login


def headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_suite(client: TestClient, auth: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/test-suites",
        headers=auth,
        json={"name": name},
    )
    assert response.status_code == 201
    return response.json()


def create_case(
    client: TestClient,
    auth: dict[str, str],
    suite_id: int,
    code: str,
    title: str,
    *,
    tag_ids: list[int] | None = None,
) -> dict:
    response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "code": code,
            "title": title,
            "suite_id": suite_id,
            "tag_ids": tag_ids or [],
        },
    )
    assert response.status_code == 201
    return response.json()


def create_group(client: TestClient, auth: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/suite-groups",
        headers=auth,
        json={"name": name},
    )
    assert response.status_code == 201
    return response.json()


def search(client: TestClient, auth: dict[str, str], **params: object):
    return client.get("/api/repository/search", headers=auth, params=params)


def test_search_returns_flat_suite_identity(client: TestClient) -> None:
    auth = headers(client)
    suite = create_suite(client, auth, "Login")
    exact = create_case(
        client,
        auth,
        suite["id"],
        "TC-LOGIN",
        "Základní přihlášení",
    )
    create_case(
        client,
        auth,
        suite["id"],
        "TC-LOGIN-02",
        "Alternativní přihlášení",
    )

    response = search(client, auth, q="tc-login", limit=10)
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["id"] == exact["id"]
    assert item["suite_id"] == suite["id"]
    assert item["suite_name"] == "Login"
    assert "suite_path" not in item


def test_suite_search_returns_groups_counts_and_inherited_tags(
    client: TestClient,
) -> None:
    auth = headers(client)
    tag = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": "business_area", "name": "Platby"},
    ).json()
    group = create_group(client, auth, "Release")
    suite = create_suite(client, auth, "Karty")
    create_case(
        client,
        auth,
        suite["id"],
        "TC-CARD",
        "Platba kartou",
        tag_ids=[tag["id"]],
    )
    assert client.post(
        f"/api/suite-groups/{group['id']}/members",
        headers=auth,
        json={"suite_id": suite["id"]},
    ).status_code == 201

    response = search(client, auth, q="platby", types="test_suite")
    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "type": "test_suite",
            "id": suite["id"],
            "label": "Karty",
            "group_ids": [group["id"]],
            "test_case_count": 1,
            "is_active": True,
            "tags": [
                {
                    "id": tag["id"],
                    "category": "business_area",
                    "name": "Platby",
                    "test_case_count": 1,
                }
            ],
        }
    ]


def test_group_search_traverses_dag_and_deduplicates_diamond(
    client: TestClient,
) -> None:
    auth = headers(client)
    tag = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": "business_area", "name": "Kritické platby"},
    ).json()
    root = create_group(client, auth, "Release")
    left = create_group(client, auth, "Web")
    right = create_group(client, auth, "Mobil")
    leaf = create_group(client, auth, "Smoke")
    for parent, child in (
        (root, left),
        (root, right),
        (left, leaf),
        (right, leaf),
    ):
        assert client.post(
            f"/api/suite-groups/{parent['id']}/children",
            headers=auth,
            json={"child_group_id": child["id"]},
        ).status_code == 200

    suite = create_suite(client, auth, "Checkout")
    case = create_case(
        client,
        auth,
        suite["id"],
        "TC-GRAPH",
        "Platba",
        tag_ids=[tag["id"]],
    )
    assert client.put(
        f"/api/suite-groups/{leaf['id']}/test-case-members",
        headers=auth,
        json={"test_case_ids": [case["id"]]},
    ).status_code == 200

    response = search(
        client,
        auth,
        q="kritické platby",
        types="suite_group",
    )
    assert response.status_code == 200
    by_id = {item["id"]: item for item in response.json()["items"]}
    assert set(by_id) == {root["id"], left["id"], right["id"], leaf["id"]}
    assert by_id[root["id"]]["test_case_count"] == 1
    assert by_id[leaf["id"]]["parent_ids"] == [left["id"], right["id"]]


def test_exact_tag_filters_apply_to_all_repository_types(
    client: TestClient,
) -> None:
    auth = headers(client)
    area = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": "business_area", "name": "Karty"},
    ).json()
    domain = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": "application_domain", "name": "IB"},
    ).json()
    suite = create_suite(client, auth, "Karetní workflow")
    case = create_case(
        client,
        auth,
        suite["id"],
        "TC-TAGS",
        "Odeslání",
        tag_ids=[area["id"], domain["id"]],
    )

    response = search(
        client,
        auth,
        types="test_case",
        business_area_id=area["id"],
        application_domain_id=domain["id"],
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [case["id"]]


def test_search_validation_and_authentication(client: TestClient) -> None:
    auth = headers(client)
    assert search(client, auth, q="x").status_code == 422
    assert search(client, auth, q="valid", types="invalid").status_code == 422
    assert search(client, auth).status_code == 422
    assert client.get("/api/repository/search", params={"q": "valid"}).status_code == 401
