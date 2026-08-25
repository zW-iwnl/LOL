import { describe, expect, it } from "vitest";
import type { TestCase, TestSuite } from "../../api/client";
import {
  buildRepositoryWorkspaceModel,
  getDirectCases,
  getRepositorySections,
  sortRepositoryTestCases,
} from "./repositoryModel";

function suite(id: number, parentId: number | null, name: string): TestSuite {
  return {
    id,
    parent_suite_id: parentId,
    name,
    description: null,
    path: parentId ? `Parent/${name}` : name,
    level: parentId ? 1 : 0,
    sort_order: 0,
    is_active: true,
    created_by: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    direct_test_case_count: 0,
    total_test_case_count: 0,
  group_ids: [],
  };
}

function testCase(id: number, suiteId: number | null, code: string): TestCase {
  return {
    id,
    suite_id: suiteId,
    code,
    title: code,
    description: null,
    preconditions: null,
    expected_summary: null,
    business_area_id: null,
    application_domain_id: null,
    object_type_id: null,
    business_area: null,
    application_domain: null,
    object_type: null,
    tag_ids: [],
    tags: [],
    status: "draft",
    automated: false,
    version: 1,
    created_by: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    steps: [],
  };
}

describe("repositoryModel", () => {
  it("groups root and suite test cases and sorts them by code", () => {
    const model = buildRepositoryWorkspaceModel(
      [suite(1, null, "A")],
      [testCase(2, 1, "TC-10"), testCase(1, null, "TC-2"), testCase(3, 1, "TC-2")],
    );

    expect(getDirectCases(model, "root").map((item) => item.code)).toEqual(["TC-2"]);
    expect(getDirectCases(model, 1).map((item) => item.code)).toEqual(["TC-2", "TC-10"]);
    expect(model.directCaseCountBySuiteId.get(null)).toBe(1);
    expect(model.totalVisibleCaseCount).toBe(3);
  });

  it("sorts folder test cases by title, status and update time", () => {
    const first = testCase(1, 1, "TC-2"); Object.assign(first, { title: "Zebra", status: "draft", updated_at: "2026-01-01T00:00:00Z" });
    const second = testCase(2, 1, "TC-10"); Object.assign(second, { title: "Alfa", status: "ready", updated_at: "2026-01-03T00:00:00Z" });
    const third = testCase(3, 1, "TC-1"); Object.assign(third, { title: "Beta", status: "deprecated", updated_at: "2026-01-02T00:00:00Z" });
    const cases = [first, second, third];
    expect(sortRepositoryTestCases(cases, "title", "asc").map((item) => item.id)).toEqual([2, 3, 1]);
    expect(sortRepositoryTestCases(cases, "status", "asc").map((item) => item.id)).toEqual([1, 2, 3]);
    expect(sortRepositoryTestCases(cases, "updated_at", "desc").map((item) => item.id)).toEqual([2, 3, 1]);
    expect(cases.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("builds nested sections only for visible branches", () => {
    const model = buildRepositoryWorkspaceModel(
      [suite(1, null, "A"), suite(2, 1, "A1"), suite(3, null, "B")],
      [testCase(1, null, "ROOT-1"), testCase(2, 2, "A1-1")],
    );

    expect(getRepositorySections(model, new Set()).map((section) => section.selection)).toEqual(["root", 1, 2, 3]);
    expect(getRepositorySections(model, new Set([1])).map((section) => section.selection)).toEqual(["root", 1, 3]);
  });
});
