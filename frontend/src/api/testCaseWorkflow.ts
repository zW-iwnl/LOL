import { request, type TestStepPayload } from "./client";

export type DraftStep = TestStepPayload & { step_key: string };
export type DraftContent = {
  title: string; description: string | null; preconditions: string | null;
  expected_summary: string | null; automated: boolean; tag_ids: number[]; steps: DraftStep[];
};
export type CaseDraft = {
  id: number; test_case_id: number; code: string; suite_id: number; content: DraftContent;
  lock_version: number; status: "open" | "submitted" | "closed"; editor_id: number;
  contributors: number[]; change_summary: string; origin_run_id: number | null;
  origin_run_attempt_id?: number | null;
  origin_case_attempt_id: number | null; last_frozen_version_id: number | null;
  base_version_id: number | null; published_version_id: number | null; updated_at: string;
};
export type CaseVersion = {
  id: number; test_case_id: number; version_number: number; approval_state: string;
  contributors: number[];
  content_snapshot: DraftContent & { code: string; tags: { id: number; category: string; name: string }[] };
  change_summary: string; created_at: string; origin_run_id: number | null;
};
export type Review = {
  id: number; test_case_id: number; test_case_version_id: number; version_number: number;
  blocking_count?: number; origin_run_name?: string | null;
  source_draft_id: number; code: string; title: string; status: string; author_name: string;
  reviewer_name: string | null; reviewer_id: number | null; submitted_by: number;
  lock_version: number; origin_run_id: number | null; created_at: string; decision_reason: string | null;
};
export type ReviewDetail = Review & {
  base_approved_version_id?: number | null;
  capabilities?: ReviewCapabilities;
  origin_case_attempt_id?: number | null; origin_run_attempt_id?: number | null; origin_run_case_id?: number | null; base_version_number?: number | null;
  history?: { id: number; event_type: string; actor_id: number; created_at: string; payload: Record<string, unknown> }[];
  version: CaseVersion;
  changes: { field: string; before: unknown; after: unknown }[];
  comments: { id: number; body: string; author_name?: string; author_id: number; is_blocking: boolean; resolved_at: string | null; field_path: string | null }[];
};
export type Page<T> = { total: number; items: T[] };

export function workflowMutation<T>(path: string, body: unknown = {}, method = "POST", key = crypto.randomUUID()): Promise<T> {
  return request<T>(path, { method, headers: { "Idempotency-Key": key }, body: JSON.stringify(body) });
}
export const getDraft = (id: number) => request<CaseDraft>(`/test-case-drafts/${id}`);
export const getDrafts = (query = "") => request<Page<CaseDraft>>(`/test-case-drafts?${query}`);
export const createDraft = (caseId: number, baseVersionId?: number, originCaseAttemptId?: number) =>
  workflowMutation<CaseDraft>(`/test-cases/${caseId}/drafts`, { base_version_id: baseVersionId, origin_case_attempt_id: originCaseAttemptId });
export const saveDraft = (draft: CaseDraft, content: DraftContent, summary: string) =>
  workflowMutation<CaseDraft>(`/test-case-drafts/${draft.id}`, { lock_version: draft.lock_version, content, change_summary: summary }, "PATCH");
export const submitDraft = (draft: CaseDraft, summary: string) =>
  workflowMutation<Review>(`/test-case-drafts/${draft.id}/submissions`, { lock_version: draft.lock_version, change_summary: summary });
export const getVersions = (caseId: number, offset = 0) => request<Page<CaseVersion>>(`/test-cases/${caseId}/versions?offset=${offset}`);
export const getReviews = (query = "") => request<Page<Review>>(`/test-case-reviews?${query}`);
export const getReview = (id: number) => request<ReviewDetail>(`/test-case-reviews/${id}`);
export const emptyContent = (): DraftContent => ({ title: "", description: null, preconditions: null, expected_summary: null, automated: false, tag_ids: [], steps: [] });

export type DraftSummary = { id: number; test_case_id: number; code: string; title: string; suite_id: number; status: string; editor_id: number; editor_name: string; origin_run_id: number | null; origin_run_name?: string | null; updated_at: string };
export const getDraftSummaries = (query: string) => request<Page<DraftSummary>>(`/test-case-draft-summaries?${query}`);
export type ReviewCapabilities = {
  can_decide: boolean; can_approve: boolean; can_claim: boolean; can_assign: boolean; can_comment: boolean; can_block: boolean; can_withdraw: boolean;
  decision_reason: string | null; approval_reason: string | null; resolvable_comment_ids: number[]; eligible_reviewers: { id: number; name: string }[];
};
