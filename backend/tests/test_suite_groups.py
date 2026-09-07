from tests.workflow_factories import create_reviewed_case
from fastapi.testclient import TestClient

from tests.test_auth import login
from tests.test_test_suites import create_suite


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_group(client: TestClient, headers: dict[str, str], name: str) -> dict:
    response = client.post(
        "/api/suite-groups",
        headers=headers,
        json={"name": name},
    )
    assert response.status_code == 201
    return response.json()


def add_child(
    client: TestClient,
    headers: dict[str, str],
    parent_id: int,
    child_id: int,
    include_descendants: bool = True,
) -> dict:
    response = client.post(
        f"/api/suite-groups/{parent_id}/children",
        headers=headers,
        json={
            "child_group_id": child_id,
            "include_descendants": include_descendants,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_group_can_have_multiple_parents_and_one_parent_can_be_removed(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    first_parent = create_group(client, headers, "Release")
    second_parent = create_group(client, headers, "Regrese")
    child = create_group(client, headers, "Smoke")

    updated = client.put(
        f"/api/suite-groups/{child['id']}/parents",
        headers=headers,
        json={"parent_group_ids": [first_parent["id"], second_parent["id"]]},
    )
    assert updated.status_code == 200
    assert updated.json()["parent_ids"] == [first_parent["id"], second_parent["id"]]

    removed = client.delete(
        f"/api/suite-groups/{first_parent['id']}/children/{child['id']}",
        headers=headers,
    )
    assert removed.status_code == 204
    refreshed = client.get(
        f"/api/suite-groups/{child['id']}",
        headers=headers,
    ).json()
    assert refreshed["parent_ids"] == [second_parent["id"]]


def test_duplicate_edge_and_direct_or_indirect_cycles_are_rejected(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    first = create_group(client, headers, "První")
    second = create_group(client, headers, "Druhá")
    third = create_group(client, headers, "Třetí")
    add_child(client, headers, first["id"], second["id"])
    add_child(client, headers, second["id"], third["id"])

    duplicate = client.post(
        f"/api/suite-groups/{first['id']}/children",
        headers=headers,
        json={"child_group_id": second["id"]},
    )
    assert duplicate.status_code == 409

    direct = client.post(
        f"/api/suite-groups/{first['id']}/children",
        headers=headers,
        json={"child_group_id": first["id"]},
    )
    assert direct.status_code == 400

    indirect = client.post(
        f"/api/suite-groups/{third['id']}/children",
        headers=headers,
        json={"child_group_id": first["id"]},
    )
    assert indirect.status_code == 400


def test_child_relation_can_exclude_and_restore_its_descendants(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    root = create_group(client, headers, "1111")
    middle = create_group(client, headers, "2222")
    leaf = create_group(client, headers, "3333")
    add_child(client, headers, middle["id"], leaf["id"])
    root_after_add = add_child(
        client,
        headers,
        root["id"],
        middle["id"],
        include_descendants=False,
    )
    assert root_after_add["child_relations"][0]["include_descendants"] is False

    middle_suite = create_suite(client, headers, "Suite 2222")
    leaf_suite = create_suite(client, headers, "Suite 3333")
    middle_case = create_reviewed_case(client,
        headers=headers,
        json={
            "code": "TC-2222",
            "title": "Přímý obsah 2222",
            "suite_id": middle_suite["id"],
        },
    ).json()
    leaf_case = create_reviewed_case(client,
        headers=headers,
        json={
            "code": "TC-3333",
            "title": "Obsah podskupiny 3333",
            "suite_id": leaf_suite["id"],
        },
    ).json()
    for group_id, suite_id in (
        (middle["id"], middle_suite["id"]),
        (leaf["id"], leaf_suite["id"]),
    ):
        assert client.post(
            f"/api/suite-groups/{group_id}/members",
            headers=headers,
            json={"suite_id": suite_id},
        ).status_code == 201

    root_cases = client.get(
        f"/api/suite-groups/{root['id']}/test-cases",
        headers=headers,
    ).json()
    assert [item["id"] for item in root_cases] == [middle_case["id"]]

    middle_cases = client.get(
        f"/api/suite-groups/{middle['id']}/test-cases",
        headers=headers,
    ).json()
    assert {item["id"] for item in middle_cases} == {
        middle_case["id"],
        leaf_case["id"],
    }

    restored = client.put(
        f"/api/suite-groups/{root['id']}/children/{middle['id']}",
        headers=headers,
        json={"include_descendants": True},
    )
    assert restored.status_code == 200
    restored_cases = client.get(
        f"/api/suite-groups/{root['id']}/test-cases",
        headers=headers,
    ).json()
    assert {item["id"] for item in restored_cases} == {
        middle_case["id"],
        leaf_case["id"],
    }


def test_suite_can_belong_to_multiple_groups(client: TestClient) -> None:
    headers = auth_headers(client)
    smoke = create_group(client, headers, "Smoke")
    critical = create_group(client, headers, "Kritické")
    suite = create_suite(client, headers, "Checkout")

    update = client.put(
        f"/api/suite-groups/suites/{suite['id']}/groups",
        headers=headers,
        json={"group_ids": [critical["id"], smoke["id"]]},
    )
    assert update.status_code == 200
    assert update.json()["group_ids"] == [critical["id"], smoke["id"]]

    duplicate = client.post(
        f"/api/suite-groups/{smoke['id']}/members",
        headers=headers,
        json={"suite_id": suite["id"]},
    )
    assert duplicate.status_code == 409


def test_group_delete_removes_only_relations_and_memberships(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    parent = create_group(client, headers, "Parent")
    child = create_group(client, headers, "Child")
    add_child(client, headers, parent["id"], child["id"])
    suite = create_suite(client, headers, "Zachovaná")
    assert client.post(
        f"/api/suite-groups/{parent['id']}/members",
        headers=headers,
        json={"suite_id": suite["id"]},
    ).status_code == 201

    assert client.delete(
        f"/api/suite-groups/{parent['id']}",
        headers=headers,
    ).status_code == 204
    assert client.get(
        f"/api/suite-groups/{child['id']}",
        headers=headers,
    ).json()["parent_ids"] == []
    assert client.get(
        f"/api/test-suites/{suite['id']}",
        headers=headers,
    ).status_code == 200


def test_diamond_graph_deduplicates_cases_and_inherited_tags(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    root = create_group(client, headers, "Root")
    left = create_group(client, headers, "Left")
    right = create_group(client, headers, "Right")
    leaf = create_group(client, headers, "Leaf")
    add_child(client, headers, root["id"], left["id"])
    add_child(client, headers, root["id"], right["id"])
    add_child(client, headers, left["id"], leaf["id"])
    add_child(client, headers, right["id"], leaf["id"])

    suite = create_suite(client, headers, "Checkout")
    tag = client.post(
        "/api/test-case-tags",
        headers=headers,
        json={"category": "business_area", "name": "Platby"},
    ).json()
    case = create_reviewed_case(client,
        headers=headers,
        json={
            "code": "TC-DIAMOND",
            "title": "Platba",
            "suite_id": suite["id"],
            "tag_ids": [tag["id"]],
        },
    ).json()
    assert client.post(
        f"/api/suite-groups/{leaf['id']}/members",
        headers=headers,
        json={"suite_id": suite["id"]},
    ).status_code == 201
    assert client.put(
        f"/api/suite-groups/{left['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [case["id"]]},
    ).status_code == 200

    root_suite = create_suite(client, headers, "Root suite")
    root_case = create_reviewed_case(client,
        headers=headers,
        json={
            "code": "TC-ROOT-DIRECT",
            "title": "Přímý obsah kořenové skupiny",
            "suite_id": root_suite["id"],
        },
    ).json()
    assert client.post(
        f"/api/suite-groups/{root['id']}/members",
        headers=headers,
        json={"suite_id": root_suite["id"]},
    ).status_code == 201

    direct_response = client.get(
        f"/api/suite-groups/{root['id']}/test-cases",
        headers=headers,
        params={"include_descendants": "false"},
    )
    assert direct_response.status_code == 200
    assert [item["id"] for item in direct_response.json()] == [root_case["id"]]

    recursive_response = client.get(
        f"/api/suite-groups/{root['id']}/test-cases",
        headers=headers,
    )
    assert recursive_response.status_code == 200
    recursive_ids = [item["id"] for item in recursive_response.json()]
    assert set(recursive_ids) == {case["id"], root_case["id"]}
    assert recursive_ids.count(case["id"]) == 1

    root_after = client.get(
        f"/api/suite-groups/{root['id']}",
        headers=headers,
    ).json()
    assert root_after["tags"] == [
        {
            "id": tag["id"],
            "category": "business_area",
            "name": "Platby",
            "test_case_count": 1,
        }
    ]


def test_group_test_case_selection_validates_group_and_scope(
    client: TestClient,
) -> None:
    headers = auth_headers(client)

    missing = client.get(
        "/api/suite-groups/999999/test-cases",
        headers=headers,
    )
    assert missing.status_code == 404

    invalid_scope = client.get(
        "/api/suite-groups/999999/test-cases",
        headers=headers,
        params={"include_descendants": "nevim"},
    )
    assert invalid_scope.status_code == 422


def test_removed_group_tree_and_audit_endpoints_are_not_available(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    assert client.get("/api/suite-groups/tree", headers=headers).status_code != 200
    assert client.get("/api/audit-events", headers=headers).status_code == 404
