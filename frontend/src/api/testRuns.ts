import { request, type Priority, type TestCase, type TestRunCaseResult } from "./client";

export type TestRunStatus = "open" | "in_progress" | "completed" | "archived";

export type TestRunCase = {
  id: number;
  test_run_id: number;
  test_case_id: number;
  assigned_to: number | null;
  result: TestRunCaseResult;
  comment: string | null;
  executed_by: number | null;
  executed_at: string | null;
  defect_count: number;
  test_case_version: number;
  test_case_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type TestRun = {
  id: number;
  project_id: number;
  name: string;
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
  test_run_cases: TestRunCase[];
};

export type TestRunCreatePayload = {
  name: string;
  description?: string | null;
  version?: string | null;
  environment?: string | null;
  status?: TestRunStatus;
  planned_start?: string | null;
  planned_end?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  test_case_ids?: number[];
};

export type TestRunUpdatePayload = Partial<TestRunCreatePayload>;

export type TestRunAddCasesPayload = {
  test_case_ids: number[];
  assigned_to?: number | null;
};

export type TestRunExecutionCase = TestRunCase & {
  code: string;
  title: string;
  priority: Priority;
  suite_name: string | null;
  test_case: TestCase;
};

export type TestRunExecution = Omit<TestRun, "test_run_cases"> & {
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

export function getTestRuns(projectId: number, params: GetTestRunsParams = {}) {
  return request<TestRun[]>(`/projects/${projectId}/test-runs${buildQuery(params)}`);
}

export function getTestRun(testRunId: number) {
  return request<TestRun>(`/test-runs/${testRunId}`);
}

export function createTestRun(projectId: number, payload: TestRunCreatePayload) {
  return request<TestRun>(`/projects/${projectId}/test-runs`, {
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

export function getTestRunExecution(testRunId: number) {
  return request<TestRunExecution>(`/test-runs/${testRunId}/execution`);
}
