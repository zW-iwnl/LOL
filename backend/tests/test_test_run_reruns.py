from fastapi.testclient import TestClient

from tests.test_test_runs import (
    add_case_to_run,
    auth_headers,
    create_test_case,
    create_test_run,
)


def prepare_run(client: TestClient) -> tuple[dict, dict, int]:
    headers = auth_headers(client)
    test_case = create_test_case(client, headers)
    test_run = create_test_run(client, headers)
    add_case_to_run(client, headers, test_run["id"], test_case["id"])
    execution_response = client.get(
        f"/api/test-runs/{test_run['id']}/execution",
        headers=headers,
    )
    assert execution_response.status_code == 200
    execution = execution_response.json()
    return headers, execution, test_case["steps"][0]["id"]


def test_rerun_preserves_previous_case_and_step_results(client: TestClient) -> None:
    headers, first_execution, step_id = prepare_run(client)
    run_id = first_execution["id"]
    first_attempt = first_execution["attempts"][0]
    first_case = first_execution["test_run_cases"][0]

    step_response = client.put(
        f"/api/test-run-case-attempts/{first_case['case_attempt_id']}/steps/{step_id}/result",
        headers=headers,
        json={"result": "passed"},
    )
    assert step_response.status_code == 200

    result_response = client.put(
        f"/api/test-run-case-attempts/{first_case['case_attempt_id']}/result",
        headers=headers,
        json={"result": "failed", "comment": "Chyba v prvním běhu"},
    )
    assert result_response.status_code == 200

    rerun_response = client.post(f"/api/test-runs/{run_id}/reruns", headers=headers)
    assert rerun_response.status_code == 201
    rerun = rerun_response.json()
    assert [item["attempt_number"] for item in rerun["attempts"]] == [1, 2]
    assert rerun["selected_attempt_id"] == rerun["attempts"][1]["id"]
    assert rerun["test_run_cases"][0]["case_attempt_id"] != first_case["case_attempt_id"]
    assert rerun["test_run_cases"][0]["result"] == "not_run"
    assert rerun["test_run_cases"][0]["step_results"][0]["result"] == "not_run"

    history_response = client.get(
        f"/api/test-runs/{run_id}/execution?attempt_id={first_attempt['id']}",
        headers=headers,
    )
    assert history_response.status_code == 200
    history = history_response.json()
    assert history["selected_attempt_id"] == first_attempt["id"]
    assert history["test_run_cases"][0]["result"] == "failed"
    assert history["test_run_cases"][0]["comment"] == "Chyba v prvním běhu"
    assert history["test_run_cases"][0]["step_results"][0]["result"] == "passed"


def test_rerun_remembers_position_and_history_is_read_only(client: TestClient) -> None:
    headers, first_execution, step_id = prepare_run(client)
    run_id = first_execution["id"]
    first_case = first_execution["test_run_cases"][0]

    complete_response = client.put(
        f"/api/test-run-case-attempts/{first_case['case_attempt_id']}/result",
        headers=headers,
        json={"result": "passed"},
    )
    assert complete_response.status_code == 200

    rerun_response = client.post(f"/api/test-runs/{run_id}/reruns", headers=headers)
    assert rerun_response.status_code == 201
    rerun = rerun_response.json()
    rerun_case = rerun["test_run_cases"][0]

    step_response = client.put(
        f"/api/test-run-case-attempts/{rerun_case['case_attempt_id']}/steps/{step_id}/result",
        headers=headers,
        json={"result": "failed"},
    )
    assert step_response.status_code == 200

    resumed_response = client.get(f"/api/test-runs/{run_id}/execution", headers=headers)
    assert resumed_response.status_code == 200
    resumed = resumed_response.json()
    selected_attempt = next(
        item for item in resumed["attempts"] if item["id"] == resumed["selected_attempt_id"]
    )
    assert selected_attempt["last_test_run_case_id"] == rerun_case["id"]
    assert selected_attempt["last_step_id"] == step_id

    historical_update = client.put(
        f"/api/test-run-case-attempts/{first_case['case_attempt_id']}/result",
        headers=headers,
        json={"result": "failed"},
    )
    assert historical_update.status_code == 409

    partial_rerun = client.post(f"/api/test-runs/{run_id}/reruns", headers=headers)
    assert partial_rerun.status_code == 201
    assert [item["attempt_number"] for item in partial_rerun.json()["attempts"]] == [1, 2, 3]

    second_history = client.get(
        f"/api/test-runs/{run_id}/execution?attempt_id={rerun['selected_attempt_id']}",
        headers=headers,
    )
    assert second_history.status_code == 200
    assert second_history.json()["test_run_cases"][0]["step_results"][0]["result"] == "failed"


