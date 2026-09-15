import { useMemo } from "react";
import type { TestCaseTag, TestSuite } from "../../api/client";
import type { RepositoryGroup } from "../../api/repositoryWorkspace";
import { ExecutionMenu } from "../execution/ExecutionMenu";
import { normalizeSearch } from "../test-runs/selection";
import { VirtualList } from "./VirtualList";
import { RepositoryCaseTable, type CaseActions } from "./RepositoryCaseTable";
import { useRepositoryPreference } from "./useRepositoryPreference";

export function RepositorySuitesView({ suites, groups, tags, selectedSuiteId, onSelect, onCreateSuite, onEditSuite, onDeleteSuite, refreshKey, ...caseActions }: {
  suites: TestSuite[]; groups: RepositoryGroup[]; tags: TestCaseTag[]; selectedSuiteId: number | null;
  onSelect: (id: number) => void; onCreateSuite: () => void; onEditSuite: (suite: TestSuite) => void; onDeleteSuite: (suite: TestSuite) => void; refreshKey: number;
} & CaseActions) {
  const [query, setQuery] = useRepositoryPreference("suiteQuery", "");
  const [groupFilter, setGroupFilter] = useRepositoryPreference("suiteGroupFilter", "");
  const [open, setOpen] = useRepositoryPreference("suiteNavigatorOpen", true);
  const selected = suites.find(suite => suite.id === selectedSuiteId) ?? suites[0];
  const filtered = useMemo(() => suites.filter(suite => normalizeSearch(`${suite.id} ${suite.name}`).includes(normalizeSearch(query))
    && (!groupFilter || groupFilter === "none" && !suite.group_ids.length || suite.group_ids.includes(Number(groupFilter)))), [suites, query, groupFilter]);
  return <div className="repository-group-workspace">
    <div className="flex gap-2"><button className="workspace-button" type="button" onClick={() => setOpen(!open)}>{open ? "Skrýt suity" : "Zobrazit suity"}</button><button className="workspace-button" type="button" onClick={onCreateSuite}>+ Nová test suite</button></div>
    <div className={`repository-panels ${open ? "with-navigation" : ""}`}>
      {open && <aside className="repository-navigation" aria-label="Test suity"><div className="space-y-2 border-b border-slate-200 p-3"><h2 className="text-sm font-semibold">Ploché test suity</h2>
        <input type="search" aria-label="Hledat test suitu" className="workspace-input w-full" placeholder="Název nebo ID…" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Skupina suity" className="workspace-input w-full" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">Všechny skupiny</option><option value="none">Bez skupiny</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
      </div><VirtualList items={filtered} itemKey={suite => suite.id} label="Seznam suit" storageKey="repository-suite-scroll" render={suite => <button data-focus-target type="button" className={`repository-picker-row ${selected?.id === suite.id ? "bg-cyan-50 text-cyan-800" : ""}`} aria-current={selected?.id === suite.id ? "true" : undefined} title={suite.name} onClick={() => onSelect(suite.id)}><span className="min-w-0 flex-1 truncate">{suite.name}</span><span className="text-slate-500">{suite.test_case_count}</span></button>} /><p className="border-t p-2 text-xs text-slate-500">{filtered.length} z {suites.length} suit</p></aside>}
      <section className="repository-detail" aria-label="Detail suity">{selected ? <>
        <header className="space-y-2 border-b p-3"><div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">{selected.name}</h2><p className="text-xs text-slate-500">#{selected.id} · {selected.test_case_count} testů · {selected.is_active ? "Aktivní" : "Neaktivní"}</p></div><ExecutionMenu label="Akce suity"><button type="button" onClick={() => onEditSuite(selected)}>Upravit suitu</button><button type="button" onClick={() => onDeleteSuite(selected)}>Smazat prázdnou suitu</button></ExecutionMenu></div>
          <details className="text-xs"><summary className="cursor-pointer text-slate-600">Popis a skupiny ({selected.group_ids.length})</summary><p className="mt-1 whitespace-pre-wrap">{selected.description ?? "Bez popisu"}</p><p className="mt-1">{selected.group_ids.map(id => groups.find(group => group.id === id)?.name ?? `#${id}`).join(" · ") || "Bez skupiny"}</p></details>
          {!filtered.some(suite => suite.id === selected.id) && <p className="text-xs text-amber-800">Vybraná suita je mimo aktuální filtr.</p>}
        </header><div className="repository-detail-scroll p-3"><RepositoryCaseTable key={selected.id} scope={{ suiteId: selected.id }} suites={suites} tags={tags} refreshKey={refreshKey} {...caseActions} /></div>
      </> : <p className="p-4 text-sm text-slate-500">Vytvořte první test suitu.</p>}</section>
    </div>
  </div>;
}
