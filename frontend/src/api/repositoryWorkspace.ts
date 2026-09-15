import { request, type SuiteGroup, type TestCaseStatus, type TestCaseTagCategory } from "./client";

export type RepositoryGroup = Pick<SuiteGroup, "id" | "name" | "description" | "sort_order" | "parent_ids" | "child_ids" | "child_relations" | "tags"> & {
  suite_count: number; direct_case_count: number;
};
export type RepositoryCase = {
  published_version?: number | null; draft_id?: number | null; draft_status?: string | null; review_id?: number | null; review_version?: number | null;
  id: number; code: string; title: string; suite_id: number; suite_name: string; status: TestCaseStatus; automated: boolean;
  tags: { id: number; name: string; category: TestCaseTagCategory }[];
  origins: { group_id: number; group_name: string; suite_id: number | null; suite_name: string | null }[];
};
export type CasePage = { items: RepositoryCase[]; total: number; scope_total: number; offset: number; limit: number };
export type CaseFilters = { eligibleOnly?: boolean; excludeRunId?: number; groupId?: number; suiteId?: number; includeDescendants?: boolean; directOnly?: boolean;
  query?: string; status?: TestCaseStatus | ""; tagIds?: number[]; offset?: number; limit?: number };
export function getRepositoryStructure() {
  return request<{ groups: RepositoryGroup[]; test_case_count: number }>("/repository/groups");
}
export function getRepositoryGroup(id: number) { return request<SuiteGroup>(`/suite-groups/${id}`); }
export function getRepositoryCases(filters: CaseFilters = {}) {
  const params = new URLSearchParams();
  if (filters.eligibleOnly) params.set("eligible_only", "true");
  if (filters.excludeRunId) params.set("exclude_run_id", String(filters.excludeRunId));
  if (filters.groupId) params.set("group_id", String(filters.groupId));
  if (filters.suiteId) params.set("suite_id", String(filters.suiteId));
  if (filters.includeDescendants !== undefined) params.set("include_descendants", String(filters.includeDescendants));
  if (filters.directOnly) params.set("direct_only", "true");
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.status) params.set("status", filters.status);
  filters.tagIds?.forEach(id => params.append("tag_id", String(id)));
  params.set("offset", String(filters.offset ?? 0)); params.set("limit", String(filters.limit ?? 50));
  return request<CasePage>(`/repository/cases?${params}`);
}
