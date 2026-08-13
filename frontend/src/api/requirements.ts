import { request, type Defect, type Priority, type TestCase, type TestRunCaseResult } from "./client";

export type RequirementStatus = "draft" | "approved" | "deprecated";

export type Requirement = {
  id: number;
  project_id: number;
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
  test_cases: Array<{ id: number; code: string; title: string; status: string; priority: string }>;
  coverage_status: "covered" | "missing_tests";
  risk_status: "missing_tests" | "defect_risk" | "failing" | "partial" | "verified";
  tested_case_count: number;
  failed_case_count: number;
  blocked_case_count: number;
  open_defect_count: number;
  latest_result: TestRunCaseResult | null;
  latest_executed_at: string | null;
  open_defects: Defect[];
};

export function getRequirements(projectId: number) {
  return request<Requirement[]>(`/projects/${projectId}/requirements`);
}

export function createRequirement(projectId: number, payload: RequirementPayload) {
  return request<Requirement>(`/projects/${projectId}/requirements`, {
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

export function getTraceability(projectId: number) {
  return request<TraceabilityRow[]>(`/projects/${projectId}/traceability`);
}
