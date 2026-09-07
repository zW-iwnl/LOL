from fastapi.testclient import TestClient

from tests.test_auth import login


def headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_tag(client: TestClient, auth: dict[str, str], category: str, name: str) -> dict:
    response = client.post(
        "/api/test-case-tags",
        headers=auth,
        json={"category": category, "name": name},
    )
    assert response.status_code == 201
    return response.json()


def test_manage_tags_and_filter_test_cases(client: TestClient) -> None:
    auth = headers(client)
    business_area = create_tag(client, auth, "business_area", "Karty")
    application_domain = create_tag(client, auth, "application_domain", "IB")
    object_type = create_tag(client, auth, "object_type", "Formulář")

    create_response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "suite_id": 1,
            "code": "TC-TAGS-1",
            "title": "Tagged case",
            "business_area_id": business_area["id"],
            "application_domain_id": application_domain["id"],
            "object_type_id": object_type["id"],
        },
    )

    assert create_response.status_code == 201
    test_case = create_response.json()
    assert test_case["business_area"]["name"] == "Karty"
    assert test_case["application_domain"]["name"] == "IB"
    assert test_case["object_type"]["name"] == "Formulář"

    run_response = client.post(
        "/api/test-runs",
        headers=auth,
        json={"name": "Tagged run", "test_case_ids": [test_case["id"]]},
    )
    assert run_response.status_code == 201
    snapshot = run_response.json()["test_run_cases"][0]["test_case_snapshot"]
    assert snapshot["business_area"] == {"id": business_area["id"], "name": "Karty"}
    assert snapshot["application_domain"] == {"id": application_domain["id"], "name": "IB"}
    assert snapshot["object_type"] == {"id": object_type["id"], "name": "Formulář"}

    filtered = client.get(
        f"/api/test-cases?business_area_id={business_area['id']}",
        headers=auth,
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == [test_case["id"]]

    in_use_delete = client.delete(f"/api/test-case-tags/{business_area['id']}", headers=auth)
    assert in_use_delete.status_code == 409

    rename = client.put(
        f"/api/test-case-tags/{business_area['id']}",
        headers=auth,
        json={"name": "Platební karty"},
    )
    assert rename.status_code == 200
    assert rename.json()["name"] == "Platební karty"


def test_rejects_tag_from_wrong_category_and_deletes_unused_tag(client: TestClient) -> None:
    auth = headers(client)
    wrong_tag = create_tag(client, auth, "object_type", "Stránka")

    response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "suite_id": 1,
            "code": "TC-WRONG-TAG",
            "title": "Wrong tag",
            "business_area_id": wrong_tag["id"],
        },
    )
    assert response.status_code == 400

    delete_response = client.delete(f"/api/test-case-tags/{wrong_tag['id']}", headers=auth)
    assert delete_response.status_code == 204


def test_multiple_tags_per_category_are_persisted_filtered_and_snapshotted(client: TestClient) -> None:
    auth = headers(client)
    cards = create_tag(client, auth, "business_area", "Karta")
    loans = create_tag(client, auth, "business_area", "Úvěry")
    accounts = create_tag(client, auth, "business_area", "Účty")
    domain = create_tag(client, auth, "application_domain", "Internetbanking")
    object_type = create_tag(client, auth, "object_type", "Formulář")

    response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "suite_id": 1,
            "code": "TC-MULTI-TAGS",
            "title": "Karta i úvěr",
            "tag_ids": [cards["id"], loans["id"], domain["id"], object_type["id"]],
        },
    )
    assert response.status_code == 201
    test_case = response.json()
    assert set(test_case["tag_ids"]) == {
        cards["id"],
        loans["id"],
        domain["id"],
        object_type["id"],
    }
    assert {tag["name"] for tag in test_case["tags"] if tag["category"] == "business_area"} == {
        "Karta",
        "Úvěry",
    }

    filtered = client.get(
        "/api/test-cases",
        headers=auth,
        params=[
            ("business_area_id", str(cards["id"])),
            ("business_area_id", str(accounts["id"])),
            ("application_domain_id", str(domain["id"])),
        ],
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == [test_case["id"]]

    run_response = client.post(
        "/api/test-runs",
        headers=auth,
        json={"name": "Multi-tag run", "test_case_ids": [test_case["id"]]},
    )
    assert run_response.status_code == 201
    snapshot = run_response.json()["test_run_cases"][0]["test_case_snapshot"]
    assert {tag["name"] for tag in snapshot["business_areas"]} == {"Karta", "Úvěry"}
    assert snapshot["application_domains"] == [{"id": domain["id"], "name": "Internetbanking"}]

    update = client.put(
        f"/api/test-cases/{test_case['id']}",
        headers=auth,
        json={"tag_ids": [loans["id"], domain["id"], object_type["id"]]},
    )
    assert update.status_code == 200
    assert update.json()["version"] == test_case["version"] + 1
    assert cards["id"] not in update.json()["tag_ids"]

    duplicate = client.put(
        f"/api/test-cases/{test_case['id']}",
        headers=auth,
        json={"tag_ids": [loans["id"], loans["id"]]},
    )
    assert duplicate.status_code == 400
