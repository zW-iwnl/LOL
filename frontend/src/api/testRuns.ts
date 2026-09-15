import {
  request,
  type TestCase,
  type TestRunCaseResult,
  type TestRunStepResult,
  type TestRunStepResultValue,
} from "./client";

export type TestRunStatus = "open" | "in_progress" | "completed" | "archived";

export type TestRunAttempt = {
  id: number;
  test_run_id: number;
  attempt_number: number;
  status: TestRunStatus;
  started_at: string | null;
  finished_at: string | null;
  created_by: number;
  last_test_run_case_id: number | null;
  last_step_id: number | null;
  created_at: string;
  updated_at: string;
};

export type TestRunCaseAttemptHistory = {
  id: number;
  execution_snapshot: Record<string, unknown> | null;
  version_number: number | null;
  test_case_version_id: number | null;
  approval_state: string;
  approval_state_at_start: string | null;
  approval_state_at_binding: string;
  closure_reason: string | null;
  test_run_attempt_id: number;
  test_run_attempt_number: number;
  test_run_case_id: number;
  attempt_number: number;
  result: TestRunCaseResult;
  comment: string | null;
  executed_by: number | null;
  executed_at: string | null;
  step_results: TestRunStepResult[];
  created_at: string;
  updated_at: string;
};

export type TestRunCase = {
  code?: string; title?: string;
  id: number;
  test_run_id: number;
  test_case_id: number;
  assigned_to: number | null;
  result: TestRunCaseResult;
  comment: string | null;
  executed_by: number | null;
  executed_at: string | null;
  test_case_version: number;
  test_case_snapshot: Record<string, unknown> | null;
  step_results: TestRunStepResult[];
  created_at: string;
  updated_at: string;
};

type TestRunBase = {
  id: number;
  name: string;
  task_number: string | null;
  description: string | null;
  version: string | null;
  environment: string | null;
  status: TestRunStatus;
  planned_start: string | null;
  planned_end: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type TestRun = TestRunBase & {
  test_run_cases: TestRunCase[];
};

export type TestRunCaseListItem = Pick<
  TestRunCase,
  "id" | "test_run_id" | "test_case_id" | "assigned_to" | "result" | "code" | "title"
>;

export type TestRunListItem = TestRunBase & {
  test_run_cases: TestRunCaseListItem[];
};

export type TestRunCreatePayload = {
  name: string;
  task_number?: string | null;
  description?: string | null;
  version?: string | null;
  environment?: string | null;
  status?: TestRunStatus;
  planned_start?: string | null;
  planned_end?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  test_case_ids?: number[];
  assigned_to?: number | null;
  selection?: RunSelection;
  selection_fingerprint?: string;
};

export type RunSelection = {
  groups: { group_id: number; include_descendants: boolean }[];
  suite_ids: number[];
  test_case_ids: number[];
};

export type SelectionCase = {
  id: number;
  code: string;
  title: string;
  suite_id: number;
  version_id: number | null;
  tags: string[];
  exclusion_reason: string | null;
};

export type SelectionSuite = { id: number; name: string; case_ids: number[] };
export type SelectionGroup = SelectionSuite & {
  own_case_ids: number[];
  suite_ids: number[];
  children: { group_id: number; include_descendants: boolean }[];
};
export type SelectionCatalog = {
  cases: SelectionCase[];
  suites: SelectionSuite[];
  groups: SelectionGroup[];
};
export type SelectionPreview = { cases: SelectionCase[]; excluded_cases: SelectionCase[]; fingerprint: string };

export function getRunSelectionCatalog() {
  return request<SelectionCatalog>("/test-runs/selection-catalog");
}

export function previewRunSelection(selection: RunSelection) {
  return request<SelectionPreview>("/test-runs/selection-preview", { method: "POST", body: JSON.stringify(selection) });
}

export type TestRunUpdatePayload = Partial<TestRunCreatePayload>;

export type TestRunAddCasesPayload = {
  test_case_ids: number[];
  assigned_to?: number | null;
};

export type TestRunExecutionCase = TestRunCase & {
  case_attempt_id: number;
  case_attempts: TestRunCaseAttemptHistory[];
  code: string;
  title: string;
  suite_name: string | null;
  test_case: TestCase;
};

export type ExecutionNavigationGroup = SelectionGroup & { direct_case_ids: number[] };
export type ExecutionNavigation = { suites: SelectionSuite[]; groups: ExecutionNavigationGroup[] };

export type TestRunExecution = Omit<TestRun, "test_run_cases"> & {
  navigation: ExecutionNavigation;
  definition_counts: Record<string, number>;
  attempts: TestRunAttempt[];
  selected_attempt_id: number;
  test_run_cases: TestRunExecutionCase[];
};

export type GetTestRunsParams = {
  q?: string;
  status?: TestRunStatus | "";
  environment?: string;
  limit?: number;
  offset?: number;
};

function buildQuery(params: GetTestRunsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.environment?.trim()) {
    searchParams.set("environment", params.environment.trim());
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getTestRuns(params: GetTestRunsParams = {}) {
  return request<TestRunListItem[]>(`/test-runs${buildQuery(params)}`);
}

export function getTestRun(testRunId: number) {
  return request<TestRun>(`/test-runs/${testRunId}`);
}

export function createTestRun(payload: TestRunCreatePayload) {
  return request<TestRun>("/test-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestRun(testRunId: number, payload: TestRunUpdatePayload) {
  return request<TestRun>(`/test-runs/${testRunId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function archiveTestRun(testRunId: number) {
  return request<void>(`/test-runs/${testRunId}`, {
    method: "DELETE",
  });
}

export function addCasesToTestRun(testRunId: number, payload: TestRunAddCasesPayload) {
  return request<TestRun>(`/test-runs/${testRunId}/cases`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestRunCase(testRunCaseId: number, payload: { assigned_to: number | null }) {
  return request<TestRunCase>(`/test-run-cases/${testRunCaseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function removeTestRunCase(testRunCaseId: number) {
  return request<void>(`/test-run-cases/${testRunCaseId}`, {
    method: "DELETE",
  });
}

export function getTestRunExecution(testRunId: number, attemptId?: number | null) {
  const query = attemptId ? `?attempt_id=${attemptId}` : "";
  return request<TestRunExecution>(`/test-runs/${testRunId}/execution${query}`);
}

export function createTestRunRerun(testRunId: number) {
  return request<TestRunExecution>(`/test-runs/${testRunId}/reruns`, {
    method: "POST",
  });
}

export function createTestRunCaseRerun(caseAttemptId: number) {
  return request<TestRunExecution>(`/test-run-case-attempts/${caseAttemptId}/reruns`, {
    method: "POST",
  });
}

export function updateTestRunStepResult(
  caseAttemptId: number,
  testStepId: number,
  result: TestRunStepResultValue,
) {
  return request<TestRunStepResult>(
    `/test-run-case-attempts/${caseAttemptId}/steps/${testStepId}/result`,
    {
      method: "PUT",
      body: JSON.stringify({ result }),
    },
  );
}

export function getTestRunPage(params: GetTestRunsParams = {}) {
  return request<{ items: TestRunListItem[]; total: number; offset: number; limit: number; stats: { total: number; active: number; completed: number; averagePassRate: number } }>(`/test-runs/page${buildQuery(params)}`);
}
