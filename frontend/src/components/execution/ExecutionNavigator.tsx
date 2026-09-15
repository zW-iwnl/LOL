import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "../../api/client";
import type { ExecutionNavigation, ExecutionNavigationGroup, SelectionSuite, TestRunExecutionCase } from "../../api/testRuns";
import { navigationRoots, resultColors, resultLabels, resultSymbols, type ExecutionFilters } from "./model";

type Props = {
  cases: TestRunExecutionCase[]; filteredCases: TestRunExecutionCase[]; navigation: ExecutionNavigation;
  users: User[]; selectedId?: number; filters: ExecutionFilters; busy: boolean;
  onFilters: (filters: ExecutionFilters) => void; onSelect: (id: number) => void; onNext: () => void; hasNext: boolean;
};
export function ExecutionNavigator(props: Props) {
  const { cases, filteredCases, navigation, users, selectedId, filters, busy, onFilters, onSelect } = props;
  const [tab, setTab] = useState<"groups" | "suites" | "cases">("groups");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const byCase = useMemo(() => new Map(cases.map(item => [item.test_case_id, item])), [cases]);
  const visible = useMemo(() => new Set(filteredCases.map(item => item.test_case_id)), [filteredCases]);
  const groups = useMemo(() => new Map(navigation.groups.map(item => [item.id, item])), [navigation]);
  const suites = useMemo(() => new Map(navigation.suites.map(item => [item.id, item])), [navigation]);
  const roots = useMemo(() => navigationRoots(navigation.groups), [navigation.groups]);
  useEffect(() => {
    const selected = cases.find(item => item.id === selectedId);
    if (!selected) return;
    const keys: string[] = [];
    function expandSelected(group: ExecutionNavigationGroup, path: number[] = [], expandChildren = true) {
      if (path.includes(group.id) || !(expandChildren ? group.case_ids : group.own_case_ids).includes(selected!.test_case_id)) return;
      const nextPath = [...path, group.id];
      const key = `g${nextPath.join("/")}`;
      keys.push(key);
      group.suite_ids.forEach(id => { if (suites.get(id)?.case_ids.includes(selected!.test_case_id)) keys.push(`${key}/s${id}`); });
      if (expandChildren) group.children.forEach(child => {
        const next = groups.get(child.group_id);
        if (next) expandSelected(next, nextPath, child.include_descendants);
      });
    }
    roots.forEach(group => expandSelected(group));
    navigation.suites.forEach(suite => { if (suite.case_ids.includes(selected.test_case_id)) keys.push(`suites/s${suite.id}`); });
    setExpanded(current => new Set([...current, ...keys]));
    // Only reveal the selection when it changes; keep manual collapse state on refresh.
  }, [selectedId]);
  const searching = Boolean(filters.query.trim());
  function caseRow(id: number, key = String(id)) {
    const item = byCase.get(id);
    if (!item || !visible.has(id)) return null;
    return <li key={key}><button type="button" disabled={busy} onClick={() => onSelect(item.id)}
      aria-current={selectedId === item.id ? "true" : undefined}
      title={`${item.code} — ${item.title}\n${resultLabels[item.result]} · ${users.find(user => user.id === item.assigned_to)?.name ?? "Nepřiřazeno"}`}
      className={`execution-case-row ${selectedId === item.id ? "is-selected" : ""}`}>
      <span className={`shrink-0 font-bold ${resultColors[item.result]}`} aria-label={resultLabels[item.result]}>{resultSymbols[item.result]}</span>
      <span className="min-w-0"><span className="mr-1.5 font-semibold text-text">{item.code}</span><span>{item.title}</span></span>
    </button></li>;
  }
  function branch(key: string, name: string, ids: number[], active: boolean, select: () => void, children: () => ReactNode) {
    const matched = ids.filter(id => visible.has(id));
    if (!matched.length) return null;
    const open = searching || expanded.has(key);
    const done = ids.filter(id => byCase.get(id)?.result !== "not_run" && byCase.has(id)).length;
    return <li key={key} className="min-w-0">
      <div className={`flex items-center rounded ${active ? "bg-selected-bg" : "hover:bg-surface-muted"}`}>
        <button type="button" aria-label={`${open ? "Sbalit" : "Rozbalit"} ${name}`} aria-expanded={open}
          className="grid h-8 w-7 shrink-0 place-items-center" disabled={searching}
          onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-xs" onClick={select} aria-pressed={active} title={name}>
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          <span className="shrink-0 text-muted" title={`${done} dokončeno z ${ids.length}; ${matched.length} odpovídá filtru`}>{done}/{ids.length}</span>
        </button>
      </div>
      {open && <ul className="ml-3 border-l border-border pl-1">{children()}</ul>}
    </li>;
  }
  function suiteRow(suite: SelectionSuite, path: string) {
    return branch(`${path}/s${suite.id}`, suite.name, suite.case_ids,
      filters.scope?.kind === "suite" && filters.scope.id === suite.id,
      () => { onFilters({ ...filters, scope: { kind: "suite", id: suite.id, name: suite.name } }); setExpanded(current => new Set([...current, `${path}/s${suite.id}`])); },
      () => suite.case_ids.map(id => caseRow(id)));
  }
  function groupRow(group: ExecutionNavigationGroup, path: number[] = [], expandChildren = true): ReactNode {
    if (path.includes(group.id)) return null;
    const nextPath = [...path, group.id];
    const key = `g${nextPath.join("/")}`;
    const ids = expandChildren ? group.case_ids : group.own_case_ids;
    return branch(key, group.name, ids,
      filters.scope?.kind === "group" && filters.scope.id === group.id && filters.scope.includeDescendants === expandChildren,
      () => { onFilters({ ...filters, scope: { kind: "group", id: group.id, name: group.name, includeDescendants: expandChildren } }); setExpanded(current => new Set([...current, key])); },
      () => <>
        {group.suite_ids.map(id => suites.get(id)).filter((item): item is SelectionSuite => Boolean(item)).map(suite => suiteRow(suite, key))}
        {group.direct_case_ids.map(id => caseRow(id))}
        {expandChildren && group.children.map(child => {
          const item = groups.get(child.group_id);
          return item ? groupRow(item, nextPath, child.include_descendants) : null;
        })}
        {!expandChildren && <li className="p-1 text-xs text-muted">Bez dalších potomků v tomto umístění.</li>}
      </>);
  }
  const grouped = new Set(navigation.groups.flatMap(group => group.case_ids));
  const inSuite = new Set(navigation.suites.flatMap(suite => suite.case_ids));
  const ungrouped = filteredCases.filter(item => !grouped.has(item.test_case_id));
  const unknownSuite = filteredCases.filter(item => !inSuite.has(item.test_case_id));
  return <aside className="execution-navigator" aria-label="Testy v provedení">
    <div className="space-y-2 border-b border-border p-3">
      <div className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-subtle" />
        <input type="search" aria-label="Hledat skupinu, suitu nebo test v běhu" placeholder="Skupina, suita, kód nebo název…"
          className="w-full rounded border border-control py-2 pl-8 pr-2 text-xs" value={filters.query} onChange={event => onFilters({ ...filters, query: event.target.value })} />
      </div>
      <div className="flex gap-1" aria-label="Zobrazení testů">
        {([["groups", "Skupiny"], ["suites", "Suity"], ["cases", "Testy"]] as const).map(([value, label]) =>
          <button type="button" key={value} aria-pressed={tab === value} className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${tab === value ? "bg-accent text-on-accent" : "bg-surface-muted"}`} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <select aria-label="Filtrovat podle výsledku" value={filters.result} className="min-w-0 rounded border border-control p-1.5 text-xs" onChange={event => onFilters({ ...filters, result: event.target.value as ExecutionFilters["result"] })}>
          <option value="">Všechny výsledky</option>{Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filtrovat podle testera" value={filters.tester} className="min-w-0 rounded border border-control p-1.5 text-xs" onChange={event => onFilters({ ...filters, tester: event.target.value })}>
          <option value="">Všichni testeři</option><option value="unassigned">Nepřiřazeno</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </div>
      {filters.scope && <button type="button" className="flex w-full items-center justify-between gap-2 rounded bg-selected-bg p-1.5 text-left text-xs text-link" onClick={() => onFilters({ ...filters, scope: null })} title="Zrušit omezení na skupinu nebo suitu">
        <span className="truncate">{filters.scope.name}{filters.scope.includeDescendants === false ? " · bez potomků" : ""}</span><X size={14} className="shrink-0" />
      </button>}
      <p className="text-[11px] text-muted">Aktuální struktura repository</p>
    </div>
    <div className="execution-navigation-scroll p-2">
      <ul>
        {tab === "groups" && <>{roots.map(group => groupRow(group))}{ungrouped.length > 0 && <li><div className="px-2 py-2 text-xs font-semibold text-muted">Bez skupiny</div><ul>{ungrouped.map(item => caseRow(item.test_case_id))}</ul></li>}</>}
        {tab === "suites" && <>{navigation.suites.map(suite => suiteRow(suite, "suites"))}{unknownSuite.length > 0 && <li><div className="px-2 py-2 text-xs text-muted">Zařazení není dostupné</div><ul>{unknownSuite.map(item => caseRow(item.test_case_id))}</ul></li>}</>}
        {tab === "cases" && filteredCases.map(item => caseRow(item.test_case_id))}
      </ul>
      {!filteredCases.length && <p className="p-3 text-sm text-muted">Filtru neodpovídá žádný test.</p>}
    </div>
    <div className="space-y-2 border-t border-border p-2 text-xs">
      <p role="status" className="text-muted">Zobrazeno {filteredCases.length} z {cases.length} testů</p>
      <button type="button" className="workspace-button w-full" disabled={!props.hasNext || busy} onClick={props.onNext}>Další neprovedený ve filtru</button>
    </div>
  </aside>;
}
