import { request } from "./client";
import type { TestRun } from "./testRuns";

export type PlanningStatus = "planned" | "active" | "completed" | "archived";
export type TestPlanStatus = "draft" | "active" | "completed" | "archived";

export type Release = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  status: PlanningStatus;
  release_date: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type Milestone = {
  id: number;
  project_id: number;
  release_id: number | null;
  name: string;
  description: string | null;
  status: PlanningStatus;
  planned_start: string | null;
  planned_end: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type TestPlan = {
  id: number;
  project_id: number;
  release_id: number | null;
  milestone_id: number | null;
  name: string;
  description: string | null;
  status: TestPlanStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
  test_runs: TestRun[];
};

export type ReleasePayload = {
  name: string;
  description?: string | null;
  status?: PlanningStatus;
  release_date?: string | null;
};

export type MilestonePayload = {
  release_id?: number | null;
  name: string;
  description?: string | null;
  status?: PlanningStatus;
  planned_start?: string | null;
  planned_end?: string | null;
};

export type TestPlanPayload = {
  release_id?: number | null;
  milestone_id?: number | null;
  name: string;
  description?: string | null;
  status?: TestPlanStatus;
  test_run_ids?: number[];
};

export type TestPlanCreateRunPayload = {
  name?: string | null;
  description?: string | null;
  version?: string | null;
  environment?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
};

export function getReleases(projectId: number) {
  return request<Release[]>(`/projects/${projectId}/releases`);
}

export function createRelease(projectId: number, payload: ReleasePayload) {
  return request<Release>(`/projects/${projectId}/releases`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMilestones(projectId: number) {
  return request<Milestone[]>(`/projects/${projectId}/milestones`);
}

export function createMilestone(projectId: number, payload: MilestonePayload) {
  return request<Milestone>(`/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTestPlans(projectId: number) {
  return request<TestPlan[]>(`/projects/${projectId}/test-plans`);
}

export function createTestPlan(projectId: number, payload: TestPlanPayload) {
  return request<TestPlan>(`/projects/${projectId}/test-plans`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addRunsToTestPlan(testPlanId: number, testRunIds: number[]) {
  return request<TestPlan>(`/test-plans/${testPlanId}/runs`, {
    method: "POST",
    body: JSON.stringify({ test_run_ids: testRunIds }),
  });
}

export function createRunFromTestPlan(testPlanId: number, payload: TestPlanCreateRunPayload) {
  return request<TestPlan>(`/test-plans/${testPlanId}/create-run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeRunFromTestPlan(testPlanId: number, testRunId: number) {
  return request<void>(`/test-plans/${testPlanId}/runs/${testRunId}`, {
    method: "DELETE",
  });
}
