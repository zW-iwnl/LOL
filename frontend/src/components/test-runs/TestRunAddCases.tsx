import { useEffect, useState } from "react";
import { getRepositoryCases } from "../../api/repositoryWorkspace";
import { useApiResource } from "../../api/hooks";
import { useDebounced } from "../workspace/useDebounced";
import { Pagination } from "../workspace/Workspace";
import type { RunUser } from "./TestRunCasesTable";

export function TestRunAddCases({ runId, revision, users, usersUnavailable, saving, onAdd, onCancel }: { runId: number; revision: number; users: RunUser[]; usersUnavailable: boolean; saving: boolean; onAdd: (ids: number[], tester: number | null, done: () => void) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [tester, setTester] = useState("");
  const [retry, setRetry] = useState(0);
  const search = useDebounced(query);
  const state = useApiResource(() => getRepositoryCases({ query: search, eligibleOnly: true, excludeRunId: runId, offset, limit: 50 }), [runId, search, offset, revision, retry]);
  const items = state.data?.items ?? [];
  const ids = items.map(item => item.id);
  const all = ids.length > 0 && ids.every(id => selected.includes(id));
  useEffect(() => { if (state.data && !state.loading && offset > 0 && offset >= state.data.total) setOffset(Math.max(0, Math.ceil(state.data.total / 50) - 1) * 50); }, [state.data, state.loading, offset]);
  return <section className="m-3 rounded border border-border" aria-label="Přidat testy">
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3"><h3 className="mr-auto text-sm font-semibold">Přidat schválené testy</h3><button className="workspace-button" onClick={onCancel} disabled={saving}>Zavřít výběr</button></div>
    <div className="grid gap-3 p-3">
      <input className="workspace-input" type="search" aria-label="Hledat dostupný test" placeholder="Hledat podle kódu nebo názvu" value={query} onChange={e => { setQuery(e.target.value); setOffset(0); }} />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error} <button className="workspace-button" onClick={() => setRetry(value => value + 1)}>Zkusit znovu</button></p>}
      {state.loading ? <p role="status" className="text-sm">Načítám dostupné testy…</p> : <>
        <button className="workspace-button justify-self-start" disabled={!ids.length || saving} onClick={() => setSelected(current => all ? current.filter(id => !ids.includes(id)) : [...new Set([...current, ...ids])])}>{all ? "Odznačit zobrazené" : "Vybrat zobrazené"}</button>
        {items.map(item => <label key={item.id} className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={saving} checked={selected.includes(item.id)} onChange={() => setSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><span>{item.code} · {item.title}<span className="block text-xs text-muted">{item.suite_name}</span></span></label>)}
        {!items.length && !state.error && <p className="text-sm text-muted">Žádné další schválené testy neodpovídají hledání.</p>}
      </>}
      <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs">Tester pro přidávané testy<select className="workspace-input" disabled={saving || usersUnavailable} value={tester} onChange={e => setTester(e.target.value)}><option value="">Nepřiřazeno</option>{users.filter(user => user.is_active).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <button className="workspace-button workspace-primary" disabled={saving || !selected.length || state.loading} onClick={() => onAdd(selected, tester ? Number(tester) : null, () => { setSelected([]); setTester(""); })}>Přidat do test runu ({selected.length})</button></div>
    </div>
    <Pagination total={state.data?.total ?? 0} offset={offset} limit={50} onChange={setOffset} busy={state.loading} label="dostupných testů" />
  </section>;
}
