# API Spec

## Auth
POST /api/auth/login
GET  /api/auth/me

## Projects
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
PUT    /api/projects/{project_id}
DELETE /api/projects/{project_id}

## Test Suites
GET    /api/projects/{project_id}/test-suites
POST   /api/projects/{project_id}/test-suites
GET    /api/test-suites/{suite_id}
PUT    /api/test-suites/{suite_id}
DELETE /api/test-suites/{suite_id}

GET    /api/projects/{project_id}/test-suites/tree
GET    /api/projects/{project_id}/test-suites/search?q=login
GET    /api/test-suites/{suite_id}/children
GET    /api/test-suites/{suite_id}/test-cases

## Test Cases
GET    /api/projects/{project_id}/test-cases
POST   /api/projects/{project_id}/test-cases
GET    /api/test-cases/{test_case_id}
PUT    /api/test-cases/{test_case_id}
DELETE /api/test-cases/{test_case_id}

POST   /api/test-cases/{test_case_id}/steps
PUT    /api/test-steps/{step_id}
DELETE /api/test-steps/{step_id}

## Test Runs
GET    /api/projects/{project_id}/test-runs
POST   /api/projects/{project_id}/test-runs
GET    /api/test-runs/{test_run_id}
PUT    /api/test-runs/{test_run_id}
DELETE /api/test-runs/{test_run_id}

POST   /api/test-runs/{test_run_id}/cases
GET    /api/test-runs/{test_run_id}/execution

## Execution
PUT /api/test-run-cases/{test_run_case_id}/result

## Defects
GET    /api/projects/{project_id}/defects
POST   /api/projects/{project_id}/defects
GET    /api/defects/{defect_id}
PUT    /api/defects/{defect_id}
DELETE /api/defects/{defect_id}

## Dashboard
GET /api/projects/{project_id}/dashboard
