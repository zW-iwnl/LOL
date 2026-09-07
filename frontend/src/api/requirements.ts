import { request, type Priority, type TestCase, type TestRunCaseResult } from "./client";

export type RequirementStatus = "draft" | "approved" | "deprecated";

export type Requirement = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: RequirementStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  test_cases: TestCase[];
};

export type RequirementPayload = {
  code: string;
  title: string;
  description?: string | null;
  priority?: Priority;
  status?: RequirementStatus;
  test_case_ids?: number[];
};

export type TraceabilityRow = {
  requirement_id: number;
  requirement_code: string;
  requirement_title: string;
  requirement_priority: string;
  requirement_status: string;
  test_cases: Array<{ id: number; code: string; title: string; status: string; published_version_id?: number | null; latest_tested_version_id?: number | null; latest_tested_version_number?: number | null; latest_result?: string | null }>;
  coverage_status: "covered" | "proposed" | "missing_tests";
  risk_status: "missing_tests" | "failing" | "partial" | "verified";
  tested_case_count: number;
  failed_case_count: number;
  blocked_case_count: number;
  latest_result: TestRunCaseResult | null;
  latest_executed_at: string | null;
};

export function getRequirements() {
  return request<Requirement[]>("/requirements");
}

export function createRequirement(payload: RequirementPayload) {
  return request<Requirement>("/requirements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function linkRequirementTestCases(requirementId: number, testCaseIds: number[]) {
  return request<Requirement>(`/requirements/${requirementId}/test-cases`, {
    method: "POST",
    body: JSON.stringify({ test_case_ids: testCaseIds }),
  });
}

export function unlinkRequirementTestCase(requirementId: number, testCaseId: number) {
  return request<void>(`/requirements/${requirementId}/test-cases/${testCaseId}`, {
    method: "DELETE",
  });
}

export function getTraceability() {
  return request<TraceabilityRow[]>("/traceability");
}
