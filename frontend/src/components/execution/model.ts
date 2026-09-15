import type { TestRunCaseResult, TestStepType } from "../../api/client";
import type { ExecutionNavigation, ExecutionNavigationGroup, TestRunExecutionCase } from "../../api/testRuns";
import { normalizeSearch } from "../test-runs/selection";

export const resultLabels: Record<TestRunCaseResult, string> = {
  not_run: "Neprovedené", passed: "Úspěšné", failed: "Neúspěšné", blocked: "Blokované", skipped: "Přeskočené",
};
export const resultSymbols: Record<TestRunCaseResult, string> = {
  not_run: "○", passed: "✓", failed: "✕", blocked: "⊘", skipped: "–",
};
export { resultTextClasses as resultColors } from "../../data/resultStyles";
export const runStatusLabels = { open: "Otevřený", in_progress: "Probíhá", completed: "Dokončený", archived: "Archivovaný" };
export type SnapshotStep = {
  id: number; step_order: number; action: string; step_type?: TestStepType;
  note?: string | null; expected_result: string | null; test_data: string | null;
};
export type ExecutionSnapshot = {
  code: string; title: string; preconditions: string | null; expected_summary: string | null; steps: SnapshotStep[];
};
export function snapshotValue(value: unknown): ExecutionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<ExecutionSnapshot>;
  if (typeof snapshot.code !== "string" || typeof snapshot.title !== "string" || !Array.isArray(snapshot.steps)) return null;
  return { code: snapshot.code, title: snapshot.title, preconditions: snapshot.preconditions ?? null,
    expected_summary: snapshot.expected_summary ?? null, steps: snapshot.steps };
}
export function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
export type NavigationScope = { kind: "group" | "suite"; id: number; name: string; includeDescendants?: boolean } | null;
export type ExecutionFilters = { query: string; result: TestRunCaseResult | ""; tester: string; scope: NavigationScope };
export const emptyFilters: ExecutionFilters = { query: "", result: "", tester: "", scope: null };
export const emptyNavigation: ExecutionNavigation = { groups: [], suites: [] };

export function filterExecutionCases(cases: TestRunExecutionCase[], navigation: ExecutionNavigation, filters: ExecutionFilters) {
  const words = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  const names = new Map<number, string[]>();
  for (const node of [...navigation.groups, ...navigation.suites]) {
    for (const id of node.case_ids) names.set(id, [...(names.get(id) ?? []), node.name]);
  }
  const scope = filters.scope;
  const group = scope?.kind === "group" ? navigation.groups.find(item => item.id === scope.id) : null;
  const scopeIds = scope ? new Set(scope.kind === "suite"
    ? navigation.suites.find(item => item.id === scope.id)?.case_ids ?? []
    : (scope.includeDescendants === false ? group?.own_case_ids : group?.case_ids) ?? []) : null;
  return cases.filter(item => {
    if (scopeIds && !scopeIds.has(item.test_case_id)) return false;
    if (filters.result && item.result !== filters.result) return false;
    if (filters.tester && (filters.tester === "unassigned" ? item.assigned_to !== null : String(item.assigned_to) !== filters.tester)) return false;
    const text = normalizeSearch([item.code, item.title, item.suite_name ?? "", ...(names.get(item.test_case_id) ?? [])].join(" "));
    return words.every(word => text.includes(word));
  });
}

// A group reached through a stopped edge must also be available independently
// when it has further descendants. Each placement still respects its edge scope.
export function navigationRoots(groups: ExecutionNavigationGroup[]) {
  const byId = new Map(groups.map(group => [group.id, group]));
  const children = new Set(groups.flatMap(group => group.children.map(child => child.group_id)));
  const represented = new Set<number>();
  const expanded = new Set<number>();
  function visit(id: number, expand: boolean) {
    represented.add(id);
    if (!expand || expanded.has(id)) return;
    expanded.add(id);
    byId.get(id)?.children.forEach(child => visit(child.group_id, child.include_descendants));
  }
  const roots = groups.filter(group => !children.has(group.id));
  roots.forEach(group => visit(group.id, true));
  for (const group of groups) {
    if (!represented.has(group.id) || (group.children.length > 0 && !expanded.has(group.id))) {
      roots.push(group);
      visit(group.id, true);
    }
  }
  return roots;
}

export function nextPendingCase(cases: TestRunExecutionCase[], currentId?: number) {
  const currentIndex = cases.findIndex(item => item.id === currentId);
  const ordered = [...cases.slice(currentIndex + 1), ...cases.slice(0, Math.max(0, currentIndex))];
  return ordered.find(item => item.id !== currentId && item.result === "not_run") ?? null;
}
