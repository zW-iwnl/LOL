import { describe, expect, it } from "vitest";
import type { SelectionCatalog } from "../../api/testRuns";
import { matchesSelectionSearch, selectedCaseIds } from "./selection";

const catalog: SelectionCatalog = {
  groups: [
    { id: 1, name: "Regrese", case_ids: [1, 2, 3], own_case_ids: [1], suite_ids: [1], children: [] },
    { id: 2, name: "Smoke", case_ids: [2, 3], own_case_ids: [2, 3], suite_ids: [2], children: [] },
  ],
  suites: [{ id: 1, name: "Přihlášení", case_ids: [1] }, { id: 2, name: "Platby", case_ids: [2, 3] }],
  cases: [{ id: 1, code: "TC-1", title: "Přihlášení", suite_id: 1, version_id: 1, tags: ["Účty"], exclusion_reason: null }],
};

describe("run repository selection", () => {
  it("deduplicates overlapping sources and preserves coverage after one is removed", () => {
    const selection = { groups: [{ group_id: 1, include_descendants: true }, { group_id: 2, include_descendants: true }], suite_ids: [1], test_case_ids: [3] };
    expect([...selectedCaseIds(catalog, selection)].sort()).toEqual([1, 2, 3]);
    expect([...selectedCaseIds(catalog, { ...selection, groups: selection.groups.slice(1) })].sort()).toEqual([1, 2, 3]);
  });
  it("honors the explicit group scope", () => {
    expect([...selectedCaseIds(catalog, { groups: [{ group_id: 1, include_descendants: false }], suite_ids: [], test_case_ids: [] })]).toEqual([1]);
  });
  it("combines name and tag terms without accents or case sensitivity", () => {
    expect(matchesSelectionSearch("Přihlášení", catalog.cases, "PRIHLASENI ucty")).toBe(true);
    expect(matchesSelectionSearch("Přihlášení", catalog.cases, "platby")).toBe(false);
  });
});
