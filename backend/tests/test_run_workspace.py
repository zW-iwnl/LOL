from tests.test_test_runs import auth_headers, create_test_case, create_test_run, add_case_to_run
from conftest import TestingSessionLocal
from app.models import TestRunCase as RunCase, TestRunCaseAttempt as CaseAttempt


def test_summary_counts_filters_and_empty_runs(client):
    headers = auth_headers(client)
    first = create_test_run(client, headers)
    second = client.post('/api/test-runs', headers=headers, json={'name': 'Other', 'environment': 'CUSTOM'}).json()
    case = create_test_case(client, headers)
    add_case_to_run(client, headers, first['id'], case['id'])
    page = client.get('/api/test-runs/page?summary_only=true&environment=custom&limit=1', headers=headers).json()
    assert page['total'] == 1
    assert page['stats']['total'] == 2
    assert page['items'][0]['id'] == second['id']
    assert page['items'][0]['summary']['passRate'] is None
    assert page['items'][0]['test_run_cases'] == []
    with TestingSessionLocal() as db:
        row = db.query(RunCase).filter_by(test_run_id=first['id']).one()
        row.result = 'passed'
        db.commit()
    detail = client.get(f"/api/test-runs/{first['id']}?summary_only=true", headers=headers).json()
    assert detail['test_run_cases'] == []
    assert detail['summary']['executed'] == 1
    assert detail['summary']['passRate'] == 100
    assert detail['summary']['progress'] == 100
    assert client.get('/api/test-runs/999?summary_only=true', headers=headers).status_code == 404


def test_cases_page_uses_attempt_snapshot_and_preserves_history(client):
    headers = auth_headers(client)
    case = create_test_case(client, headers)
    run = create_test_run(client, headers)
    added = add_case_to_run(client, headers, run['id'], case['id'])
    case_id = added['test_run_cases'][0]['id']
    with TestingSessionLocal() as db:
        row = db.get(RunCase, case_id)
        row.test_case_snapshot = {'code': 'OLD', 'title': 'Old title'}
        attempt = db.query(CaseAttempt).filter_by(test_run_case_id=case_id).one()
        attempt.execution_snapshot = {**attempt.execution_snapshot, 'code': 'SNAP-1', 'title': 'Historická platba'}
        attempt.result = 'failed'
        db.commit()
    path = f"/api/test-runs/{run['id']}/cases/page"
    page = client.get(path + '?q=historicka&tester=1&result=not_run', headers=headers).json()
    assert page['total'] == 1
    assert page['items'][0]['code'] == 'SNAP-1'
    assert page['items'][0]['title'] == 'Historická platba'
    assert page['items'][0]['has_history'] is True
    assert client.get(path + '?q=Old', headers=headers).json()['total'] == 0
    assert client.get(path + '?offset=1', headers=headers).json()['items'] == []
    assert client.get(path + '?tester=unassigned', headers=headers).json()['total'] == 0
    for query in ['tester=bad', 'offset=-1', 'limit=101', 'result=bad']:
        assert client.get(path + '?' + query, headers=headers).status_code == 422
    assert client.get('/api/test-runs/999/cases/page', headers=headers).status_code == 404
