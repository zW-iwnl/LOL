import { describe, expect, it } from "vitest";
import type { ExecutionNavigation, TestRunExecutionCase } from "../../api/testRuns";
import { emptyFilters, filterExecutionCases, navigationRoots, nextPendingCase } from "./model";

const cases = [
  { id: 11, test_case_id: 1, code: "TC-1", title: "Přihlášení", result: "passed", assigned_to: 1 },
  { id: 12, test_case_id: 2, code: "TC-2", title: "Platba", result: "not_run", assigned_to: null },
  { id: 13, test_case_id: 3, code: "TC-3", title: "Odhlášení", result: "not_run", assigned_to: 1 },
] as TestRunExecutionCase[];
const navigation: ExecutionNavigation = {
  suites: [{ id: 10, name: "Přístupy", case_ids: [1, 3] }, { id: 20, name: "Platby", case_ids: [2] }],
  groups: [
    { id: 1, name: "Regrese", case_ids: [1], own_case_ids: [], direct_case_ids: [], suite_ids: [], children: [{ group_id: 2, include_descendants: false }] },
    { id: 2, name: "Účty", case_ids: [1, 2], own_case_ids: [1], direct_case_ids: [1], suite_ids: [], children: [{ group_id: 3, include_descendants: true }] },
    { id: 3, name: "Převody", case_ids: [2], own_case_ids: [2], direct_case_ids: [2], suite_ids: [], children: [] },
  ],
};

describe("execution navigation", () => {
  it("searches groups, suites and snapshot titles without accents, combining filters", () => {
    expect(filterExecutionCases(cases, navigation, { ...emptyFilters, query: "ucty" }).map(item => item.id)).toEqual([11, 12]);
    expect(filterExecutionCases(cases, navigation, { ...emptyFilters, query: "PRISTUPY", result: "not_run", tester: "1" }).map(item => item.id)).toEqual([13]);
    expect(filterExecutionCases(cases, navigation, { ...emptyFilters, query: "tc-2 platba", tester: "unassigned" }).map(item => item.id)).toEqual([12]);
  });
  it("respects stopped edges and returns overlapping cases only once", () => {
    expect(filterExecutionCases(cases, navigation, { ...emptyFilters, query: "regrese" }).map(item => item.id)).toEqual([11]);
    expect(filterExecutionCases(cases, navigation, { ...emptyFilters, scope: { kind: "group", id: 2, name: "Účty", includeDescendants: false } }).map(item => item.id)).toEqual([11]);
    expect(filterExecutionCases(cases, navigation, emptyFilters)).toHaveLength(3);
  });
  it("makes descendants accessible independently of a stopped placement", () => {
    expect(navigationRoots(navigation.groups).map(group => group.id)).toEqual([1, 2]);
  });
  it("advances in filtered order and wraps without selecting the current test", () => {
    expect(nextPendingCase(cases, 11)?.id).toBe(12);
    expect(nextPendingCase(cases, 13)?.id).toBe(12);
    expect(nextPendingCase([cases[1]], 12)).toBeNull();
    expect(nextPendingCase(cases, 999)?.id).toBe(12);
  });
});
