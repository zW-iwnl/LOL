import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { addCasesToTestRun, archiveTestRun, removeTestRunCase, updateTestRun, updateTestRunCase, type TestRun } from "../../api/testRuns";
import { withReturn } from "../workspace/navigation";
import { WorkspaceMenu } from "../workspace/WorkspaceMenu";
import { formatDate, resultSummary, statusClasses, statusLabels } from "./model";
import { TestRunCasesTable, type RunUser } from "./TestRunCasesTable";
import { TestRunAddCases } from "./TestRunAddCases";
import { TestRunMetadataForm } from "./TestRunMetadataForm";

type Props = { run: TestRun; users: RunUser[]; usersUnavailable: boolean; revision: number; saving: boolean; error: string | null; returnTo: string; outsideList: boolean; onDirty: (dirty: boolean) => void; confirmLeave: () => boolean; mutate: (action: () => Promise<unknown>, done?: () => void) => Promise<void> };
export function TestRunDetailPanel(props: Props) {
  const { run } = props;
  const [tab, setTab] = useState<"tests" | "metadata">("tests");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const metadataTab = useRef<HTMLButtonElement>(null);
  const testsTab = useRef<HTMLButtonElement>(null);
  const summary = run.summary ?? resultSummary(run.test_run_cases);
  const readOnly = run.status === "archived";
  useEffect(() => { heading.current?.focus(); }, [run.id]);
  function changeTab(next: typeof tab) { if (editing && !props.confirmLeave()) return false; props.onDirty(false); setEditing(false); setTab(next); return true; }
  function stopEditing() { if (!props.confirmLeave()) return; props.onDirty(false); setEditing(false); metadataTab.current?.focus(); }
  return <>
    <header className="space-y-3 border-b border-border p-3">
      <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 basis-full sm:flex-1 sm:basis-0"><h2 ref={heading} tabIndex={-1} className="break-words font-semibold">{run.name}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">{[run.task_number, run.environment, run.version].filter(Boolean).join(" · ")}<span className={`rounded px-2 py-1 ${statusClasses[run.status]}`}>{statusLabels[run.status]}</span></div></div>
        <Link className="workspace-button workspace-primary" to={withReturn(`/test-runs/${run.id}/execution`, props.returnTo)}>{readOnly || run.status === "completed" ? "Zobrazit výsledky" : "Pokračovat v testování"}</Link>
        <WorkspaceMenu label="Akce běhu"><button disabled={props.saving || readOnly} onClick={() => { setTab("metadata"); setEditing(true); }}>Upravit</button><button disabled={props.saving || readOnly} onClick={() => { if (props.confirmLeave() && window.confirm(`Archivovat test run ${run.name}?`)) void props.mutate(() => archiveTestRun(run.id), () => { props.onDirty(false); setEditing(false); }); }}>Archivovat</button></WorkspaceMenu>
      </div>
      {props.outsideList && <p className="text-xs text-muted">Vybraný běh je mimo aktuální filtr nebo stránku seznamu.</p>}
      {readOnly && <p className="text-sm text-muted">Archivovaný běh — pouze pro čtení.</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span>Vyhodnoceno {summary.executed}/{summary.total}</span><span>Úspěšnost {summary.passRate === null ? "—" : `${summary.passRate} % z vyhodnocených`}</span></div>
      <div role="progressbar" aria-label="Průběh vyhodnocení" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progress} aria-valuetext={`${summary.executed} z ${summary.total} testů`} className="h-1.5 overflow-hidden rounded bg-surface-muted"><div className="h-full bg-accent" style={{ width: `${summary.progress}%` }} /></div>
      <p className="text-xs text-muted">Vyhodnocené zahrnují prošlé, neúspěšné, blokované i přeskočené testy.</p>
      <div role="tablist" aria-label="Detail běhu" className="flex gap-2" onKeyDown={e => { if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return; e.preventDefault(); const next = tab === "tests" ? "metadata" : "tests"; if (changeTab(next)) (next === "tests" ? testsTab : metadataTab).current?.focus(); }}>
        <button ref={testsTab} id="run-tests-tab" role="tab" aria-controls="run-tab-panel" aria-selected={tab === "tests"} tabIndex={tab === "tests" ? 0 : -1} className={`workspace-button ${tab === "tests" ? "workspace-active-tab" : ""}`} onClick={() => changeTab("tests")}>Testy ({summary.total})</button>
        <button ref={metadataTab} id="run-metadata-tab" role="tab" aria-controls="run-tab-panel" aria-selected={tab === "metadata"} tabIndex={tab === "metadata" ? 0 : -1} className={`workspace-button ${tab === "metadata" ? "workspace-active-tab" : ""}`} onClick={() => changeTab("metadata")}>Údaje běhu</button>
      </div>
    </header>
    <div className="workspace-scroll" id="run-tab-panel" role="tabpanel" aria-labelledby={tab === "tests" ? "run-tests-tab" : "run-metadata-tab"}>
      {props.error && !editing && <p role="alert" className="m-3 rounded bg-danger-bg p-3 text-sm text-danger">{props.error}</p>}
      {tab === "tests" ? <>
        {!readOnly && <div className="px-3 pt-3"><button className="workspace-button" aria-expanded={adding} disabled={props.saving} onClick={() => setAdding(value => !value)}>Přidat testy</button></div>}
        {adding && !readOnly && <TestRunAddCases runId={run.id} revision={props.revision} users={props.users} usersUnavailable={props.usersUnavailable} saving={props.saving} onCancel={() => setAdding(false)} onAdd={(ids, tester, done) => void props.mutate(() => addCasesToTestRun(run.id, { test_case_ids: ids, assigned_to: tester }), done)} />}
        <TestRunCasesTable runId={run.id} revision={props.revision} readOnly={readOnly} users={props.users} usersUnavailable={props.usersUnavailable} busy={props.saving} returnTo={props.returnTo} onAssign={(item, value) => void props.mutate(() => updateTestRunCase(item.id, { assigned_to: value ? Number(value) : null }))} onRemove={item => { if (window.confirm(`Odebrat ${item.code || "test"} z běhu?`)) void props.mutate(() => removeTestRunCase(item.id)); }} />
      </> : editing ? <TestRunMetadataForm run={run} saving={props.saving} error={props.error} onDirty={props.onDirty} onCancel={stopEditing} onSave={payload => void props.mutate(() => updateTestRun(run.id, payload), () => { props.onDirty(false); setEditing(false); metadataTab.current?.focus(); })} /> : <div className="space-y-4 p-4 text-sm">
        <dl className="grid gap-4 sm:grid-cols-2">{[["Číslo úkolu", run.task_number], ["Prostředí", run.environment], ["Verze", run.version], ["Stav", statusLabels[run.status]], ["Plánovaný začátek", formatDate(run.planned_start)], ["Plánovaný konec", formatDate(run.planned_end)], ["Zahájeno", formatDate(run.started_at)], ["Dokončeno", formatDate(run.finished_at)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="break-words">{value || "—"}</dd></div>)}</dl>
        <div><h3 className="text-xs text-muted">Popis</h3><p className="whitespace-pre-wrap break-words">{run.description || "Bez popisu"}</p></div>
        {!readOnly && <button className="workspace-button" onClick={() => setEditing(true)}>Upravit údaje</button>}
      </div>}
    </div>
  </>;
}
