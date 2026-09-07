# API Spec

## Auth
POST /api/auth/login
GET  /api/auth/me

## Test Suites
GET    /api/test-suites
POST   /api/test-suites
GET    /api/test-suites/{suite_id}
PUT    /api/test-suites/{suite_id}
DELETE /api/test-suites/{suite_id}

GET    /api/test-suites/search?q=login
GET    /api/test-suites/{suite_id}/test-cases

## Suite Groups
GET    /api/suite-groups
POST   /api/suite-groups
GET    /api/suite-groups/{group_id}
PUT    /api/suite-groups/{group_id}
DELETE /api/suite-groups/{group_id}

POST   /api/suite-groups/{parent_group_id}/children
DELETE /api/suite-groups/{parent_group_id}/children/{child_group_id}
PUT    /api/suite-groups/{group_id}/parents
PUT    /api/suite-groups/{group_id}/test-case-members
PUT    /api/suite-groups/suites/{suite_id}/groups

## Test Cases
GET    /api/test-cases
POST   /api/test-cases
GET    /api/test-cases/{test_case_id}
PUT    /api/test-cases/{test_case_id}
DELETE /api/test-cases/{test_case_id}

DELETE fyzicky odstraní jen nepoužitý draft. Použitý nebo publikovaný test case
se označí jako deprecated a execution historie zůstane zachovaná.

POST   /api/test-cases/{test_case_id}/steps
PUT    /api/test-steps/{step_id}
DELETE /api/test-steps/{step_id}

## Test Runs
GET    /api/test-runs
POST   /api/test-runs
GET    /api/test-runs/{test_run_id}
PUT    /api/test-runs/{test_run_id}
DELETE /api/test-runs/{test_run_id}

POST   /api/test-runs/{test_run_id}/cases
GET    /api/test-runs/{test_run_id}/execution
GET    /api/test-runs/{test_run_id}/attempts
POST   /api/test-runs/{test_run_id}/reruns

GET /api/test-runs vrací lehké položky test run cases bez snapshotů a step historie.
Plný detail je dostupný přes detail a execution endpointy.

## Execution
PUT  /api/test-run-cases/{test_run_case_id}/result
PUT  /api/test-run-case-attempts/{case_attempt_id}/result
POST /api/test-run-case-attempts/{case_attempt_id}/reruns
PUT  /api/test-run-case-attempts/{case_attempt_id}/steps/{test_step_id}/result


## Dashboard
GET /api/dashboard

## Requirements
GET  /api/requirements
POST /api/requirements
GET  /api/traceability

## Repository Search
GET /api/repository/search?q=login

Všechna pracovní data patří do jediného globálního repository. API proto
nepoužívá projektový identifikátor ani projektové prefixy.
