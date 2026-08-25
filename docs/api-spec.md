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

GET    /api/test-suites/tree
GET    /api/test-suites/search?q=login
GET    /api/test-suites/{suite_id}/children
GET    /api/test-suites/{suite_id}/test-cases

## Test Cases
GET    /api/test-cases
POST   /api/test-cases
GET    /api/test-cases/{test_case_id}
PUT    /api/test-cases/{test_case_id}
DELETE /api/test-cases/{test_case_id}

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

## Execution
PUT /api/test-run-cases/{test_run_case_id}/result


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
