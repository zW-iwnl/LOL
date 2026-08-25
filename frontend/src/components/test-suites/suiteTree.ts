import type { TestSuite } from "../../api/client";

export type SuiteSelection = number | "root";

export const REPOSITORY_ROOT_LABEL = "Počátek vesmíru";

export type SuiteIndex = {
  byId: Map<number, TestSuite>;
  childrenByParentId: Map<number | null, TestSuite[]>;
  roots: TestSuite[];
};

export type SuiteTreeRow = {
  suite: TestSuite;
  depth: number;
  hasChildren: boolean;
};

export type SuiteHierarchyIssues = {
  orphanIds: number[];
  cycleIds: number[];
};

const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });

export function compareSuites(left: TestSuite, right: TestSuite): number {
  return left.sort_order - right.sort_order || collator.compare(left.name, right.name) || left.id - right.id;
}

export function buildSuiteIndex(suites: TestSuite[]): SuiteIndex {
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  const childrenByParentId = new Map<number | null, TestSuite[]>();

  for (const suite of suites) {
    const parentId = suite.parent_suite_id !== null && byId.has(suite.parent_suite_id)
      ? suite.parent_suite_id
      : null;
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(suite);
    childrenByParentId.set(parentId, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort(compareSuites);
  }

  const roots = [...(childrenByParentId.get(null) ?? [])];
  const reachable = new Set<number>();

  function markReachable(suite: TestSuite, branch: Set<number>) {
    if (reachable.has(suite.id) || branch.has(suite.id)) return;
    reachable.add(suite.id);
    const nextBranch = new Set(branch).add(suite.id);
    for (const child of childrenByParentId.get(suite.id) ?? []) {
      markReachable(child, nextBranch);
    }
  }

  for (const root of roots) markReachable(root, new Set());

  for (const suite of [...suites].sort(compareSuites)) {
    if (!reachable.has(suite.id)) {
      roots.push(suite);
      markReachable(suite, new Set());
    }
  }

  return { byId, childrenByParentId, roots };
}

export function validateSuiteHierarchy(suites: TestSuite[]): SuiteHierarchyIssues {
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  const orphanIds = suites
    .filter((suite) => suite.parent_suite_id !== null && !byId.has(suite.parent_suite_id))
    .map((suite) => suite.id)
    .sort((left, right) => left - right);
  const cycleIds = new Set<number>();

  for (const suite of suites) {
    const path = new Map<number, number>();
    let current: TestSuite | undefined = suite;
    let position = 0;

    while (current) {
      const repeatedAt = path.get(current.id);
      if (repeatedAt !== undefined) {
        for (const [id, index] of path) {
          if (index >= repeatedAt) cycleIds.add(id);
        }
        break;
      }
      path.set(current.id, position);
      position += 1;
      current = current.parent_suite_id === null ? undefined : byId.get(current.parent_suite_id);
    }
  }

  return { orphanIds, cycleIds: [...cycleIds].sort((left, right) => left - right) };
}

export function getSuiteTrail(index: SuiteIndex, suiteId: number): TestSuite[] {
  const trail: TestSuite[] = [];
  const visited = new Set<number>();
  let current = index.byId.get(suiteId);

  while (current && !visited.has(current.id)) {
    trail.unshift(current);
    visited.add(current.id);
    current = current.parent_suite_id === null ? undefined : index.byId.get(current.parent_suite_id);
  }

  return trail;
}

export function getSuiteDescendantIds(index: SuiteIndex, suiteId: number): Set<number> {
  const descendants = new Set<number>();
  const pending = [...(index.childrenByParentId.get(suiteId) ?? [])];

  while (pending.length > 0) {
    const suite = pending.pop();
    if (!suite || descendants.has(suite.id)) continue;
    descendants.add(suite.id);
    pending.push(...(index.childrenByParentId.get(suite.id) ?? []));
  }

  return descendants;
}

export function matchingSuiteIds(suites: TestSuite[], query: string): Set<number> {
  const needle = query.trim().toLocaleLowerCase("cs");
  if (needle.length < 2) return new Set();
  return new Set(
    suites
      .filter((suite) => (suite.name + " " + suite.path).toLocaleLowerCase("cs").includes(needle))
      .map((suite) => suite.id),
  );
}

export function getVisibleSuiteRows(
  index: SuiteIndex,
  collapsedIds: ReadonlySet<number>,
  query = "",
  respectCollapsedDuringSearch = false,
): SuiteTreeRow[] {
  const matches = matchingSuiteIds([...index.byId.values()], query);
  const allowedIds = new Set<number>();

  if (matches.size > 0) {
    for (const suiteId of matches) {
      for (const suite of getSuiteTrail(index, suiteId)) allowedIds.add(suite.id);
    }
  }

  const rows: SuiteTreeRow[] = [];
  const visited = new Set<number>();

  function visit(suite: TestSuite, depth: number) {
    if (visited.has(suite.id)) return;
    visited.add(suite.id);
    if (matches.size > 0 && !allowedIds.has(suite.id)) return;
    const children = index.childrenByParentId.get(suite.id) ?? [];
    rows.push({ suite, depth, hasChildren: children.length > 0 });
    if ((matches.size === 0 || respectCollapsedDuringSearch) && collapsedIds.has(suite.id)) return;
    for (const child of children) visit(child, depth + 1);
  }

  for (const root of index.roots) visit(root, 0);
  return rows;
}

export function getFolderSuites(index: SuiteIndex, selection: SuiteSelection, query = ""): TestSuite[] {
  const matches = matchingSuiteIds([...index.byId.values()], query);
  if (matches.size > 0) {
    return [...matches]
      .map((id) => index.byId.get(id))
      .filter((suite): suite is TestSuite => Boolean(suite))
      .sort(compareSuites);
  }
  return index.childrenByParentId.get(selection === "root" ? null : selection) ?? [];
}

export function totalRootTestCaseCount(index: SuiteIndex): number {
  return index.roots.reduce((total, suite) => total + suite.total_test_case_count, 0);
}
