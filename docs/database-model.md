# Database Model

## users
- id: bigint PK
- name: varchar(150)
- email: varchar(255), unique
- password_hash: varchar(255)
- role: varchar(50)
- is_active: boolean
- created_at: timestamp
- updated_at: timestamp

## projects
- id: bigint PK
- name: varchar(200)
- code: varchar(50), unique
- description: text
- status: varchar(30)
- created_by: FK users.id
- created_at: timestamp
- updated_at: timestamp

## test_suites
- id: bigint PK
- project_id: FK projects.id
- parent_suite_id: FK test_suites.id, nullable
- name: varchar(200)
- description: text
- path: varchar(1000)
- level: integer
- sort_order: integer
- is_active: boolean
- created_by: FK users.id
- created_at: timestamp
- updated_at: timestamp

## test_cases
- id: bigint PK
- project_id: FK projects.id
- suite_id: FK test_suites.id, nullable
- code: varchar(50), unique
- title: varchar(255)
- description: text
- preconditions: text
- expected_summary: text
- priority: varchar(30)
- type: varchar(50)
- status: varchar(30)
- automated: boolean
- created_by: FK users.id
- created_at: timestamp
- updated_at: timestamp

## test_steps
- id: bigint PK
- test_case_id: FK test_cases.id
- step_order: integer
- action: text
- expected_result: text
- test_data: text
- created_at: timestamp
- updated_at: timestamp

## test_runs
- id: bigint PK
- project_id: FK projects.id
- name: varchar(255)
- description: text
- version: varchar(100)
- environment: varchar(100)
- status: varchar(30)
- planned_start: timestamp
- planned_end: timestamp
- started_at: timestamp
- finished_at: timestamp
- created_by: FK users.id
- created_at: timestamp
- updated_at: timestamp

## test_run_cases
- id: bigint PK
- test_run_id: FK test_runs.id
- test_case_id: FK test_cases.id
- assigned_to: FK users.id, nullable
- result: varchar(30)
- comment: text
- executed_by: FK users.id, nullable
- executed_at: timestamp
- defect_count: integer
- created_at: timestamp
- updated_at: timestamp

## defects
- id: bigint PK
- project_id: FK projects.id
- test_run_case_id: FK test_run_cases.id, nullable
- title: varchar(255)
- description: text
- severity: varchar(30)
- priority: varchar(30)
- status: varchar(30)
- assigned_to: FK users.id, nullable
- reported_by: FK users.id
- created_at: timestamp
- updated_at: timestamp

## Doporučené indexy

```sql
CREATE INDEX idx_test_suites_project_id ON test_suites(project_id);
CREATE INDEX idx_test_suites_parent_suite_id ON test_suites(parent_suite_id);
CREATE INDEX idx_test_suites_path ON test_suites(path);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_suite_id ON test_cases(suite_id);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_run_cases_test_run_id ON test_run_cases(test_run_id);
```
