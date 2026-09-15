import { Link, useLocation } from "react-router-dom";
import { withReturn } from "../workspace/navigation";
import { useEffect, useState } from "react";
import { getRepositoryCases, type CaseFilters, type RepositoryCase } from "../../api/repositoryWorkspace";
import type { TestCaseTag, TestSuite } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { AccessibleDialog } from "../AccessibleDialog";
import { ExecutionMenu } from "../execution/ExecutionMenu";
import { useRepositoryPreference } from "./useRepositoryPreference";

export const caseStatusLabels = { draft: "Koncept", ready: "Připraveno", deprecated: "Vyřazeno" };
export type CaseActions = {
  onOpen: (id: number) => void;
  onCreate?: (suiteId: number | null) => void;
  onDelete?: (item: RepositoryCase) => void;
  onUnlink?: (item: RepositoryCase) => void;
  onMove?: (item: RepositoryCase, suiteId: number) => void;
  movingCaseId?: number | null;
};
type Props = CaseActions & { scope?: CaseFilters; suites: TestSuite[]; tags: TestCaseTag[]; refreshKey?: number; title?: string; compact?: boolean };
export function RepositoryCaseTable({ scope = {}, suites, tags, refreshKey = 0, title = "Test cases", compact = false, ...actions }: Props) {
  const location = useLocation(); const returnTo = location.pathname + location.search;
  const scopeKey = `${scope.groupId ?? "all"}:${scope.suiteId ?? "all"}:${scope.includeDescendants ?? true}:${scope.directOnly ?? false}`;
  const [filters, setFilters] = useRepositoryPreference<CaseFilters>(`caseFilters:${scopeKey}`, { query: "", status: "", offset: 0, limit: 50, tagIds: [] });
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState(filters.query ?? "");
  const [moveTarget, setMoveTarget] = useState<RepositoryCase | null>(null);
  const [suiteTarget, setSuiteTarget] = useState("");
  const [suiteQuery, setSuiteQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => { if (query !== filters.query) setFilters({ ...filters, query, offset: 0 }); }, 250); return () => clearTimeout(timer); }, [query, filters]);
  const state = useApiResource(() => getRepositoryCases({ ...filters, ...scope }), [JSON.stringify(filters), JSON.stringify(scope), refreshKey, retryKey]);
  const data = state.data;
  useEffect(() => {
    if (data && !state.loading && (filters.offset ?? 0) > 0 && (filters.offset ?? 0) >= data.total) setFilters({ ...filters, offset: Math.max(0, Math.floor((data.total - 1) / (filters.limit ?? 50))) * (filters.limit ?? 50) });
  }, [data, state.loading]);
  function filter(patch: Partial<CaseFilters>) { setFilters({ ...filters, ...patch, offset: 0 }); }
  return <section aria-label={title} className="repository-case-table">
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {actions.onCreate && <button type="button" className="workspace-button" onClick={() => actions.onCreate?.(scope.suiteId ?? filters.suiteId ?? null)}>+ Nový test case</button>}
    </div>
    <div className="flex flex-wrap gap-2 pb-2">
      <input type="search" className="workspace-input min-w-40 flex-1" aria-label="Hledat v obsahu" placeholder="Kód, název, suita nebo tag…" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} />
      <select className="workspace-input" aria-label="Stav testu" value={filters.status ?? ""} onChange={event => filter({ status: event.target.value as CaseFilters["status"] })}>
        <option value="">Všechny stavy</option>{Object.entries(caseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {!compact && !scope.suiteId && <select aria-label="Filtrovat suitu" className="workspace-input max-w-56" value={filters.suiteId ?? ""} onChange={event => filter({ suiteId: Number(event.target.value) || undefined })}>
        <option value="">Všechny suity</option>{suites.map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}
      </select>}
      <details className="repository-filter-details"><summary className="workspace-button cursor-pointer">Tagy {(filters.tagIds?.length ?? 0) > 0 ? `(${filters.tagIds!.length})` : ""}</summary>
        <div className="repository-filter-popover">{tags.map(tag => <label key={tag.id} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={filters.tagIds?.includes(tag.id) ?? false}
          onChange={event => filter({ tagIds: event.target.checked ? [...(filters.tagIds ?? []), tag.id] : filters.tagIds?.filter(id => id !== tag.id) })} />{tag.name}</label>)}</div>
      </details>
    </div>
    {!!filters.tagIds?.length && <div className="mb-2 flex flex-wrap gap-1">{filters.tagIds.map(id => <button type="button" key={id} className="rounded bg-cyan-50 px-2 py-1 text-xs text-cyan-800" onClick={() => filter({ tagIds: filters.tagIds!.filter(value => value !== id) })}>{tags.find(tag => tag.id === id)?.name ?? `#${id}`} ×</button>)}</div>}
    {state.error && <p role="alert" className="p-3 text-sm text-rose-700">{state.error}<button className="ml-2 underline" onClick={() => setRetryKey(value => value + 1)}>Zkusit znovu</button></p>}
    {state.loading && <p role="status" className="py-1 text-xs text-slate-500">Načítám obsah…</p>}
    <table className="repository-table" aria-busy={state.loading}>
      <thead><tr><th>Test case</th><th>Suita</th><th>Stav</th>{scope.groupId && <th>Původ</th>}<th><span className="sr-only">Akce</span></th></tr></thead>
      <tbody>{data?.items.map(item => <tr key={item.id}>
        <td><button type="button" className="text-left hover:text-cyan-800" disabled={state.loading} onClick={() => actions.onOpen(item.id)}><strong className="mr-2 text-cyan-800">{item.code}</strong>{item.title}</button>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">{item.published_version ? <span>Publikováno v{item.published_version}</span> : <span>Dosud nepublikováno</span>}{item.review_id ? <Link className="text-cyan-800 underline" to={withReturn(`/test-case-approvals/${item.review_id}`, returnTo)}>v{item.review_version} čeká na schválení</Link> : item.draft_id ? <Link className="text-cyan-800 underline" to={withReturn(`/test-cases/${item.id}?tab=draft`, returnTo)}>Pokračovat v návrhu</Link> : null}</div>
          {item.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">{item.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}</div>}
          {item.automated && <span className="text-[10px] text-slate-500">Automatizovaný</span>}
        </td>
        <td className="text-slate-500">{item.suite_name}</td><td><span className={item.status === "ready" ? "text-emerald-700" : "text-slate-500"}>{caseStatusLabels[item.status]}</span></td>
        {scope.groupId && <td><details className="text-xs"><summary className="cursor-pointer text-cyan-800">{item.origins.length} {item.origins.length === 1 ? "zdroj" : "zdrojů"}</summary><ul className="mt-1 space-y-1">{item.origins.map(origin => <li key={`${origin.group_id}:${origin.suite_id}`}>{origin.group_name} · {origin.suite_name ?? "Přímý odkaz"}</li>)}</ul></details></td>}
        <td>{(actions.onDelete || actions.onMove || actions.onUnlink) && <ExecutionMenu label="Akce">
          <button type="button" disabled={state.loading} onClick={() => actions.onOpen(item.id)}>Otevřít test case</button>
          {actions.onMove && <button type="button" disabled={state.loading || actions.movingCaseId === item.id} onClick={() => { setMoveTarget(item); setSuiteTarget(String(item.suite_id)); setSuiteQuery(""); }}>Přesunout do suity</button>}
          {actions.onUnlink && <button type="button" disabled={state.loading} onClick={() => actions.onUnlink?.(item)}>Odebrat přímý odkaz</button>}
          {actions.onDelete && <button type="button" disabled={state.loading || item.status === "deprecated"} onClick={() => actions.onDelete?.(item)}>Vyřadit test case</button>}
        </ExecutionMenu>}</td>
      </tr>)}</tbody>
    </table>
    {!state.loading && !state.error && !data?.items.length && <p className="p-3 text-sm text-slate-500">Filtrům neodpovídá žádný test case.</p>}
    {data && <div className="repository-pagination"><span>Zobrazeno {data.total ? data.offset + 1 : 0}–{Math.min(data.offset + data.items.length, data.total)} z {data.total} · celkem v rozsahu {data.scope_total}</span>
      <div className="flex items-center gap-1"><select aria-label="Testů na stránku" className="workspace-input" value={filters.limit ?? 50} onChange={event => filter({ limit: Number(event.target.value) })}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select>
        <button type="button" className="workspace-button" aria-label="Předchozí stránka testů" disabled={state.loading || !data.offset} onClick={() => setFilters({ ...filters, offset: Math.max(0, data.offset - data.limit) })}>‹</button>
        <button type="button" className="workspace-button" aria-label="Další stránka testů" disabled={state.loading || data.offset + data.limit >= data.total} onClick={() => setFilters({ ...filters, offset: data.offset + data.limit })}>›</button></div>
    </div>}
    {moveTarget && <AccessibleDialog title={`Přesunout ${moveTarget.code}`} onClose={() => setMoveTarget(null)}>
      <input type="search" className="workspace-input w-full" aria-label="Hledat cílovou suitu" value={suiteQuery} onChange={event => setSuiteQuery(event.target.value)} />
      <select aria-label="Cílová suita" className="workspace-input mt-2 w-full" value={suiteTarget} onChange={event => setSuiteTarget(event.target.value)}>
        {suites.filter(suite => String(suite.id) === suiteTarget || suite.name.toLocaleLowerCase("cs").includes(suiteQuery.toLocaleLowerCase("cs"))).map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}
      </select>
      <button type="button" className="workspace-button workspace-primary mt-3" disabled={!suiteTarget || Number(suiteTarget) === moveTarget.suite_id} onClick={() => { actions.onMove?.(moveTarget, Number(suiteTarget)); setMoveTarget(null); }}>Přesunout</button>
    </AccessibleDialog>}
  </section>;
}
