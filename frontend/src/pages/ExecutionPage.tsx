import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { safeReturn, withReturn } from "../components/workspace/navigation";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getUsers, type TestRunCaseResult, type TestRunStepResultValue } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { RunCaseCreatePanel } from "../components/approvals/RunCaseCreatePanel";
import { RunVersionSelector } from "../components/approvals/RunVersionSelector";
import { ExecutionCaseHeader } from "../components/execution/ExecutionCaseHeader";
import { ExecutionNavigator } from "../components/execution/ExecutionNavigator";
import { ExecutionResultBar } from "../components/execution/ExecutionResultBar";
import { ExecutionMenu } from "../components/execution/ExecutionMenu";
import { ExecutionSteps } from "../components/execution/ExecutionSteps";
import { emptyFilters, emptyNavigation, filterExecutionCases, nextPendingCase, runStatusLabels, snapshotValue } from "../components/execution/model";
import { useExecution } from "../components/execution/useExecution";
import { useExecutionDrafts } from "../components/execution/useExecutionDrafts";

export function ExecutionPage() {
  const { testRunId } = useParams();
  const id = Number(testRunId);
  if (!Number.isSafeInteger(id) || id <= 0) return <ErrorState message="Neplatné ID test runu." />;
  return <ExecutionWorkspace key={id} runId={id} />;
}

