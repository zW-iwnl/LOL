from conftest import TestingSessionLocal
from app.models import TestCase as CaseModel
from tests.test_suite_groups import add_child, create_group
from tests.test_test_runs import auth_headers


def seed_cases(count=123):
    with TestingSessionLocal() as db:
        db.add_all([CaseModel(code=f"RP-{i:03}", title="PŘÍLIŠ žluťoučký 100%" if i == 0 else f"Scénář {i}", suite_id=1, created_by=1, status="draft") for i in range(count)])
        db.commit()


def test_case_pages_are_lightweight_searchable_and_validated(client):
    headers = auth_headers(client)
    seed_cases()
    response = client.get("/api/repository/cases?limit=100", headers=headers)
    assert response.status_code == 200, response.text
    first = response.json()
    assert first["total"] == first["scope_total"] == 123
    assert len(first["items"]) == 100
    assert "steps" not in first["items"][0]
    second = client.get("/api/repository/cases?limit=100&offset=100", headers=headers).json()
    assert len(second["items"]) == 23
    assert not {x["id"] for x in first["items"]} & {x["id"] for x in second["items"]}
    for query in ["prilis zlutoucky", "100%"]:
        page = client.get("/api/repository/cases", headers=headers, params={"q": query}).json()
        assert page["total"] == 1
        assert page["scope_total"] == 123
    assert client.get("/api/repository/cases?q=_", headers=headers).json()["total"] == 0
    assert client.get("/api/repository/cases?status=ready", headers=headers).json()["total"] == 0
    for params in ["limit=101", "offset=-1", "status=bad"]:
        assert client.get(f"/api/repository/cases?{params}", headers=headers).status_code == 422
    assert client.get("/api/repository/cases?group_id=999", headers=headers).status_code == 404
    assert client.get("/api/repository/cases?suite_id=999", headers=headers).status_code == 404


def test_group_content_respects_stopped_edges_and_deduplicates_origins(client):
    headers = auth_headers(client)
    seed_cases(3)
    root, alternate, middle, leaf = [create_group(client, headers, name) for name in ["Root", "Alternate", "Middle", "Leaf"]]
    add_child(client, headers, root["id"], middle["id"], include_descendants=False)
    add_child(client, headers, alternate["id"], middle["id"])
    add_child(client, headers, middle["id"], leaf["id"])
    for group, ids in [(middle, [1]), (leaf, [1, 2])]:
        assert client.put(f"/api/suite-groups/{group['id']}/test-case-members", headers=headers, json={"test_case_ids": ids}).status_code == 200
    assert client.post(f"/api/suite-groups/{leaf['id']}/members", headers=headers, json={"suite_id": 1}).status_code == 201
    def page(group, **params):
        response = client.get("/api/repository/cases", headers=headers, params={"group_id": group["id"], **params})
        assert response.status_code == 200, response.text
        return response.json()
    assert page(root)["total"] == 1
    assert page(alternate)["total"] == 3
    assert len(page(alternate)["items"][0]["origins"]) == 3
    assert page(middle, include_descendants=False)["total"] == 1
    assert page(leaf, direct_only=True)["total"] == 2
    structure = client.get("/api/repository/groups", headers=headers)
    assert structure.status_code == 200, structure.text
    data = structure.json()
    assert data["test_case_count"] == 3
    group = next(g for g in data["groups"] if g["id"] == leaf["id"])
    assert group["suite_count"] == 1 and group["direct_case_count"] == 2
    assert "members" not in group and "test_case_members" not in group


def test_tag_filters_and_inherited_group_tags(client):
    from app.models import TestCaseTag as Tag, TestCaseTagAssignment as Assignment
    headers = auth_headers(client)
    seed_cases(3)
    group = create_group(client, headers, "Platby")
    assert client.post(f"/api/suite-groups/{group['id']}/members", headers=headers, json={"suite_id": 1}).status_code == 201
    with TestingSessionLocal() as db:
        db.add_all([Tag(id=1, name="Převody", category="business_area"), Tag(id=2, name="Účet", category="object_type")])
        db.flush()
        db.add_all([Assignment(test_case_id=1, tag_id=1), Assignment(test_case_id=1, tag_id=2), Assignment(test_case_id=2, tag_id=1)])
        db.commit()
    page = client.get("/api/repository/cases?tag_id=1&tag_id=2", headers=headers).json()
    assert page["total"] == 1 and page["scope_total"] == 3
    assert {tag["id"] for tag in page["items"][0]["tags"]} == {1, 2}
    assert client.get("/api/repository/cases?q=prevody", headers=headers).json()["total"] == 2
    tags = client.get("/api/repository/groups", headers=headers).json()["groups"][0]["tags"]
    assert {tag["id"]: tag["test_case_count"] for tag in tags} == {1: 2, 2: 1}
    assert client.get("/api/repository/groups").status_code == 401
    assert client.get("/api/repository/cases").status_code == 401