def test_case_rerun_preserves_history_and_can_be_selected(client: TestClient) -> None:
    headers, first_execution, step_id = prepare_run(client)
    run_id = first_execution["id"]
    first_case = first_execution["test_run_cases"][0]
    first_case_attempt_id = first_case["case_attempt_id"]

    step_response = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/steps/{step_id}/result",
        headers=headers,
        json={"result": "passed"},
    )
    assert step_response.status_code == 200

    result_response = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/result",
        headers=headers,
        json={"result": "failed", "comment": "Chyba před resetem"},
    )
    assert result_response.status_code == 200

    reset_response = client.post(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/reruns",
        headers=headers,
    )
    assert reset_response.status_code == 201
    reset_execution = reset_response.json()
    assert len(reset_execution["attempts"]) == 1
    assert reset_execution["status"] == "in_progress"

    reset_case = reset_execution["test_run_cases"][0]
    second_case_attempt_id = reset_case["case_attempt_id"]
    assert second_case_attempt_id != first_case_attempt_id
    assert reset_case["result"] == "not_run"
    assert reset_case["step_results"][0]["result"] == "not_run"
    assert [item["attempt_number"] for item in reset_case["case_attempts"]] == [1, 2]
    assert reset_case["case_attempts"][0]["result"] == "failed"
    assert reset_case["case_attempts"][0]["comment"] == "Chyba před resetem"
    assert reset_case["case_attempts"][0]["step_results"][0]["result"] == "passed"

    stale_result_response = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/result",
        headers=headers,
        json={"result": "skipped"},
    )
    assert stale_result_response.status_code == 409

    stale_step_response = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/steps/{step_id}/result",
        headers=headers,
        json={"result": "failed"},
    )
    assert stale_step_response.status_code == 409

    second_result_response = client.put(
        f"/api/test-run-case-attempts/{second_case_attempt_id}/result",
        headers=headers,
        json={"result": "passed", "comment": "Opraveno"},
    )
    assert second_result_response.status_code == 200

    current_response = client.get(f"/api/test-runs/{run_id}/execution", headers=headers)
    assert current_response.status_code == 200
    current_case = current_response.json()["test_run_cases"][0]
    assert current_case["case_attempt_id"] == second_case_attempt_id
    assert current_case["result"] == "passed"
    assert [item["result"] for item in current_case["case_attempts"]] == ["failed", "passed"]

    historical_update = client.put(
        f"/api/test-run-case-attempts/{first_case_attempt_id}/result",
        headers=headers,
        json={"result": "skipped"},
    )
    assert historical_update.status_code == 409

    full_rerun_response = client.post(f"/api/test-runs/{run_id}/reruns", headers=headers)
    assert full_rerun_response.status_code == 201
    full_rerun = full_rerun_response.json()
    full_rerun_case = full_rerun["test_run_cases"][0]
    assert [item["attempt_number"] for item in full_rerun["attempts"]] == [1, 2]
    assert full_rerun_case["result"] == "not_run"
    assert [
        (item["test_run_attempt_number"], item["attempt_number"])
        for item in full_rerun_case["case_attempts"]
    ] == [(1, 1), (1, 2), (2, 1)]

    historical_reset = client.post(
        f"/api/test-run-case-attempts/{second_case_attempt_id}/reruns",
        headers=headers,
    )
    assert historical_reset.status_code == 409
