import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { runResultLabels } from "./model";
import { resultTextClasses } from "../../data/resultStyles";
import type { TestRunCaseListItem } from "../../api/testRuns";
import { getTestRunCasesPage } from "../../api/testRuns";
import { useApiResource } from "../../api/hooks";
import { Pagination } from "../workspace/Workspace";
import { withReturn } from "../workspace/navigation";
import { useDebounced } from "../workspace/useDebounced";

export type RunUser = { id: number; name: string; is_active: boolean };
type Props = { runId: number; revision: number; readOnly: boolean; users: RunUser[]; usersUnavailable: boolean; busy: boolean; returnTo: string; onAssign: (item: TestRunCaseListItem, value: string) => void; onRemove: (item: TestRunCaseListItem) => void };
export function TestRunCasesTable(props: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [tester, setTester] = useState("");
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const search = useDebounced(query);
  const state = useApiResource(() => getTestRunCasesPage(props.runId, { q: search, result, tester, offset }), [props.runId, props.revision, search, result, tester, offset, retry]);
  useEffect(() => { if (state.data && !state.loading && offset > 0 && offset >= state.data.total) setOffset(Math.max(0, Math.ceil(state.data.total / 25) - 1) * 25); }, [state.data, state.loading, offset]);
  return <section aria-label="Přiřazené testy">
    <div className="flex flex-wrap gap-2 p-3">
      <input className="workspace-input min-w-0 basis-full sm:flex-1 sm:basis-0" type="search" aria-label="Hledat přiřazený test" placeholder="Hledat kód nebo název testu" value={query} onChange={e => { setQuery(e.target.value); setOffset(0); }} />
      <select className="workspace-input" aria-label="Výsledek testu" value={result} onChange={e => { setResult(e.target.value); setOffset(0); }}><option value="">Všechny výsledky</option>{Object.entries(runResultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className="workspace-input" aria-label="Filtr testera" value={tester} onChange={e => { setTester(e.target.value); setOffset(0); }}><option value="">Všichni testeři</option><option value="unassigned">Nepřiřazeno</option>{props.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
    </div>
    {state.loading && <p role="status" className="p-3 text-sm text-muted">Načítám testy…</p>}
    {state.error && <p role="alert" className="p-3 text-sm text-danger">{state.error} <button className="workspace-button" onClick={() => setRetry(value => value + 1)}>Zkusit znovu</button></p>}
    {!state.loading && !state.error && !state.data?.items.length && <p className="p-4 text-sm text-muted">Žádné testy. Přidej testy do běhu nebo změň filtr.</p>}
    <div className="run-case-table" role="table" aria-label="Testy v běhu">
      <div role="row" className="run-case-row run-case-heading bg-surface-muted text-muted"><span role="columnheader">Kód a název</span><span role="columnheader">Tester</span><span role="columnheader">Výsledek</span><span role="columnheader">Akce</span></div>
      {state.data?.items.map(item => <div key={item.id} className="run-case-row" role="row">
        <div role="cell" className="min-w-0"><Link className="break-words font-medium text-link hover:underline" to={withReturn(`/test-runs/${props.runId}/execution?case=${item.id}`, props.returnTo)}>{item.code || `Test #${item.test_case_id}`} · {item.title || "Historický snapshot chybí"}</Link></div>
        <div role="cell">
        <select aria-label={`Tester pro ${item.code || item.test_case_id}`} className="workspace-input w-full" value={item.assigned_to ?? ""} disabled={props.busy || props.readOnly || props.usersUnavailable} onChange={e => props.onAssign(item, e.target.value)}>
          <option value="">Nepřiřazeno</option>{item.assigned_to && !props.users.some(user => user.id === item.assigned_to) && <option value={item.assigned_to}>Uživatel #{item.assigned_to}</option>}{props.users.filter(user => user.is_active || user.id === item.assigned_to).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select></div>
        <span role="cell" className={resultTextClasses[item.result]}>{runResultLabels[item.result]}</span>
        <div role="cell"><button className="workspace-button" disabled={props.busy || props.readOnly || item.result !== "not_run" || item.has_history} title={item.has_history ? "Test má historii provádění" : undefined} onClick={() => props.onRemove(item)}>Odebrat</button></div>
      </div>)}
    </div>
    <Pagination total={state.data?.total ?? 0} offset={offset} limit={25} busy={state.loading} onChange={setOffset} label="testů" />
  </section>;
}
