import type { RunSelection, SelectionCatalog, SelectionCase } from "../../api/testRuns";

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs").trim();
}

export function matchesSelectionSearch(name: string, cases: SelectionCase[], query: string) {
  const text = normalizeSearch([name, ...cases.flatMap((item) => item.tags)].join(" "));
  return normalizeSearch(query).split(/\s+/).every((word) => text.includes(word));
}

export function selectedCaseIds(catalog: SelectionCatalog, selection: RunSelection): Set<number> {
  const ids = new Set(selection.test_case_ids);
  for (const suite of catalog.suites) {
    if (selection.suite_ids.includes(suite.id)) suite.case_ids.forEach((id) => ids.add(id));
  }
  for (const entry of selection.groups) {
    const group = catalog.groups.find((item) => item.id === entry.group_id);
    (entry.include_descendants ? group?.case_ids : group?.own_case_ids)?.forEach((id) => ids.add(id));
  }
  return ids;
}

export function toggleId(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
