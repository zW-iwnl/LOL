import type { TestRunListItem, TestRunStatus } from "../../api/testRuns";
import { Pagination } from "../workspace/Workspace";
import { resultSummary, statusLabels, statusClasses } from "./model";

type Props = {
  runs: TestRunListItem[]; selectedId: number | null; query: string; status: TestRunStatus | ""; environment: string;
  onQuery: (value: string) => void; onStatus: (value: TestRunStatus | "") => void; onEnvironment: (value: string) => void;
  onSelect: (id: number) => void; total: number; offset: number; limit: number; onPage: (offset: number) => void; onLimit: (limit: number) => void;
  loading: boolean; error: string | null; onRetry: () => void; disabled: boolean; className: string;
};
export function TestRunNavigator(props: Props) {
  return <aside className={`workspace-navigation ${props.className}`} aria-label="Seznam běhů">
    <div className="grid gap-2 border-b border-border p-3">
      <input className="workspace-input w-full" type="search" aria-label="Hledat běh nebo číslo úkolu" placeholder="Hledat běh / číslo úkolu" value={props.query} onChange={e => props.onQuery(e.target.value)} />
      <div className="grid grid-cols-2 gap-2"><select className="workspace-input" aria-label="Stav běhu" value={props.status} onChange={e => props.onStatus(e.target.value as Props["status"])}><option value="">Všechny stavy</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input className="workspace-input w-full" aria-label="Filtr prostředí" placeholder="Všechna prostředí" list="run-environments" value={props.environment} onChange={e => props.onEnvironment(e.target.value)} /><datalist id="run-environments">{["DEV", "TEST", "UAT", "PROD-LIKE"].map(value => <option key={value} value={value} />)}</datalist></div>
    </div>
    <div className="workspace-scroll flex-1" aria-busy={props.loading}>
      {props.loading && <p role="status" className="p-3 text-xs text-muted">Načítám běhy…</p>}
      {props.error && <div role="alert" className="p-3 text-sm text-danger">{props.error}<button className="workspace-button mt-2" onClick={props.onRetry}>Zkusit znovu</button></div>}
      {!props.loading && !props.error && !props.runs.length && <p className="p-4 text-sm text-muted">Žádné běhy neodpovídají filtru. Změň filtr nebo založ nový běh.</p>}
      {props.runs.map(run => { const summary = run.summary ?? resultSummary(run.test_run_cases); return <button type="button" key={run.id} id={`run-${run.id}`} aria-current={props.selectedId === run.id ? "true" : undefined} disabled={props.disabled} className={`run-navigation-row ${props.selectedId === run.id ? "is-selected" : ""}`} onClick={() => props.onSelect(run.id)}>
        <span className="block break-words font-semibold">{run.name}</span>
        <span className="mt-1 block text-muted">{[run.task_number, run.environment].filter(Boolean).join(" · ") || "Bez čísla úkolu a prostředí"}</span>
        <span className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className={`rounded px-1.5 py-0.5 ${statusClasses[run.status]}`}>{statusLabels[run.status]}</span><span>Vyhodnoceno {summary.executed}/{summary.total}</span></span>
      </button>; })}
    </div>
    <Pagination total={props.total} offset={props.offset} limit={props.limit} busy={props.loading} onChange={props.onPage} onLimit={props.onLimit} label="běhů" />
  </aside>;
}
