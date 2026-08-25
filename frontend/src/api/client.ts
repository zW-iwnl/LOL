const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const AUTH_TOKEN_STORAGE_KEY = "test-manager-token";

export type Priority = "low" | "medium" | "high" | "critical";
export type TestCaseStatus = "draft" | "ready" | "deprecated";
export type TestRunStatus = "open" | "in_progress" | "completed" | "archived";
export type TestRunCaseResult = "not_run" | "passed" | "failed" | "blocked" | "skipped";
export type TestRunStepResultValue = "not_run" | "passed" | "failed" | "skipped";
export type TestStepType = "test" | "information";
export type TestCaseTagCategory = "business_area" | "application_domain" | "object_type";

export type TestCaseTag = {
  id: number;
  category: TestCaseTagCategory;
  name: string;
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

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Dashboard = {
  stats: {
    test_cases_count: number;
    active_test_runs_count: number;
    pass_rate: number;
  };
  recent_test_runs: Array<{ id: number; name: string; status: string; environment: string | null }>;
  results: Array<{ result: TestRunCaseResult; count: number }>;
};

export type TestSuite = {
  id: number;
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
  direct_test_case_count: number;
  total_test_case_count: number;
  group_ids: number[];
};

export type TestSuitePayload = {
  parent_suite_id?: number | null;
  name: string;
  description?: string | null;
  path?: string | null;
  level?: number;
  sort_order?: number;
  is_active?: boolean;
  group_ids?: number[];
};

export type SuiteGroupMember = {
  group_id: number;
  suite_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SuiteGroupTestCaseMember = {
  group_id: number;
  test_case_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SuiteGroup = {
  id: number;
  parent_group_id: number | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  members: SuiteGroupMember[];
  test_case_members: SuiteGroupTestCaseMember[];
};

export type SuiteGroupPayload = {
  parent_group_id?: number | null;
  name: string;
  description?: string | null;
  sort_order?: number;
};

export type TestStep = {
  id: number;
  test_case_id: number;
  step_order: number;
  action: string;
  step_type: TestStepType;
  note: string | null;
  expected_result: string | null;
  test_data: string | null;
  created_at: string;
  updated_at: string;
};

export type TestCase = {
  id: number;
  suite_id: number | null;
  code: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  expected_summary: string | null;
  business_area_id: number | null;
  application_domain_id: number | null;
  object_type_id: number | null;
  business_area: TestCaseTag | null;
  application_domain: TestCaseTag | null;
  object_type: TestCaseTag | null;
  tag_ids: number[];
  tags: TestCaseTag[];
  status: TestCaseStatus;
  automated: boolean;
  version: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  steps: TestStep[];
};

export type TestCaseCreate = Omit<TestCase, "id" | "version" | "created_by" | "created_at" | "updated_at" | "steps" | "tags" | "tag_ids" | "business_area_id" | "application_domain_id" | "object_type_id" | "business_area" | "application_domain" | "object_type"> & {
  tag_ids: number[];
  steps: Array<Pick<TestStep, "step_order" | "action" | "step_type" | "note" | "expected_result" | "test_data">>;
};

export type TestCaseUpdate = Partial<Omit<TestCaseCreate, "steps">>;

export type TestStepPayload = Pick<TestStep, "step_order" | "action" | "step_type" | "note" | "expected_result" | "test_data">;

export type TestRunStepResult = {
  id: number;
  test_run_case_id: number;
  test_run_case_attempt_id: number;
  test_step_id: number;
  step_order: number;
  result: TestRunStepResultValue;
  executed_by: number | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TestRunCase = {
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

export type TestRun = {
  id: number;
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

export function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event("test-manager-auth-expired"));
    }
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

export function login(email: string, password: string) {
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser() {
  return request<User>("/auth/me");
}

export function getUsers() {
  return request<User[]>("/users");
}

export function getDashboard() {
  return request<Dashboard>("/dashboard");
}

export function getTestSuites() {
  return request<TestSuite[]>("/test-suites");
}

export function getTestSuiteChildren(suiteId: number) {
  return request<TestSuite[]>(`/test-suites/${suiteId}/children`);
}

export function getTestSuiteTestCases(suiteId: number) {
  return request<TestCase[]>(`/test-suites/${suiteId}/test-cases`);
}

export function searchTestSuites(query: string) {
  return request<TestSuite[]>(`/test-suites/search?q=${encodeURIComponent(query)}`);
}

export function createTestSuite(payload: TestSuitePayload) {
  return request<TestSuite>("/test-suites", {
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

export function deleteTestSuite(suiteId: number) {
  return request<void>(`/test-suites/${suiteId}`, {
    method: "DELETE",
  });
}

export function getSuiteGroups() {
  return request<SuiteGroup[]>("/suite-groups");
}

export function createSuiteGroup(payload: SuiteGroupPayload) {
  return request<SuiteGroup>("/suite-groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSuiteGroup(groupId: number, payload: Partial<SuiteGroupPayload>) {
  return request<SuiteGroup>(`/suite-groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSuiteGroup(groupId: number) {
  return request<void>(`/suite-groups/${groupId}`, { method: "DELETE" });
}

export function addSuiteGroupMember(groupId: number, suiteId: number, sortOrder = 0) {
  return request<SuiteGroupMember>(`/suite-groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ suite_id: suiteId, sort_order: sortOrder }),
  });
}

export function removeSuiteGroupMember(groupId: number, suiteId: number) {
  return request<void>(`/suite-groups/${groupId}/members/${suiteId}`, { method: "DELETE" });
}

export function updateSuiteGroupMember(groupId: number, suiteId: number, sortOrder: number) {
  return request<SuiteGroupMember>(`/suite-groups/${groupId}/members/${suiteId}`, {
    method: "PUT",
    body: JSON.stringify({ sort_order: sortOrder }),
  });
}

export function setTestSuiteGroups(suiteId: number, groupIds: number[]) {
  return request<TestSuite>(`/suite-groups/suites/${suiteId}/groups`, {
    method: "PUT",
    body: JSON.stringify({ group_ids: groupIds }),
  });
}

export function setSuiteGroupTestCases(groupId: number, testCaseIds: number[]) {
  return request<SuiteGroup>(`/suite-groups/${groupId}/test-case-members`, {
    method: "PUT",
    body: JSON.stringify({ test_case_ids: testCaseIds }),
  });
}

export type TestCaseFilters = {
  suiteId?: number;
  businessAreaIds?: number[];
  applicationDomainIds?: number[];
  objectTypeIds?: number[];
};

function testCaseQuery(filters: TestCaseFilters = {}) {
  const params = new URLSearchParams();
  if (filters.suiteId) params.set("suite_id", String(filters.suiteId));
  for (const id of filters.businessAreaIds ?? []) params.append("business_area_id", String(id));
  for (const id of filters.applicationDomainIds ?? []) params.append("application_domain_id", String(id));
  for (const id of filters.objectTypeIds ?? []) params.append("object_type_id", String(id));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getTestCases(filters: TestCaseFilters = {}) {
  return request<TestCase[]>(`/test-cases${testCaseQuery(filters)}`);
}

export function getTestCase(testCaseId: number) {
  return request<TestCase>(`/test-cases/${testCaseId}`);
}

export function createTestCase(payload: TestCaseCreate) {
  return request<TestCase>("/test-cases", {
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

export function deleteTestCase(testCaseId: number) {
  return request<void>(`/test-cases/${testCaseId}`, {
    method: "DELETE",
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

export function getTestCaseTags(category?: TestCaseTagCategory) {
  const query = category ? `?category=${category}` : "";
  return request<TestCaseTag[]>(`/test-case-tags${query}`);
}

export function createTestCaseTag(payload: { category: TestCaseTagCategory; name: string }) {
  return request<TestCaseTag>("/test-case-tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTestCaseTag(tagId: number, payload: { name: string }) {
  return request<TestCaseTag>(`/test-case-tags/${tagId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTestCaseTag(tagId: number) {
  return request<void>(`/test-case-tags/${tagId}`, {
    method: "DELETE",
  });
}

export function getTestRuns() {
  return request<TestRun[]>("/test-runs");
}

export function createTestRun(payload: TestRunCreate) {
  return request<TestRun>("/test-runs", {
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
  testRunCaseAttemptId: number,
  payload: { result: TestRunCaseResult; comment?: string | null },
) {
  return request<TestRunCase>(`/test-run-case-attempts/${testRunCaseAttemptId}/result`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
