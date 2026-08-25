import { request, type TestCase } from "./client";

export type GetTestCasesParams = {
  suiteId?: number;
};

export function getTestCases(params: GetTestCasesParams = {}) {
  const query = params.suiteId ? `?suite_id=${params.suiteId}` : "";
  return request<TestCase[]>(`/test-cases${query}`);
}
