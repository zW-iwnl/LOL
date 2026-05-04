const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type Priority = "low" | "medium" | "high" | "critical";
export type TestCaseStatus = "draft" | "ready" | "deprecated";
export type TestRunStatus = "open" | "in_progress" | "completed" | "archived";
export type TestRunCaseResult = "not_run" | "passed" | "failed" | "blocked" | "skipped";
export type DefectStatus = "open" | "in_progress" | "fixed" | "retest" | "closed" | "rejected";

export type Project = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
};

export type Dashboard = {
  stats: {
    test_cases_count: number;
    active_test_runs_count: number;
    pass_rate: number;
    open_defects_count: number;
  };
  recent_test_runs: Array<{ id: number; name: string; status: string; environment: string | null }>;
  results: Array<{ result: TestRunCaseResult; count: number }>;
};

export type TestSuite = {
  id: number;
  project_id: number;
  parent_suite_id: number | null;
  name: string;
  description: string | null;
  path: string;
  level: number;
  sort_order: number;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type TestSuitePayload = {
  parent_suite_id?: number | null;
  name: string;
  description?: string | null;
  path?: string | null;
  level?: number;
  sort_order?: number;
  is_active?: boolean;
};

export type TestStep = {
  id: number;
  test_case_id: number;
  step_order: number;
  action: string;
  expected_result: string | null;
  test_data: string | null;
  created_at: string;
  updated_at: string;
};

export type TestCase = {
  id: number;
  project_id: number;
  suite_id: number | null;
  code: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  expected_summary: string | null;
  priority: Priority;
  type: string;
  status: TestCaseStatus;
  automated: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  steps: TestStep[];
};

export type TestCaseCreate = Omit<TestCase, "id" | "project_id" | "created_by" | "created_at" | "updated_at" | "steps"> & {
  steps: Array<Pick<TestStep, "step_order" | "action" | "expected_result" | "test_data">>;
};

export type TestCaseUpdate = Partial<Omit<TestCaseCreate, "steps">>;

export type TestStepPayload = Pick<TestStep, "step_order" | "action" | "expected_result" | "test_data">;

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

export type TestRunCaseExecution = TestRunCase & {
  code: string;
  title: string;
  priority: Priority;
  suite_name: string | null;
  test_case: TestCase;
};

export type TestRunExecution = Omit<TestRun, "test_run_cases"> & {
  test_run_cases: TestRunCaseExecution[];
};

export type TestRunCreate = {
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

export type AddTestCasesPayload = {
  test_case_ids: number[];
  assigned_to?: number | null;
};

export type DefectCreate = {
  test_run_case_id?: number | null;
  title: string;
  description?: string | null;
  severity?: Priority;
  priority?: Priority;
  status?: DefectStatus;
  assigned_to?: number | null;
};

export type Defect = Required<Omit<DefectCreate, "description" | "assigned_to">> & {
  id: number;
  project_id: number;
  description: string | null;
  assigned_to: number | null;
  reported_by: number;
  created_at: string;
  updated_at: string;
};

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `API chyba ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  return request("/health");
}

export function getProjects() {
  return request<Project[]>("/projects");
}

export function getUsers() {
  return request<User[]>("/users");
}

export function getDashboard(projectId: number) {
  return request<Dashboard>(`/projects/${projectId}/dashboard`);
}

export function getTestSuites(projectId: number) {
  return request<TestSuite[]>(`/projects/${projectId}/test-suites`);
}

export function getTestSuiteChildren(suiteId: number) {
  return request<TestSuite[]>(`/test-suites/${suiteId}/children`);
}

export function getTestSuiteTestCases(suiteId: number) {
  return request<TestCase[]>(`/test-suites/${suiteId}/test-cases`);
}

export function searchTestSuites(projectId: number, query: string) {
  return request<TestSuite[]>(`/projects/${projectId}/test-suites/search?q=${encodeURIComponent(query)}`);
}

export function createTestSuite(projectId: number, payload: TestSuitePayload) {
  return request<TestSuite>(`/projects/${projectId}/test-suites`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestSuite(suiteId: number, payload: Partial<TestSuitePayload>) {
  return request<TestSuite>(`/test-suites/${suiteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getTestCases(projectId: number, suiteId?: number) {
  const query = suiteId ? `?suite_id=${suiteId}` : "";
  return request<TestCase[]>(`/projects/${projectId}/test-cases${query}`);
}

export function getTestCase(testCaseId: number) {
  return request<TestCase>(`/test-cases/${testCaseId}`);
}

export function createTestCase(projectId: number, payload: TestCaseCreate) {
  return request<TestCase>(`/projects/${projectId}/test-cases`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestCase(testCaseId: number, payload: TestCaseUpdate) {
  return request<TestCase>(`/test-cases/${testCaseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createTestStep(testCaseId: number, payload: TestStepPayload) {
  return request<TestStep>(`/test-cases/${testCaseId}/steps`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestStep(stepId: number, payload: Partial<TestStepPayload>) {
  return request<TestStep>(`/test-steps/${stepId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTestStep(stepId: number) {
  return request<void>(`/test-steps/${stepId}`, {
    method: "DELETE",
  });
}

export function getTestRuns(projectId: number) {
  return request<TestRun[]>(`/projects/${projectId}/test-runs`);
}

export function createTestRun(projectId: number, payload: TestRunCreate) {
  return request<TestRun>(`/projects/${projectId}/test-runs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addTestRunCases(testRunId: number, payload: AddTestCasesPayload) {
  return request<TestRun>(`/test-runs/${testRunId}/cases`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTestRunExecution(testRunId: number) {
  return request<TestRunExecution>(`/test-runs/${testRunId}/execution`);
}

export function updateTestRunCaseResult(
  testRunCaseId: number,
  payload: { result: TestRunCaseResult; comment?: string | null; defect?: DefectCreate | null },
) {
  return request<TestRunCase>(`/test-run-cases/${testRunCaseId}/result`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createDefect(projectId: number, payload: DefectCreate) {
  return request<Defect>(`/projects/${projectId}/defects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDefects(projectId: number) {
  return request<Defect[]>(`/projects/${projectId}/defects`);
}
