import { request, type TestCaseStatus, type TestCaseTagCategory } from "./client";

export type RepositorySearchTag = {
  id: number;
  category: TestCaseTagCategory;
  name: string;
};

export type RepositorySuiteTag = RepositorySearchTag & {
  test_case_count: number;
};

export type RepositoryTestCaseResult = {
  type: "test_case";
  id: number;
  label: string;
  code: string;
  title: string;
  suite_id: number;
  suite_name: string;
  status: TestCaseStatus;
  business_area: RepositorySearchTag | null;
  application_domain: RepositorySearchTag | null;
  object_type: RepositorySearchTag | null;
  tags: RepositorySearchTag[];
};

export type RepositoryTestSuiteResult = {
  type: "test_suite";
  id: number;
  label: string;
  group_ids: number[];
  test_case_count: number;
  is_active: boolean;
  tags: RepositorySuiteTag[];
};

export type RepositorySuiteGroupResult = {
  type: "suite_group";
  id: number;
  label: string;
  parent_ids: number[];
  child_ids: number[];
  test_case_count: number;
  tags: RepositorySuiteTag[];
};

export type RepositorySearchItem = RepositoryTestCaseResult | RepositoryTestSuiteResult | RepositorySuiteGroupResult;
export type RepositorySearchType = "all" | "suites" | "groups" | "cases";

export type RepositorySearchParams = {
  query?: string;
  type?: RepositorySearchType;
  limit?: number;
  businessAreaIds?: number[];
  applicationDomainIds?: number[];
  objectTypeIds?: number[];
};

export type RepositorySearchResponse = {
  query: string;
  items: RepositorySearchItem[];
};

export function searchRepository(params: RepositorySearchParams) {
  const searchParams = new URLSearchParams();
  const query = params.query?.trim();
  if (query) searchParams.set("q", query);
  if (params.type === "suites") searchParams.set("types", "test_suite");
  if (params.type === "cases") searchParams.set("types", "test_case");
  if (params.type === "groups") searchParams.set("types", "suite_group");
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  for (const id of params.businessAreaIds ?? []) searchParams.append("business_area_id", String(id));
  for (const id of params.applicationDomainIds ?? []) searchParams.append("application_domain_id", String(id));
  for (const id of params.objectTypeIds ?? []) searchParams.append("object_type_id", String(id));

  return request<RepositorySearchResponse>(`/repository/search?${searchParams.toString()}`);
}
