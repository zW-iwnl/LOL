import { useMemo, useState } from "react";
import type { RunSelection, SelectionCatalog, SelectionGroup, SelectionSuite } from "../../api/testRuns";
import { matchesSelectionSearch, selectedCaseIds, toggleId } from "./selection";

type Props = { catalog: SelectionCatalog; selection: RunSelection; onChange: (value: RunSelection) => void };

export function RunRepositoryPicker({ catalog, selection, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"groups" | "suites" | "cases">("groups");
  const cases = useMemo(() => new Map(catalog.cases.map((item) => [item.id, item])), [catalog]);
  const selectedIds = selectedCaseIds(catalog, selection);
  const getCases = (ids: number[]) => ids.flatMap((id) => cases.get(id) ? [cases.get(id)!] : []);
  const matches = (item: SelectionSuite) => matchesSelectionSearch(item.name, getCases(item.case_ids), query);
  const count = (ids: number[]) => getCases(ids).filter((item) => !item.exclusion_reason).length;
  function toggleGroup(groupId: number) {
    const entry = selection.groups.find((item) => item.group_id === groupId);
    onChange({ ...selection, groups: entry ? selection.groups.filter((item) => item.group_id !== groupId)
      : [...selection.groups, { group_id: groupId, include_descendants: true }] });
  }
  function caseList(ids: number[]) {
    return <ul className="my-2 max-h-40 overflow-auto pl-4 text-xs text-slate-600">
      {getCases(ids).map((item) => <li key={item.id} className="py-1">{item.code} — {item.title}
        {item.exclusion_reason && <span className="ml-2 text-amber-800">({item.exclusion_reason})</span>}
      </li>)}
      {!ids.length && <li>Žádné testy.</li>}
    </ul>;
  }
  function suiteRow(suite: SelectionSuite) {
    return <div key={suite.id} className="border-b border-slate-100 p-3 last:border-0">
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={selection.suite_ids.includes(suite.id)}
          onChange={() => onChange({ ...selection, suite_ids: toggleId(selection.suite_ids, suite.id) })} />
        <span className="flex-1 font-medium">{suite.name}</span><span>Dostupné testy: {count(suite.case_ids)}</span>
      </label>
      <details className="ml-6 mt-2 text-xs"><summary className="cursor-pointer">Testy suity {suite.name}</summary>{caseList(suite.case_ids)}</details>
    </div>;
  }
  // Nested placements are navigation only: selecting a named group always has
  // the explicit scope displayed next to its checkbox, independently of its path.
  function groupRow(group: SelectionGroup, path: number[] = [], expand = true): React.ReactNode {
    if (path.includes(group.id)) return null;
    const entry = selection.groups.find((item) => item.group_id === group.id);
    const ids = entry?.include_descendants === false ? group.own_case_ids : group.case_ids;
    return <div key={group.id} className="border-b border-slate-100 p-3 last:border-0">
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={!!entry} onChange={() => toggleGroup(group.id)} />
        <span className="flex-1 font-medium">{group.name}</span><span>Dostupné testy: {count(ids)}</span>
      </label>
      {entry && <label className="ml-6 mt-2 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={entry.include_descendants} onChange={(event) => onChange({ ...selection,
          groups: selection.groups.map((item) => item.group_id === group.id ? { ...item, include_descendants: event.target.checked } : item),
        })} />Včetně potomků skupiny {group.name} podle vazeb repository
      </label>}
      <details className="ml-6 mt-2 text-xs">
        <summary className="cursor-pointer">Obsah skupiny {group.name}</summary>
        {catalog.suites.filter((suite) => group.suite_ids.includes(suite.id)).map(suiteRow)}
        <details className="py-2"><summary className="cursor-pointer">Vlastní testy skupiny</summary>{caseList(group.own_case_ids)}</details>
        {expand && group.children.map((child) => {
          const next = catalog.groups.find((item) => item.id === child.group_id);
          return next ? groupRow(next, [...path, group.id], child.include_descendants) : null;
        })}
        {!expand && <p className="py-2 text-slate-500">Toto umístění nepokračuje do dalších potomků. Samostatný výběr skupiny má rozsah uvedený u checkboxu.</p>}
      </details>
    </div>;
  }
  const groups = catalog.groups.filter(matches);
  const suites = catalog.suites.filter(matches);
  const filteredCases = catalog.cases.filter((item) => matchesSelectionSearch(`${item.code} ${item.title}`, [item], query));
  const empty = tab === "groups" ? !groups.length : tab === "suites" ? !suites.length : !filteredCases.length;
  return <section className="space-y-3" aria-label="Výběr testů">
    <h3 className="font-semibold">Výběr testů</h3>
    <input type="search" aria-label="Hledat skupiny, suity nebo testy" placeholder="Hledat podle názvu nebo tagu…"
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} />
    <p className="text-xs text-slate-500">Tag hledá v obsahu. Zaškrtnutí skupiny nebo suity zahrne celý její schválený obsah. Výběr zůstává zachovaný při filtrování.</p>
    <div className="flex gap-2" role="tablist" aria-label="Typ výběru">
      {([["groups", "Skupiny"], ["suites", "Test suity"], ["cases", "Jednotlivé testy"]] as const).map(([value, label]) =>
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
          className={`rounded-md px-3 py-2 text-sm ${tab === value ? "bg-cyan-700 text-white" : "bg-slate-100"}`}>{label}</button>)}
    </div>
    <div className="max-h-96 overflow-auto rounded-md border border-slate-200" role="tabpanel" aria-label={tab === "groups" ? "Skupiny" : tab === "suites" ? "Test suity" : "Jednotlivé testy"}>
      {tab === "groups" && groups.map((group) => groupRow(group))}
      {tab === "suites" && suites.map(suiteRow)}
      {tab === "cases" && filteredCases.map((item) => <label key={item.id} className="flex items-start gap-3 border-b border-slate-100 p-3 text-sm">
        <input type="checkbox" disabled={!!item.exclusion_reason} checked={selection.test_case_ids.includes(item.id)}
          onChange={() => onChange({ ...selection, test_case_ids: toggleId(selection.test_case_ids, item.id) })} />
        <span>{item.code} — {item.title}<span className="block text-xs text-slate-500">{item.tags.join(" · ")}</span>
          {item.exclusion_reason ? <span className="text-xs text-amber-800">{item.exclusion_reason}</span>
            : selectedIds.has(item.id) && !selection.test_case_ids.includes(item.id) && <span className="text-xs text-cyan-800">Zahrnuto přes skupinu nebo suitu</span>}
        </span>
      </label>)}
      {empty && <p className="p-4 text-sm text-slate-500">Žádná položka neodpovídá hledání.</p>}
    </div>
  </section>;
}
