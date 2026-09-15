"""Rehearse removal and review on an EMPTY approval_verify_* PostgreSQL DB.

DATABASE_URL selects the isolated database. Exports removed rows into /tmp.
Existing nonempty databases are rejected; no live configuration is changed.
"""
import json
from pathlib import Path
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import User, TestSuite, TestCaseTag
from tests.test_case_approval_workflow import proposal, submit, decide, post, patch, execution

url = make_url(settings.database_url)
if url.get_backend_name() != 'postgresql' or not (url.database or '').startswith('approval_verify_'):
    raise SystemExit('An isolated approval_verify_* PostgreSQL database is required')
backend_dir = Path(__file__).resolve().parents[1]
config = Config(str(backend_dir / 'alembic.ini'))
config.set_main_option('script_location', str(backend_dir / 'alembic'))
command.upgrade(config, '0023_test_run_task_number')
with SessionLocal() as db:
    if db.query(User).count(): raise SystemExit('Use an empty database; existing data will not be reset')
    db.add_all([User(id=1, name='Author', email='admin@testmanager.cz', role='admin', password_hash=hash_password('admin123'), is_active=True),
                User(id=2, name='Reviewer', email='reviewer@example.cz', role='reviewer', password_hash=hash_password('reviewer123'), is_active=True)])
    db.flush()
    db.add(TestSuite(id=1, name='Přístupy', created_by=1, is_active=True))
    db.add(TestCaseTag(id=999, name='Převody', category='business_area'))
    db.commit()
with TestClient(app) as client:
    def login(email, password):
        r = client.post('/api/auth/login', json={'email': email, 'password': password})
        assert r.status_code == 200, r.text
        return {'Authorization': f"Bearer {r.json()['access_token']}"}
    author, reviewer = login('admin@testmanager.cz', 'admin123'), login('reviewer@example.cz', 'reviewer123')
    def get(path, actor=author):
        r = client.get('/api' + path, headers=actor)
        assert r.status_code == 200, (path, r.text)
        return r.json()
    draft = proposal(client, author)
    content = draft['content']; content.update(title='Příliš žluťoučký scénář', tag_ids=[999])
    saved = patch(client, author, f"/test-case-drafts/{draft['id']}", {'lock_version': draft['lock_version'], 'content': content})
    assert saved.status_code == 200, saved.text
    draft = saved.json()
    assert get('/test-case-draft-summaries?q=prilis&business_area_id=999')['total'] == 1
    review = submit(client, author, draft)
    comment = post(client, reviewer, f"/test-case-reviews/{review['id']}/comments", {'body': 'Doplňte očekávání', 'is_blocking': True})
    assert comment.status_code == 201, comment.text
    detail = get(f"/test-case-reviews/{review['id']}", reviewer)
    assert not detail['capabilities']['can_approve']
    assert post(client, reviewer, f"/test-case-review-comments/{comment.json()['id']}/resolutions").status_code == 200
    review = get(f"/test-case-reviews/{review['id']}", reviewer)
    decide(client, reviewer, review, 'changes_requested')
    draft = get(f"/test-case-drafts/{draft['id']}")
    content['steps'][0]['expected_result'] = 'Zobrazen formulář'
    saved = patch(client, author, f"/test-case-drafts/{draft['id']}", {'lock_version': draft['lock_version'], 'content': content})
    assert saved.status_code == 200, saved.text
    review = submit(client, author, saved.json())
    decide(client, reviewer, review)
    response = client.post('/api/test-runs', headers=author, json={'name': 'Migrační ověření', 'test_case_ids': [draft['test_case_id']]})
    assert response.status_code == 201, response.text
    run = response.json()
    before_execution = execution(client, author, run['id'])
    attempt = before_execution['test_run_cases'][0]['case_attempt_id']
    assert client.put(f'/api/test-run-case-attempts/{attempt}/result', headers=author, json={'result': 'passed'}).status_code == 200
    new_draft = post(client, author, f"/test-cases/{draft['test_case_id']}/drafts", {'origin_case_attempt_id': attempt})
    assert new_draft.status_code == 201, new_draft.text
    pending = submit(client, author, new_draft.json())
    open_draft = proposal(client, author)
    saved = patch(client, author, f"/test-case-drafts/{open_draft['id']}", {'lock_version': open_draft['lock_version'], 'content': content})
    assert saved.status_code == 200, saved.text
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO requirements (id, code, title, priority, status, created_by) VALUES (1, 'REMOVE-1', 'Export', 'medium', 'draft', 1)"))
        conn.execute(text('INSERT INTO requirement_test_cases VALUES (1, :case)'), {'case': draft['test_case_id']})
    def rows(names):
        with engine.connect() as conn:
            return {name: sorted(conn.execute(text(f'SELECT row_to_json(t)::text FROM "{name}" t')).scalars().all()) for name in names}
    core = [name for name in inspect(engine).get_table_names() if name not in ('requirements', 'requirement_test_cases', 'alembic_version')]
    before = rows(core)
    export = Path('/tmp') / f'{url.database}-requirements-backup.json'
    export.write_text(json.dumps(rows(['requirements', 'requirement_test_cases']), ensure_ascii=False, indent=2))
    command.upgrade(config, 'head')
    assert not {'requirements', 'requirement_test_cases'} & set(inspect(engine).get_table_names())
    assert rows(core) == before
    assert get('/test-case-reviews?q=prilis&business_area_id=999')['total'] >= 1
    assert get('/test-case-draft-summaries?q=prilis&business_area_id=999')['total'] == 1
    assert get('/repository/cases?q=prilis')['total'] == 1  # Open drafts have separate content.
    page = get('/test-runs/page')
    assert page['total'] == 1 and page['stats']['averagePassRate'] == 100
    assert page['items'][0]['test_run_cases'][0]['code']
    assert get('/dashboard')['recent_test_runs'][0]['executed'] == 1
    after = execution(client, author, run['id'])
    assert after['test_run_cases'][0]['test_case_snapshot'] == before_execution['test_run_cases'][0]['test_case_snapshot']
    assert after['test_run_cases'][0]['result'] == 'passed'
    detail = get(f"/test-case-reviews/{pending['id']}", reviewer)
    assert detail['origin_case_attempt_id'] == attempt and detail['origin_run_case_id']
    assert client.get('/api/requirements', headers=author).status_code == 404
    assert client.get('/api/traceability', headers=author).status_code == 404
    print(json.dumps({'migration': 'passed', 'workflow': 'passed', 'unchanged_core_tables': len(core), 'requirements_export': str(export)}))
