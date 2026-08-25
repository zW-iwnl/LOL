from fastapi.testclient import TestClient

from tests.test_test_runs import (
    add_case_to_run,
    auth_headers,
    create_test_case,
    create_test_run,
)


def test_step_results_are_created_updated_and_isolated(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_step_id = test_case["steps"][0]["id"]

    first_run = create_test_run(client, headers)
    first_updated = add_case_to_run(client, headers, first_run["id"], test_case["id"])
    first_run_case = first_updated["test_run_cases"][0]
    assert first_run_case["step_results"][0]["test_step_id"] == test_step_id
    assert first_run_case["step_results"][0]["result"] == "not_run"

    update_response = client.put(
        f"/api/test-run-cases/{first_run_case['id']}/steps/{test_step_id}/result",
        headers=headers,
        json={"result": "passed"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["result"] == "passed"
    assert update_response.json()["executed_by"] == 1
    assert update_response.json()["executed_at"] is not None

    execution_response = client.get(
        f"/api/test-runs/{first_run['id']}/execution",
        headers=headers,
    )
    assert execution_response.status_code == 200
    assert execution_response.json()["test_run_cases"][0]["step_results"][0]["result"] == "passed"

    second_run = create_test_run(client, headers)
    second_updated = add_case_to_run(client, headers, second_run["id"], test_case["id"])
    assert second_updated["test_run_cases"][0]["step_results"][0]["result"] == "not_run"


def test_archived_run_rejects_step_result_update(client: TestClient) -> None:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_step_id = test_case["steps"][0]["id"]
    test_run = create_test_run(client, headers)
    updated_run = add_case_to_run(client, headers, test_run["id"], test_case["id"])
    run_case = updated_run["test_run_cases"][0]

    archive_response = client.delete(f"/api/test-runs/{test_run['id']}", headers=headers)
    assert archive_response.status_code == 204

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/steps/{test_step_id}/result",
        headers=headers,
        json={"result": "failed"},
    )
    assert result_response.status_code == 400
    assert result_response.json()["detail"] == "Archivovaný test run nelze exekuovat."


def test_information_step_has_note_and_is_not_executable(client: TestClient) -> None:
    headers = auth_headers(client)
    case_response = client.post(
        "/api/test-cases",
        headers=headers,
        json={
            "code": "TC-STEP-TYPES",
            "title": "Mixed step types",
            "steps": [
                {
                    "step_order": 1,
                    "action": "Přečti si instrukci",
                    "step_type": "information",
                    "note": "Důležitá poznámka",
                    "expected_result": "Toto se má ignorovat",
                    "test_data": "Toto také",
                },
                {
                    "step_order": 2,
                    "action": "Proveď kontrolu",
                    "step_type": "test",
                    "note": "Poznámka testovacího kroku",
                    "expected_result": "Kontrola projde",
                },
            ],
        },
    )
    assert case_response.status_code == 201
    test_case = case_response.json()
    information_step, test_step = test_case["steps"]
    assert information_step["step_type"] == "information"
    assert information_step["note"] == "Důležitá poznámka"
    assert information_step["expected_result"] is None
    assert information_step["test_data"] is None

    update_step_response = client.put(
        f"/api/test-steps/{information_step['id']}",
        headers=headers,
        json={
            "step_type": "information",
            "note": "Aktualizovaná poznámka",
            "expected_result": "Stále se má ignorovat",
        },
    )
    assert update_step_response.status_code == 200
    information_step = update_step_response.json()
    assert information_step["note"] == "Aktualizovaná poznámka"
    assert information_step["expected_result"] is None

    test_run = create_test_run(client, headers)
    updated_run = add_case_to_run(client, headers, test_run["id"], test_case["id"])
    run_case = updated_run["test_run_cases"][0]
    assert [item["test_step_id"] for item in run_case["step_results"]] == [test_step["id"]]
    snapshot_steps = run_case["test_case_snapshot"]["steps"]
    assert snapshot_steps[0]["step_type"] == "information"
    assert snapshot_steps[0]["note"] == "Aktualizovaná poznámka"

    result_response = client.put(
        f"/api/test-run-cases/{run_case['id']}/steps/{information_step['id']}/result",
        headers=headers,
        json={"result": "passed"},
    )
    assert result_response.status_code == 400
    assert result_response.json()["detail"] == "Netestovací krok nelze vyhodnotit."
