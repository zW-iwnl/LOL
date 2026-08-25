import type { TestCase, TestSuite } from "../../api/client";
import {
  buildSuiteIndex,
  getVisibleSuiteRows,
  type SuiteIndex,
  type SuiteSelection,
} from "../test-suites/suiteTree";

export type RepositoryWorkspaceModel = {
  suiteIndex: SuiteIndex;
  directCasesBySuiteId: Map<number | null, TestCase[]>;
  directCaseCountBySuiteId: Map<number | null, number>;
  totalVisibleCaseCount: number;
};

export type RepositorySection = {
  selection: SuiteSelection;
  suite: TestSuite | null;
  depth: number;
  hasChildren: boolean;
  testCases: TestCase[];
};

export type RepositoryCaseSort = "code" | "title" | "status" | "updated_at";
export type RepositorySortDirection = "asc" | "desc";

export function buildRepositoryWorkspaceModel(
  suites: TestSuite[],
  testCases: TestCase[],
): RepositoryWorkspaceModel {
  const directCasesBySuiteId = new Map<number | null, TestCase[]>();

  for (const testCase of testCases) {
    const group = directCasesBySuiteId.get(testCase.suite_id) ?? [];
    group.push(testCase);
    directCasesBySuiteId.set(testCase.suite_id, group);
  }

  for (const group of directCasesBySuiteId.values()) {
    group.sort(compareTestCases);
  }

  return {
    suiteIndex: buildSuiteIndex(suites),
    directCasesBySuiteId,
    directCaseCountBySuiteId: new Map(
      [...directCasesBySuiteId.entries()].map(([suiteId, cases]) => [suiteId, cases.length]),
    ),
    totalVisibleCaseCount: testCases.length,
  };
}

export function getDirectCases(
  model: RepositoryWorkspaceModel,
  selection: SuiteSelection,
): TestCase[] {
  return model.directCasesBySuiteId.get(selection === "root" ? null : selection) ?? [];
}

export function getRepositorySections(
  model: RepositoryWorkspaceModel,
  collapsedIds: ReadonlySet<number>,
  query = "",
): RepositorySection[] {
  const rows = getVisibleSuiteRows(model.suiteIndex, collapsedIds, query, true);
  return [
    {
      selection: "root",
      suite: null,
      depth: 0,
      hasChildren: model.suiteIndex.roots.length > 0,
      testCases: getDirectCases(model, "root"),
    },
    ...rows.map(({ suite, depth, hasChildren }) => ({
      selection: suite.id,
      suite,
      depth: depth + 1,
      hasChildren,
      testCases: getDirectCases(model, suite.id),
    })),
  ];
}

export function sortRepositoryTestCases(
  testCases: TestCase[],
  sortBy: RepositoryCaseSort,
  direction: RepositorySortDirection,
): TestCase[] {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  const statusOrder: Record<TestCase["status"], number> = { draft: 0, ready: 1, deprecated: 2 };
  return [...testCases].sort((left, right) => {
    let compared = 0;
    if (sortBy === "code") compared = compareTestCases(left, right);
    else if (sortBy === "title") compared = left.title.localeCompare(right.title, "cs", { sensitivity: "base", numeric: true });
    else if (sortBy === "status") compared = statusOrder[left.status] - statusOrder[right.status];
    else compared = left.updated_at.localeCompare(right.updated_at);
    return directionMultiplier * (compared || left.code.localeCompare(right.code, "cs", { numeric: true, sensitivity: "base" }) || left.id - right.id);
  });
}

function compareTestCases(left: TestCase, right: TestCase): number {
  return left.code.localeCompare(right.code, "cs", { numeric: true, sensitivity: "base" })
    || left.title.localeCompare(right.title, "cs", { sensitivity: "base" })
    || left.id - right.id;
}
