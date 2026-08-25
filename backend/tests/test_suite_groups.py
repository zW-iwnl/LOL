from fastapi.testclient import TestClient

from tests.test_auth import login
from tests.test_test_suites import create_suite


def auth_headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {login(client)}"}


def create_group(
    client: TestClient,
    headers: dict[str, str],
    name: str,
    parent_group_id: int | None = None,
) -> dict:
    response = client.post(
        "/api/suite-groups",
        headers=headers,
        json={"name": name, "parent_group_id": parent_group_id},
    )
    assert response.status_code == 201
    return response.json()


def test_nested_group_tree_and_cycle_validation(client: TestClient) -> None:
    headers = auth_headers(client)
    root = create_group(client, headers, "Regrese")
    child = create_group(client, headers, "Web", root["id"])
    grandchild = create_group(client, headers, "Checkout", child["id"])

    tree_response = client.get("/api/suite-groups/tree", headers=headers)
    assert tree_response.status_code == 200
    tree = tree_response.json()
    assert tree[0]["id"] == root["id"]
    assert tree[0]["children"][0]["id"] == child["id"]
    assert tree[0]["children"][0]["children"][0]["id"] == grandchild["id"]

    cycle_response = client.put(
        f"/api/suite-groups/{root['id']}",
        headers=headers,
        json={"parent_group_id": grandchild["id"]},
    )
    assert cycle_response.status_code == 400
    assert cycle_response.json()["detail"] == "Skupinu nelze přesunout pod vlastní podskupinu."


def test_group_names_are_unique_only_between_siblings(client: TestClient) -> None:
    headers = auth_headers(client)
    left = create_group(client, headers, "Levá")
    right = create_group(client, headers, "Pravá")
    create_group(client, headers, "Smoke", left["id"])
    create_group(client, headers, "Smoke", right["id"])

    duplicate = client.post(
        "/api/suite-groups",
        headers=headers,
        json={"name": " smoke ", "parent_group_id": left["id"]},
    )
    assert duplicate.status_code == 409


def test_suite_can_belong_to_multiple_groups_and_membership_is_unique(client: TestClient) -> None:
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

    groups = client.get("/api/suite-groups", headers=headers).json()
    members_by_group = {
        group["id"]: [member["suite_id"] for member in group["members"]]
        for group in groups
    }
    assert members_by_group[smoke["id"]] == [suite["id"]]
    assert members_by_group[critical["id"]] == [suite["id"]]


def test_suite_groups_can_be_set_during_suite_create_and_update(client: TestClient) -> None:
    headers = auth_headers(client)
    first = create_group(client, headers, "První")
    second = create_group(client, headers, "Druhá")

    response = client.post(
        "/api/test-suites",
        headers=headers,
        json={"name": "Platby", "group_ids": [first["id"], second["id"]]},
    )
    assert response.status_code == 201
    suite = response.json()
    assert suite["group_ids"] == [first["id"], second["id"]]

    response = client.put(
        f"/api/test-suites/{suite['id']}",
        headers=headers,
        json={"group_ids": [second["id"]]},
    )
    assert response.status_code == 200
    assert response.json()["group_ids"] == [second["id"]]


def test_group_delete_keeps_suite_and_rejects_groups_with_children(client: TestClient) -> None:
    headers = auth_headers(client)
    parent = create_group(client, headers, "Parent")
    child = create_group(client, headers, "Child", parent["id"])
    suite = create_suite(client, headers, "Bezpečně zachovaná")
    add = client.post(
        f"/api/suite-groups/{child['id']}/members",
        headers=headers,
        json={"suite_id": suite["id"]},
    )
    assert add.status_code == 201

    rejected = client.delete(f"/api/suite-groups/{parent['id']}", headers=headers)
    assert rejected.status_code == 409

    deleted = client.delete(f"/api/suite-groups/{child['id']}", headers=headers)
    assert deleted.status_code == 204
    suite_response = client.get(f"/api/test-suites/{suite['id']}", headers=headers)
    assert suite_response.status_code == 200
    assert suite_response.json()["group_ids"] == []


def test_member_sort_order_can_be_changed(client: TestClient) -> None:
    headers = auth_headers(client)
    group = create_group(client, headers, "Řazené")
    first = create_suite(client, headers, "První suite")
    second = create_suite(client, headers, "Druhá suite")
    for suite in (first, second):
        response = client.post(
            f"/api/suite-groups/{group['id']}/members",
            headers=headers,
            json={"suite_id": suite["id"]},
        )
        assert response.status_code == 201

    for sort_order, suite in enumerate((second, first)):
        response = client.put(
            f"/api/suite-groups/{group['id']}/members/{suite['id']}",
            headers=headers,
            json={"sort_order": sort_order},
        )
        assert response.status_code == 200

    response = client.get(f"/api/suite-groups/{group['id']}", headers=headers)
    assert response.status_code == 200
    assert [member["suite_id"] for member in response.json()["members"]] == [
        second["id"],
        first["id"],
    ]


def test_group_can_select_test_cases_without_moving_them_from_suites(client: TestClient) -> None:
    headers = auth_headers(client)
    regression = create_group(client, headers, "Regrese test casů")
    smoke = create_group(client, headers, "Smoke test casů")
    suite = create_suite(client, headers, "Původní suita")

    first_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={"code": "TC-GROUP-1", "title": "První", "suite_id": suite["id"]},
    )
    second_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={"code": "TC-GROUP-2", "title": "Druhý", "suite_id": suite["id"]},
    )
    assert first_response.status_code == 201
    assert second_response.status_code == 201
    first = first_response.json()
    second = second_response.json()

    selected = client.put(
        f"/api/suite-groups/{regression['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [second["id"], first["id"]]},
    )
    assert selected.status_code == 200
    assert [member["test_case_id"] for member in selected.json()["test_case_members"]] == [
        second["id"],
        first["id"],
    ]

    also_in_smoke = client.put(
        f"/api/suite-groups/{smoke['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [first["id"]]},
    )
    assert also_in_smoke.status_code == 200

    unchanged = client.get(f"/api/test-cases/{first['id']}", headers=headers)
    assert unchanged.status_code == 200
    assert unchanged.json()["suite_id"] == suite["id"]

    invalid_replace = client.put(
        f"/api/suite-groups/{regression['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [first["id"], 999999]},
    )
    assert invalid_replace.status_code == 404
    after_invalid = client.get(f"/api/suite-groups/{regression['id']}", headers=headers)
    assert [member["test_case_id"] for member in after_invalid.json()["test_case_members"]] == [
        second["id"],
        first["id"],
    ]

    duplicate = client.put(
        f"/api/suite-groups/{regression['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [first["id"], first["id"]]},
    )
    assert duplicate.status_code == 400

    removed = client.put(
        f"/api/suite-groups/{regression['id']}/test-case-members",
        headers=headers,
        json={"test_case_ids": [second["id"]]},
    )
    assert removed.status_code == 200
    assert [member["test_case_id"] for member in removed.json()["test_case_members"]] == [second["id"]]
    assert client.get(f"/api/test-cases/{first['id']}", headers=headers).status_code == 200


def test_audit_events_api_is_removed(client: TestClient) -> None:
    headers = auth_headers(client)
    assert client.get("/api/audit-events", headers=headers).status_code == 404
    assert client.get("/api/audit", headers=headers).status_code == 404
