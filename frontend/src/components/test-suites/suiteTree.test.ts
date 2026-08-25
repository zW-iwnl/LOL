import { describe, expect, it } from "vitest";
import type { TestSuite } from "../../api/client";
import {
  buildSuiteIndex,
  getFolderSuites,
  getSuiteDescendantIds,
  getSuiteTrail,
  getVisibleSuiteRows,
  validateSuiteHierarchy,
} from "./suiteTree";

function suite(id: number, name: string, parentSuiteId: number | null, sortOrder = 0): TestSuite {
  return {
    id,
    parent_suite_id: parentSuiteId,
    name,
    description: null,
    path: "/" + name,
    level: parentSuiteId === null ? 0 : 1,
    sort_order: sortOrder,
    is_active: true,
    created_by: 1,
    created_at: "2026-08-21T00:00:00Z",
    updated_at: "2026-08-21T00:00:00Z",
    direct_test_case_count: 0,
    total_test_case_count: 0,
  group_ids: [],
  };
}

describe("suiteTree", () => {
  const suites = [
    suite(4, "B child", 2, 2),
    suite(2, "Root B", null, 2),
    suite(3, "A child", 1, 1),
    suite(1, "Root A", null, 1),
    suite(5, "A grandchild", 3, 1),
  ];

  it("builds and sorts a stable hierarchy from an unordered list", () => {
    const index = buildSuiteIndex(suites);
    expect(index.roots.map((item) => item.id)).toEqual([1, 2]);
    expect(index.childrenByParentId.get(1)?.map((item) => item.id)).toEqual([3]);
  });

  it("returns trails and descendants", () => {
    const index = buildSuiteIndex(suites);
    expect(getSuiteTrail(index, 5).map((item) => item.id)).toEqual([1, 3, 5]);
    expect([...getSuiteDescendantIds(index, 1)].sort()).toEqual([3, 5]);
  });

  it("honours collapsed branches and reveals ancestors during search", () => {
    const index = buildSuiteIndex(suites);
    expect(getVisibleSuiteRows(index, new Set([1])).map((row) => row.suite.id)).toEqual([1, 2, 4]);
    expect(getVisibleSuiteRows(index, new Set([1]), "grandchild").map((row) => row.suite.id)).toEqual([1, 3, 5]);
    expect(getVisibleSuiteRows(index, new Set([1]), "grandchild", true).map((row) => row.suite.id)).toEqual([1]);
  });

  it("returns direct folder children or global search matches", () => {
    const index = buildSuiteIndex(suites);
    expect(getFolderSuites(index, 1).map((item) => item.id)).toEqual([3]);
    expect(getFolderSuites(index, "root", "child").map((item) => item.id)).toEqual([5, 3, 4]);
  });

  it("reports orphan and cyclic parent relations", () => {
    const invalid = [
      suite(1, "Orphan", 999),
      suite(2, "Cycle A", 3),
      suite(3, "Cycle B", 2),
    ];
    expect(validateSuiteHierarchy(invalid)).toEqual({ orphanIds: [1], cycleIds: [2, 3] });
    expect(buildSuiteIndex(invalid).roots.map((item) => item.id)).toEqual([1, 2]);
  });
});