function ExecutionWorkspace({ runId }: { runId: number }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initialAttempt = Number(params.get("attempt")) || undefined;
  const execution = useExecution(runId, initialAttempt);
  const usersState = useApiResource(getUsers);
  const draftState = useExecutionDrafts(runId, user!.id);
  const [selectedId, setSelectedId] = useState<number | null>(Number(params.get("case")) || null);
  const [caseAttemptId, setCaseAttemptId] = useState<number | null>(Number(params.get("caseAttempt")) || null);
  const [filters, setFilters] = useState(emptyFilters);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [navigatorWidth, setNavigatorWidth] = useState(292);
  const [proposalMode, setProposalMode] = useState<"new" | "edit" | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resumedAttempt = useRef<number | null>(null);
  const [resumeKey, setResumeKey] = useState(0);
  const run = execution.run;
  const users = usersState.data ?? [];
  const runAttempt = run?.attempts.find(attempt => attempt.id === run.selected_attempt_id);
  const historicalRun = Boolean(run && runAttempt && runAttempt.id !== run.attempts.at(-1)?.id);
  const item = run?.test_run_cases.find(item => item.id === selectedId)
    ?? run?.test_run_cases.find(item => item.case_attempts.some(attempt => attempt.id === caseAttemptId))
    ?? run?.test_run_cases.find(item => item.id === runAttempt?.last_test_run_case_id)
    ?? run?.test_run_cases.find(item => item.result === "not_run") ?? run?.test_run_cases[0];
  const attempt = item?.case_attempts.find(attempt => attempt.id === caseAttemptId)
    ?? item?.case_attempts.find(attempt => attempt.id === item.case_attempt_id);
  const historicalCase = Boolean(item && attempt && attempt.id !== item.case_attempt_id);
  const canEdit = Boolean(run && runAttempt && !historicalRun && !historicalCase && runAttempt.status !== "completed" && run.status !== "archived");
  const canReset = Boolean(run && !historicalRun && !historicalCase && run.status !== "archived");
  const navigation = run?.navigation ?? emptyNavigation;
  const filteredCases = useMemo(() => filterExecutionCases(run?.test_run_cases ?? [], navigation, filters), [run, navigation, filters]);
  const next = nextPendingCase(filteredCases, item?.id);
  const nextGlobal = nextPendingCase(run?.test_run_cases ?? [], item?.id);
  const storedDraft = attempt && canEdit ? draftState.drafts[attempt.id] : undefined;
  const selectedResult = storedDraft ? storedDraft.result : attempt?.result === "not_run" ? null : attempt?.result ?? null;
  const comment = storedDraft?.comment ?? attempt?.comment ?? "";
  const dirty = Boolean(attempt && storedDraft && (storedDraft.comment !== (attempt.comment ?? "") || (storedDraft.result ?? "not_run") !== attempt.result));
  const snapshot = snapshotValue(attempt?.execution_snapshot) ?? {
    code: item?.code ?? "", title: "Historický snapshot chybí", preconditions: null,
    expected_summary: "Původní obsah není doložen. Pro další provedení vyberte konkrétní schválenou verzi.", steps: [],
  };

  useEffect(() => {
    const pane = contentRef.current;
    if (!pane || !runAttempt || !attempt) return;
    if (resumedAttempt.current !== runAttempt.id && item?.id === runAttempt.last_test_run_case_id && runAttempt.last_step_id) {
      const step = pane.querySelector<HTMLElement>(`#step-${runAttempt.last_step_id}`);
      if (step) pane.scrollTop = step.offsetTop - pane.offsetTop;
      resumedAttempt.current = runAttempt.id;
    } else {
      pane.scrollTop = 0;
    }
  }, [attempt?.id, runAttempt?.id, resumeKey]);

  if (!run && execution.loading || usersState.loading) return <LoadingState />;
  if (!run || usersState.error) return <ErrorState message={execution.error ?? usersState.error ?? "Provedení není dostupné."} />;

  const disabled = execution.busy || !canEdit;
  const done = run.test_run_cases.filter(item => item.result !== "not_run").length;
  const passed = run.test_run_cases.filter(item => item.result === "passed").length;
  const total = run.test_run_cases.length;
  const selectCase = (id: number) => { if (execution.busy) return; setSelectedId(id); setCaseAttemptId(null); setNavigationMessage(null); };
  function changeDraft(result: TestRunCaseResult | null, text: string) {
    if (!attempt || !canEdit) return;
    draftState.update(attempt.id, text === (attempt.comment ?? "") && (result ?? "not_run") === attempt.result ? null : { result, comment: text });
  }
  async function save(advance: boolean, override?: TestRunCaseResult) {
    const result = override ?? selectedResult;
    if (!attempt || disabled || !result || result === "not_run") return;
    const destination = next;
    // Pin the initially inferred selection before its result changes.
    if (item) setSelectedId(item.id);
    const saved = await execution.saveResult(attempt.id, result, comment);
    if (!saved) return;
    draftState.update(attempt.id, null);
    if (advance && destination) { setSelectedId(destination.id); setCaseAttemptId(null); setNavigationMessage(null); }
    else if (advance) setNavigationMessage("Ve filtru už není další neprovedený test.");
  }
  async function saveStep(stepId: number, result: Exclude<TestRunStepResultValue, "not_run">) {
    if (!attempt || disabled) return;
    if (!await execution.saveStep(attempt.id, stepId, result)) return;
    const results = snapshot.steps.filter(step => step.step_type !== "information").map(step =>
      step.id === stepId ? result : attempt.step_results.find(item => item.test_step_id === step.id)?.result ?? "not_run");
    if (results.includes("failed")) changeDraft("failed", comment);
    else if (results.length && results.every(value => value !== "not_run")) changeDraft(results.every(value => value === "skipped") ? "skipped" : "passed", comment);
    else if (storedDraft?.result && storedDraft.result !== attempt.result) changeDraft(null, comment);
  }
  async function rerun(all: boolean) {
    if (execution.busy || (!all && !canReset)) return;
    if (dirty && !window.confirm("Celkový výsledek nebo komentář nejsou uložené. Zahájit nový pokus a zahodit rozepsané údaje tohoto testu?")) return;
    if (item && !all) setSelectedId(item.id);
    const success = all ? await execution.rerunAll() : attempt ? await execution.rerunCase(attempt.id) : false;
    if (success) { if (attempt) draftState.update(attempt.id, null); setCaseAttemptId(null); if (all) setSelectedId(null); }
  }
  async function refreshAfterProposal() {
    setProposalMode(null); setVersionOpen(false); setCaseAttemptId(null);
    if (attempt && (proposalMode === "edit" || versionOpen)) draftState.update(attempt.id, null);
    await execution.reload(run?.selected_attempt_id);
  }
  function openCaseAction(action: () => void) {
    if (dirty && !window.confirm("Změna definice může zahájit nový pokus. Pokračovat s dosud neuloženým celkovým výsledkem nebo komentářem?")) return;
    action();
  }

  return <div className="execution-workspace">
    {proposalMode && <RunCaseCreatePanel runId={run.id} caseId={proposalMode === "edit" ? item?.test_case_id : undefined} caseAttemptId={proposalMode === "edit" ? attempt?.id : undefined} onClose={() => setProposalMode(null)} onExecuted={() => void refreshAfterProposal()} />}
    {versionOpen && item && attempt && <RunVersionSelector caseId={item.test_case_id} attemptId={attempt.id} currentVersionId={attempt.test_case_version_id} onClose={() => setVersionOpen(false)} onExecuted={() => void refreshAfterProposal()} />}
    <div className="execution-run-toolbar">
      <Link to={safeReturn(params.get("returnTo"), "/test-runs")} className="shrink-0 text-xs text-link">{params.has("returnTo") ? "← Zpět na předchozí práci" : "← Běhy"}</Link>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold" title={run.name}>{run.name}</h1>
      <select aria-label="Provedení test runu" disabled={execution.busy} value={run.selected_attempt_id} className="max-w-48 rounded border border-control p-1.5 text-xs"
        onChange={async event => { const id = Number(event.target.value); if (await execution.reload(id)) { setSelectedId(null); setCaseAttemptId(null); setNavigationMessage(null); } }}>
        {run.attempts.map(attempt => <option key={attempt.id} value={attempt.id}>Běh {attempt.attempt_number} · {runStatusLabels[attempt.status]}</option>)}
      </select>
      <span className="text-xs text-muted">Hotovo {done}/{total}</span>
      <ExecutionMenu label="Přehled a akce běhu">
          <p className="px-2 py-1 text-xs text-muted">{run.environment ?? "Bez prostředí"} · {run.version ?? "Bez verze"}{run.task_number ? ` · ${run.task_number}` : ""}</p>
          <p className="px-2 py-1 text-xs">Úspěšnost {done ? Math.round(passed / done * 100) : 0}% z vyhodnocených testů</p>
          <p className="px-2 py-1 text-xs">Definice: {run.definition_counts.approved ?? 0} schválených · {run.definition_counts.unapproved ?? 0} neschválených · {run.definition_counts.rejected ?? 0} zamítnutých · {run.definition_counts.unknown ?? 0} nedoložených</p>
          {runAttempt?.last_step_id && <button type="button" disabled={execution.busy} onClick={() => { if (runAttempt.last_test_run_case_id) { resumedAttempt.current = null; selectCase(runAttempt.last_test_run_case_id); setResumeKey(value => value + 1); } }}>Pokračovat od posledního kroku</button>}
          <button type="button" disabled={execution.busy || historicalRun || run.status === "archived"} onClick={() => setProposalMode("new")}>Nový test case v tomto runu</button>
          <Link to={withReturn(`/test-case-approvals?tab=drafts&origin_run_id=${run.id}`, `/test-runs/${run.id}/execution?attempt=${run.selected_attempt_id}&case=${item?.id ?? ""}&caseAttempt=${attempt?.id ?? ""}`)}>Návrhy z tohoto runu</Link>
          <button type="button" disabled={execution.busy || historicalRun || run.status === "archived"} onClick={() => void rerun(true)}>Spustit rerun</button>
      </ExecutionMenu>
    </div>
    <div role="progressbar" aria-label="Průběh provedení" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={done} className="h-1 shrink-0 overflow-hidden rounded bg-track"><div className="h-full bg-accent" style={{ width: `${total ? done / total * 100 : 0}%` }} /></div>
    {execution.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded bg-danger-bg p-2 text-sm text-danger">{execution.error}<button type="button" className="workspace-button" disabled={execution.busy} onClick={() => void execution.reload(run.selected_attempt_id)}>Obnovit data</button></div>}
    {(historicalRun || historicalCase || run.status === "archived" || runAttempt?.status === "completed") && <p className="rounded bg-warning-bg px-3 py-2 text-xs text-warning">
      {run.status === "archived" ? "Archivovaný běh" : historicalRun || historicalCase ? "Historické provedení" : "Dokončené provedení"} · pouze pro čtení.{canReset ? " Pro další testování vytvořte nový pokus." : ""}
    </p>}
    <div className="flex items-center gap-2 text-xs">
      <button type="button" className="workspace-button" aria-expanded={navigatorOpen} onClick={() => setNavigatorOpen(value => !value)}>{navigatorOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}{navigatorOpen ? "Skrýt testy" : "Zobrazit testy"}</button>
      <label className="execution-width-control items-center gap-2 text-muted">Šířka navigace<input aria-label="Šířka navigace" type="range" min={260} max={400} step={10} value={navigatorWidth} onChange={event => setNavigatorWidth(Number(event.target.value))} className="w-20" /></label>
      {execution.loading && <span role="status">Obnovuji…</span>}
      {Object.keys(draftState.drafts).length > 0 && <span className="ml-auto text-warning">Rozepsané výsledky: {Object.keys(draftState.drafts).length}</span>}
    </div>
    <div className={`execution-panels ${navigatorOpen ? "with-navigation" : ""}`} style={{ "--execution-navigation-width": `${navigatorWidth}px` } as CSSProperties}>
      {navigatorOpen && <ExecutionNavigator cases={run.test_run_cases} filteredCases={filteredCases} navigation={navigation} users={users} selectedId={item?.id} filters={filters} busy={execution.busy} onFilters={setFilters} onSelect={selectCase} onNext={() => next && selectCase(next.id)} hasNext={Boolean(next)} />}
      <section className="execution-detail" aria-label="Provedení vybraného testu" aria-busy={execution.busy}>
        {item && attempt ? <>
          <div className="execution-content-scroll" ref={contentRef}>
            {!filteredCases.some(candidate => candidate.id === item.id) && <p className="bg-info-bg px-3 py-2 text-xs text-info">Vybraný test je mimo aktuální filtr. Jeho detail zůstává otevřený.</p>}
            {(navigationMessage || !next && nextGlobal) && <div className="flex flex-wrap items-center gap-2 bg-surface-muted px-3 py-2 text-xs"><span>{navigationMessage ?? "Ve filtru není další neprovedený test."}</span>{nextGlobal && <button type="button" disabled={execution.busy} className="text-link underline" onClick={() => { setFilters(emptyFilters); selectCase(nextGlobal.id); }}>Pokračovat v celém běhu</button>}</div>}
            <ExecutionCaseHeader key={item.id} item={item} attempt={attempt} snapshot={snapshot} users={users} busy={execution.busy} canReset={canReset}
              onAttempt={id => { setSelectedId(item.id); setCaseAttemptId(id); }} onRerun={() => void rerun(false)} onProposal={() => openCaseAction(() => setProposalMode("edit"))} onVersion={() => openCaseAction(() => setVersionOpen(true))} />
            <ExecutionSteps steps={snapshot.steps} results={attempt.step_results} users={users} disabled={disabled} savingStepId={execution.savingStepId} onResult={(stepId, result) => void saveStep(stepId, result)} />
          </div>
          <ExecutionResultBar key={attempt.id} result={selectedResult} savedResult={attempt.result} comment={comment} dirty={dirty} disabled={disabled} busy={execution.busy} message={execution.message}
            onResult={result => changeDraft(result, comment)} onComment={text => changeDraft(selectedResult, text)} onSave={(advance, override) => void save(advance, override)} />
        </> : <div className="p-5 text-sm"><p>V tomto pokusu zatím nejsou test cases.</p>{!historicalRun && run.status !== "archived" && <button type="button" className="workspace-button mt-3" disabled={execution.busy} onClick={() => setProposalMode("new")}>Nový test case v tomto runu</button>}</div>}
      </section>
    </div>
  </div>;
}
