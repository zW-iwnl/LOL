import { request, type TestCase } from "./client";

export type GetTestCasesParams = {
  suiteId?: number;
};

export function getTestCases(projectId: number, params: GetTestCasesParams = {}) {
  const query = params.suiteId ? `?suite_id=${params.suiteId}` : "";
  return request<TestCase[]>(`/projects/${projectId}/test-cases${query}`);
}
