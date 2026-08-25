from fastapi.testclient import TestClient

from tests.test_auth import login


def headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_suite(
    client: TestClient,
    auth: dict[str, str],
    name: str,
    *,
    parent_suite_id: int | None = None,
    description: str | None = None,
) -> dict:
    response = client.post(
        "/api/test-suites",
        headers=auth,
        json={"name": name, "parent_suite_id": parent_suite_id, "description": description},
    )
    assert response.status_code == 201
    return response.json()


def create_case(
    client: TestClient,
    auth: dict[str, str],
    code: str,
    title: str,
    *,
    suite_id: int | None = None,
    description: str | None = None,
    business_area_id: int | None = None,
    application_domain_id: int | None = None,
    object_type_id: int | None = None,
) -> dict:
    response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "code": code,
            "title": title,
            "suite_id": suite_id,
            "description": description,
            "business_area_id": business_area_id,
            "application_domain_id": application_domain_id,
            "object_type_id": object_type_id,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_tag(client: TestClient, auth: dict[str, str], category: str, name: str) -> dict:
    response = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": category, "name": name},
    )
    assert response.status_code == 201
    return response.json()


def search(client: TestClient, auth: dict[str, str], **params: object):
    return client.get("/api/repository/search", headers=auth, params=params)


def test_search_orders_by_relevance_and_returns_lightweight_results(client: TestClient) -> None:
    auth = headers(client)
    suite = create_suite(client, auth, "Login", description="Autentizace zákazníka")
    exact = create_case(client, auth, "TC-LOGIN", "Základní přihlášení", suite_id=suite["id"])
    prefix = create_case(client, auth, "TC-LOGIN-02", "Alternativní přihlášení", suite_id=suite["id"])
    create_case(client, auth, "TC-OTHER", "Login administrátora", suite_id=suite["id"])

    response = search(client, auth, q="tc-login", limit=10)

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "tc-login"
    assert [item["id"] for item in body["items"][:2]] == [exact["id"], prefix["id"]]
    assert body["items"][0]["type"] == "test_case"
    assert body["items"][0]["suite_path"] == "/Login"
    assert "steps" not in body["items"][0]

    case_insensitive = search(client, auth, q="PŘIHLÁŠENÍ", types="test_case")
    assert case_insensitive.status_code == 200
    assert {item["id"] for item in case_insensitive.json()["items"]} == {exact["id"], prefix["id"]}


def test_searches_suite_name_path_and_filters_result_type(client: TestClient) -> None:
    auth = headers(client)
    parent = create_suite(client, auth, "Platby")
    child = create_suite(client, auth, "Karty", parent_suite_id=parent["id"])
    create_case(client, auth, "TC-CARD", "Platba kartou", suite_id=child["id"])

    suites = search(client, auth, q="Platby/Karty", types="test_suite")
    assert suites.status_code == 200
    assert suites.json()["items"] == [
        {
            "type": "test_suite",
            "id": child["id"],
            "label": "Karty",
            "path": "/Platby/Karty",
            "test_case_count": 1,
            "is_active": True,
        }
    ]

    cases_only = search(client, auth, q="Platby", types="test_case")
    assert cases_only.status_code == 200
    assert all(item["type"] == "test_case" for item in cases_only.json()["items"])


def test_searches_tag_names_and_combines_exact_tag_filters(client: TestClient) -> None:
    auth = headers(client)
    business_area = create_tag(client, auth, "business_area", "Platební karty")
    other_area = create_tag(client, auth, "business_area", "Úvěry")
    domain = create_tag(client, auth, "application_domain", "Internetbanking")
    object_type = create_tag(client, auth, "object_type", "Formulář")
    matching = create_case(
        client,
        auth,
        "TC-TAGS-1",
        "Odeslání",
        business_area_id=business_area["id"],
        application_domain_id=domain["id"],
        object_type_id=object_type["id"],
    )
    create_case(
        client,
        auth,
        "TC-TAGS-2",
        "Jiný test",
        business_area_id=other_area["id"],
        application_domain_id=domain["id"],
        object_type_id=object_type["id"],
    )

    by_name = search(client, auth, q="platební")
    assert by_name.status_code == 200
    assert [item["id"] for item in by_name.json()["items"]] == [matching["id"]]
    assert by_name.json()["items"][0]["business_area"]["name"] == "Platební karty"

    filtered = search(
        client,
        auth,
        business_area_id=business_area["id"],
        application_domain_id=domain["id"],
        object_type_id=object_type["id"],
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["items"]] == [matching["id"]]
    assert all(item["type"] == "test_case" for item in filtered.json()["items"])

    wrong_category = search(client, auth, business_area_id=object_type["id"])
    assert wrong_category.status_code == 400


def test_search_is_global_validated_and_authenticated(client: TestClient) -> None:
    auth = headers(client)
    first = create_case(client, auth, "TC-SHARED-ONE", "Sdílený výraz")
    second = create_case(client, auth, "TC-SHARED-TWO", "Sdílený výraz")

    response = search(client, auth, q="sdílený")
    assert response.status_code == 200
    assert {item["id"] for item in response.json()["items"]} == {first["id"], second["id"]}
    assert search(client, auth, q="x").status_code == 422
    assert search(client, auth, q="valid", limit=51).status_code == 422
    assert search(client, auth, q="valid", types="unknown").status_code == 422

    unauthenticated = client.get("/api/repository/search", params={"q": "valid"})
    assert unauthenticated.status_code == 401
    assert search(client, auth, q="x" * 201).status_code == 422
