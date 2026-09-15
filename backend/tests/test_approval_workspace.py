from sqlalchemy import inspect
from conftest import TestingSessionLocal, engine
from app.main import app
from app.models import TestCaseDraft as Draft, TestCaseVersion as Version, TestCaseReview as Review, TestCase as Case, TestRun as Run, TestRunCase as RunCase
from tests.test_case_approval_workflow import actors, proposal, submit, patch, post, decide


def test_queue_is_lightweight_and_separates_author_from_reviewer(client, actors):
    author, reviewer = actors
    draft = proposal(client, author)
    review = submit(client, author, draft)
    assigned = patch(client, reviewer, f"/test-case-reviews/{review['id']}/assignment", {"lock_version": review['lock_version'], "reviewer_id": 2})
    assert assigned.status_code == 200
    for headers, params, expected in [(author, "mine=true", 1), (reviewer, "mine=true", 0), (reviewer, "assigned_to_me=true", 1)]:
        response = client.get(f"/api/test-case-reviews?{params}", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()['total'] == expected
        if expected:
            row = response.json()['items'][0]
            assert 'version' not in row and 'content_snapshot' not in row
            assert row['reviewer_name'] == 'Reviewer'
    detail = client.get(f"/api/test-case-reviews/{review['id']}", headers=reviewer).json()
    assert detail['capabilities']['can_approve']
    assert not client.get(f"/api/test-case-reviews/{review['id']}", headers=author).json()['capabilities']['can_decide']
    response = post(client, reviewer, f"/test-case-reviews/{review['id']}/comments", {"body": "Opravit očekávání", "is_blocking": True})
    assert response.status_code == 201, response.text
    detail = client.get(f"/api/test-case-reviews/{review['id']}", headers=reviewer).json()
    assert not detail['capabilities']['can_approve'] and detail['capabilities']['can_decide']
    assert detail['comments'][0]['author_name'] == 'Reviewer'
    assert detail['capabilities']['resolvable_comment_ids'] == [response.json()['id']]
    assert [person['id'] for person in detail['capabilities']['eligible_reviewers']] == [2]


def test_draft_summaries_search_without_scenarios_and_pending_removed(client, actors):
    author, reviewer = actors
    draft = proposal(client, author)
    summary = client.get('/api/test-case-draft-summaries?q=scenar&mine=true', headers=author)
    assert summary.status_code == 200, summary.text
    assert summary.json()['total'] == 1
    assert summary.json()['items'][0]['editor_name'] == 'Admin Tester'
    assert 'content' not in summary.json()['items'][0]
    assert client.get('/api/test-case-draft-summaries?mine=true', headers=reviewer).json()['total'] == 0
    submit(client, author, draft)
    assert client.get('/api/test-case-draft-summaries', headers=author).json()['total'] == 0


def test_large_queue_and_runs_have_real_totals_and_pagination(client, actors):
    author, reviewer = actors
    with TestingSessionLocal() as db:
        for i in range(123):
            case = Case(code=f'W-{i:03}', title='Scénář', suite_id=1, created_by=1)
            db.add(case); db.flush()
            draft = Draft(test_case_id=case.id, editor_id=1, created_by=1, contributors=[1], content={'title': 'Příliš žluťoučký', 'steps': [], 'tag_ids': []}, status='submitted')
            db.add(draft); db.flush()
            version = Version(test_case_id=case.id, version_number=1, source_draft_id=draft.id, content_snapshot={'code': case.code, 'title': 'Příliš žluťoučký', 'suite_id': 1}, content_hash='x'*64, created_by=1)
            db.add(version); db.flush()
            db.add(Review(test_case_id=case.id, test_case_version_id=version.id, submitted_by=1))
            db.add(Run(name=f'Běh {i}', created_by=1, status='completed' if i == 0 else 'open'))
        db.commit()
    first = client.get('/api/test-case-reviews?q=prilis&limit=100', headers=reviewer).json()
    last = client.get('/api/test-case-reviews?q=prilis&limit=100&offset=100', headers=reviewer).json()
    assert first['total'] == 123 and len(first['items']) == 100 and len(last['items']) == 23
    runs = client.get('/api/test-runs/page?limit=100&offset=100', headers=author)
    assert runs.status_code == 200, runs.text
    assert runs.json()['total'] == 123 and len(runs.json()['items']) == 23
    assert runs.json()['stats'] == {'total': 123, 'active': 122, 'completed': 1, 'averagePassRate': 0}


def test_requirements_removed_without_removing_core_tables(client, actors):
    author, _ = actors
    tables = inspect(engine).get_table_names()
    assert 'requirements' not in tables and 'requirement_test_cases' not in tables
    assert 'test_case_versions' in tables and 'test_run_case_attempts' in tables
    assert client.get('/api/requirements', headers=author).status_code == 404
    assert client.get('/api/traceability', headers=author).status_code == 404
    assert '/api/requirements' not in app.openapi()['paths']
