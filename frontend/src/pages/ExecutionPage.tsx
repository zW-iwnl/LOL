import { ArrowLeft, Ban, CheckCircle2, CircleSlash, RotateCcw, Save, SkipForward, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getUsers,
  updateTestRunCaseResult,
  type TestRunCaseResult,
  type TestRunStepResult,
  type TestRunStepResultValue,
  type TestStepType,
} from "../api/client";
import {
  getTestRunExecution,
  createTestRunRerun,
  createTestRunCaseRerun,
  updateTestRunStepResult,
  type TestRunExecutionCase,
} from "../api/testRuns";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { resultLabel } from "../data/mockData";
import { RunCaseCreatePanel } from "../components/approvals/RunCaseCreatePanel";
import { RunVersionSelector } from "../components/approvals/RunVersionSelector";
import { ApprovalStatusBadge } from "../components/approvals/ApprovalStatusBadge";

const resultActions = [
  { result: "passed" as const, label: "Passed", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { result: "failed" as const, label: "Failed", icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-700" },
  { result: "blocked" as const, label: "Blocked", icon: Ban, className: "border-amber-200 bg-amber-50 text-amber-700" },
  { result: "skipped" as const, label: "Skipped", icon: CircleSlash, className: "border-slate-200 bg-slate-50 text-slate-700" },
];

const stepResultActions = [
  { result: "passed" as const, label: "SPLNĚNO", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { result: "failed" as const, label: "CHYBA", icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-700" },
  { result: "skipped" as const, label: "SKIP", icon: CircleSlash, className: "border-slate-200 bg-slate-50 text-slate-700" },
];

const stepResultLabels: Record<TestRunStepResultValue, string> = {
  not_run: "Nevyhodnoceno",
  passed: "Splněno",
  failed: "Chyba",
  skipped: "Skip",
};

function nextNotRun(cases: TestRunExecutionCase[]) {
  return cases.find((item) => item.result === "not_run") ?? cases[0] ?? null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type SnapshotStep = {
  id: number;
  step_order: number;
  action: string;
  step_type?: TestStepType;
  note?: string | null;
  expected_result: string | null;
  test_data: string | null;
};

type ExecutionSnapshot = {
  code: string;
  title: string;
  preconditions: string | null;
  expected_summary: string | null;
  steps: SnapshotStep[];
};

function snapshotValue(value: unknown): ExecutionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const snapshot = value as Partial<ExecutionSnapshot>;
  if (!snapshot.code || !snapshot.title || !Array.isArray(snapshot.steps)) {
    return null;
  }
  return {
    code: snapshot.code,
    title: snapshot.title,
    preconditions: snapshot.preconditions ?? null,
    expected_summary: snapshot.expected_summary ?? null,
    steps: snapshot.steps.map((step) => ({
      ...step,
      step_type: step.step_type ?? "test",
      note: step.note ?? null,
    })),
  };
}

export function ExecutionPage() {
  const { testRunId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [proposalMode, setProposalMode] = useState<"new" | "edit" | null>(null);
  const [versionSelectorOpen, setVersionSelectorOpen] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const executionState = useApiResource(
    () => (testRunId ? getTestRunExecution(Number(testRunId), selectedAttemptId) : Promise.reject(new Error("Chybí ID test runu."))),
    [testRunId, selectedAttemptId, refreshKey],
  );
  const usersState = useApiResource(getUsers, [refreshKey]);
  const [selectedRunCaseId, setSelectedRunCaseId] = useState<number | null>(null);
  const [selectedCaseAttemptId, setSelectedCaseAttemptId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestRunCaseResult | null>(null);
  const [resultFilter, setResultFilter] = useState<TestRunCaseResult | "">("");
  const [comment, setComment] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingStepId, setSavingStepId] = useState<number | null>(null);
  const [stepResultOverrides, setStepResultOverrides] = useState<Record<string, TestRunStepResult>>({});

  const run = executionState.data;
  const users = usersState.data ?? [];
  const selectedAttempt = run?.attempts.find(
    (attempt) => attempt.id === (selectedAttemptId ?? run.selected_attempt_id),
  ) ?? null;
  const latestAttempt = run?.attempts[run.attempts.length - 1] ?? null;
  const isHistoricalAttempt = Boolean(selectedAttempt && latestAttempt && selectedAttempt.id !== latestAttempt.id);
  const canEdit = Boolean(
    run && selectedAttempt && !isHistoricalAttempt && selectedAttempt.status !== "completed" && run.status !== "archived",
  );
  const selectedRunCase = useMemo(() => {
    if (!run) {
      return null;
    }
    return run.test_run_cases.find((item) => item.id === selectedRunCaseId)
      ?? run.test_run_cases.find((item) => item.id === selectedAttempt?.last_test_run_case_id)
      ?? nextNotRun(run.test_run_cases);
  }, [run, selectedAttempt, selectedRunCaseId]);
  const displayedCaseAttempt = selectedRunCase?.case_attempts.find(
    (attempt) => attempt.id === selectedCaseAttemptId,
  ) ?? selectedRunCase?.case_attempts.find(
    (attempt) => attempt.id === selectedRunCase.case_attempt_id,
  ) ?? null;
  const isHistoricalCaseAttempt = Boolean(
    selectedRunCase && displayedCaseAttempt && displayedCaseAttempt.id !== selectedRunCase.case_attempt_id,
  );
  const canEditCase = canEdit && !isHistoricalCaseAttempt;
  const canResetCase = Boolean(
    run && selectedRunCase && displayedCaseAttempt
      && !isHistoricalAttempt
      && displayedCaseAttempt.id === selectedRunCase.case_attempt_id
      && run.status !== "archived",
  );
  const filteredRunCases = useMemo(() => {
    if (!run) {
      return [];
    }
    return resultFilter ? run.test_run_cases.filter((item) => item.result === resultFilter) : run.test_run_cases;
  }, [run, resultFilter]);
  const progress = useMemo(() => {
    if (!run) {
      return { done: 0, total: 0, passRate: 0 };
    }
    const done = run.test_run_cases.filter((item) => item.result !== "not_run").length;
    const passed = run.test_run_cases.filter((item) => item.result === "passed").length;
    return {
      done,
      total: run.test_run_cases.length,
      passRate: done ? Math.round((passed / done) * 100) : 0,
    };
  }, [run]);
  const selectedIndex = run && selectedRunCase ? run.test_run_cases.findIndex((item) => item.id === selectedRunCase.id) : -1;
  const nextPendingRunCase = run?.test_run_cases.find((item) => item.result === "not_run" && item.id !== selectedRunCase?.id) ?? null;

  useEffect(() => {
    setSelectedRunCaseId(null);
    setSelectedCaseAttemptId(null);
    setStepResultOverrides({});
    setComment("");
    setSaveMessage(null);
    setSaveError(null);
  }, [selectedAttemptId]);

  useEffect(() => {
    if (!run || !selectedAttempt?.last_step_id) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      document.getElementById(`step-${selectedAttempt.last_step_id}`)?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [run, selectedAttempt]);

  if (executionState.loading || usersState.loading) {
    return <LoadingState />;
  }

  if (executionState.error || usersState.error || !run) {
    return <ErrorState message={executionState.error ?? usersState.error ?? "Execution data nejsou dostupná."} />;
  }

  if (!selectedRunCase || !displayedCaseAttempt) {
    return <div className="space-y-4"><Link to="/test-runs" className="text-cyan-700">← Test runy</Link><h2 className="text-xl font-semibold">{run.name}</h2><p>V tomto pokusu zatím nejsou test cases.</p>{run.status !== "archived" && <button className="rounded bg-cyan-700 px-4 py-2 text-white" onClick={() => setProposalMode("new")}>Nový test case v tomto runu</button>}{proposalMode && <RunCaseCreatePanel runId={run.id} onClose={() => setProposalMode(null)} onExecuted={() => { setProposalMode(null); setRefreshKey(n => n + 1); }} />}</div>;
  }

  const currentRunCase = selectedRunCase;
  const currentCaseAttempt = displayedCaseAttempt;
  const currentRun = run;
  const currentSnapshot = snapshotValue(currentCaseAttempt.execution_snapshot);
  const displayedTestCase = currentSnapshot ?? {
    code: currentRunCase.code,
    title: "Historický snapshot chybí",
    preconditions: null,
    expected_summary: "Původní obsah není doložen. Pro další provedení vyberte konkrétní schválenou verzi.",
    steps: [],
  };
  const testSteps = displayedTestCase.steps.filter((step) => step.step_type !== "information");
  const stepResultFor = (testStepId: number) =>
    stepResultOverrides[`${currentCaseAttempt.id}:${testStepId}`] ??
    currentCaseAttempt.step_results.find((item) => item.test_step_id === testStepId);
  const completedStepCount = testSteps.filter(
    (step) => (stepResultFor(step.id)?.result ?? "not_run") !== "not_run",
  ).length;

  async function saveResult(resultOverride?: TestRunCaseResult) {
    const resultToSave = resultOverride ?? selectedResult;
    if (!resultToSave) {
      setSaveError("Nejdřív vyber výsledek provedení.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const nextRunCase = currentRun.test_run_cases.find((item) => item.id !== currentRunCase.id && item.result === "not_run");
      await updateTestRunCaseResult(currentCaseAttempt.id, {
        result: resultToSave,
        comment: comment || null,
      });
      setSaveMessage("Výsledek byl uložen.");
      setComment("");
      if (nextRunCase) {
        setSelectedRunCaseId(nextRunCase.id);
        setSelectedResult(null);
      }
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Výsledek se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStepResult(testStepId: number, result: Exclude<TestRunStepResultValue, "not_run">) {
    setSavingStepId(testStepId);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await updateTestRunStepResult(currentCaseAttempt.id, testStepId, result);
      setStepResultOverrides((current) => ({
        ...current,
        [`${currentCaseAttempt.id}:${testStepId}`]: updated,
      }));

      const nextResults = testSteps.map((step) =>
        step.id === testStepId ? result : (stepResultFor(step.id)?.result ?? "not_run"),
      );
      if (nextResults.includes("failed")) {
        setSelectedResult("failed");
      } else if (nextResults.every((item) => item !== "not_run")) {
        setSelectedResult(nextResults.every((item) => item === "skipped") ? "skipped" : "passed");
      }
      setSaveMessage("Výsledek kroku byl uložen.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Výsledek kroku se nepodařilo uložit.");
    } finally {
      setSavingStepId(null);
    }
  }

  function handleSave() {
    void saveResult();
  }

  function goToNextPending() {
    if (!nextPendingRunCase) {
      return;
    }
    setSelectedRunCaseId(nextPendingRunCase.id);
    setSelectedCaseAttemptId(null);
    setSelectedResult(null);
    setComment(nextPendingRunCase.comment ?? "");
    setSaveMessage(null);
    setSaveError(null);
  }

  function quickPass() {
    void saveResult("passed");
  }

  async function handleCreateRerun() {
    if (!testRunId) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const rerun = await createTestRunRerun(Number(testRunId));
      setSelectedAttemptId(rerun.selected_attempt_id);
      setSelectedResult(null);
      setComment("");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Rerun se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCaseRerun() {
    setSaving(true);
    setSaveError(null);
    try {
      const rerun = await createTestRunCaseRerun(currentCaseAttempt.id);
      setSelectedAttemptId(rerun.selected_attempt_id);
      setSelectedCaseAttemptId(null);
      setSelectedResult(null);
      setComment("");
      setStepResultOverrides({});
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Reset test case se nepodařilo provést.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {proposalMode && <RunCaseCreatePanel runId={run.id} caseId={proposalMode === "edit" ? currentRunCase.test_case_id : undefined} caseAttemptId={proposalMode === "edit" ? currentCaseAttempt.id : undefined} onClose={() => setProposalMode(null)} onExecuted={() => { setProposalMode(null); setSelectedCaseAttemptId(null); setRefreshKey(n => n + 1); }} />}
      {versionSelectorOpen && <RunVersionSelector caseId={currentRunCase.test_case_id} attemptId={currentCaseAttempt.id} currentVersionId={currentCaseAttempt.test_case_version_id} onClose={() => setVersionSelectorOpen(false)} onExecuted={() => { setVersionSelectorOpen(false); setSelectedCaseAttemptId(null); setRefreshKey(n => n + 1); }} />}
      <Link to="/test-runs" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700">
        <ArrowLeft size={16} /> Zpět na test runy
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-md border border-slate-200 bg-white p-4">
        <label className="min-w-64 text-sm">
          <span className="font-medium">Provedení test runu</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            value={selectedAttemptId ?? run.selected_attempt_id}
            onChange={(event) => setSelectedAttemptId(Number(event.target.value))}
          >
            {run.attempts.map((attempt) => (
              <option key={attempt.id} value={attempt.id}>
                {attempt.attempt_number === 1 ? "Běh 1" : `Rerun ${attempt.attempt_number - 1}`} · {attempt.status}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving || isHistoricalAttempt || run.status === "archived"} className="rounded border border-cyan-700 px-4 py-2 text-sm text-cyan-800 disabled:opacity-50" onClick={() => setProposalMode("new")}>Nový test case v tomto runu</button>
          <Link className="text-sm text-cyan-700" to={`/test-case-approvals?tab=drafts&origin_run_id=${run.id}`}>Návrhy z tohoto runu</Link>
          {selectedAttempt?.last_step_id ? (
            <span className="text-sm text-slate-500">Poslední krok: {displayedTestCase.steps.find((step) => step.id === selectedAttempt.last_step_id)?.step_order ?? selectedAttempt.last_step_id}</span>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={saving || isHistoricalAttempt || run.status === "archived"}
            onClick={() => void handleCreateRerun()}
            type="button"
          >
            <RotateCcw size={16} /> Spustit rerun
          </button>
        </div>
      </section>

      {isHistoricalAttempt ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Prohlížíte historické provedení. Výsledky jsou pouze pro čtení.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">{run.name}</h2>
            <div className="mt-2 text-xs text-slate-500">Definice v tomto pokusu: {run.definition_counts.approved ?? 0} schválených · {run.definition_counts.unapproved ?? 0} neschválených · {run.definition_counts.rejected ?? 0} zamítnutých · {run.definition_counts.unknown ?? 0} bez doloženého schválení</div>
            <p className="mt-1 text-sm text-slate-500">{run.environment ?? "-"} / {run.version ?? "-"}</p>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              Položka {selectedIndex >= 0 ? selectedIndex + 1 : "-"} z {run.test_run_cases.length}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progress {progress.done}/{progress.total}</span>
                <span>Pass rate {progress.passRate}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
              </div>
            </div>
            <select className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as TestRunCaseResult | "")}>
              <option value="">Všechny výsledky</option>
              <option value="not_run">Not run</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
              <option value="skipped">Skipped</option>
            </select>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              disabled={!nextPendingRunCase}
              onClick={goToNextPending}
              type="button"
            >
              <SkipForward size={16} /> Další neprovedený
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredRunCases.map((runCase) => (
              <button
                key={runCase.id}
                className={`block w-full px-5 py-4 text-left ${selectedRunCase.id === runCase.id ? "bg-cyan-50" : "bg-white"}`}
                onClick={() => {
                  setSelectedRunCaseId(runCase.id);
                  setSelectedCaseAttemptId(null);
                  setSelectedResult(runCase.result === "not_run" ? null : runCase.result);
                  setComment(runCase.comment ?? "");
                  setSaveMessage(null);
                  setSaveError(null);
                }}
                type="button"
              >
                <div className="text-sm font-medium">{snapshotValue(runCase.test_case_snapshot)?.code ?? runCase.test_case.code}</div>
                <div className="mt-1 truncate text-sm text-slate-600">{snapshotValue(runCase.test_case_snapshot)?.title ?? runCase.test_case.title}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {resultLabel(runCase.result)} / {users.find((user) => user.id === runCase.assigned_to)?.name ?? "Nepřiřazeno"}
                </div>
              </button>
            ))}
            {filteredRunCases.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">Filtru neodpovídá žádná položka.</div>}
          </div>
        </aside>

        <div className="space-y-6">
          <article className="rounded-md border border-slate-200 bg-white p-5">
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-cyan-700">
                  <span>{displayedTestCase.code}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">Verze {selectedRunCase.test_case_version}</span>
                  <span className="text-xs">Verze {currentCaseAttempt.version_number ?? "legacy"}</span>
                  <ApprovalStatusBadge state={currentCaseAttempt.approval_state} />
                  <span className="text-xs text-slate-500">Při zahájení: <ApprovalStatusBadge state={currentCaseAttempt.approval_state_at_start ?? currentCaseAttempt.approval_state_at_binding} /></span>
                  {currentCaseAttempt.closure_reason === "definition_changed" && <span className="text-xs text-amber-800">Pokus ukončen změnou definice</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-72 text-xs font-medium text-slate-600">
                    Historie test case
                    <select
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
                      value={currentCaseAttempt.id}
                      onChange={(event) => {
                        const attemptId = Number(event.target.value);
                        const caseAttempt = currentRunCase.case_attempts.find((item) => item.id === attemptId);
                        setSelectedCaseAttemptId(attemptId);
                        setSelectedResult(null);
                        setComment(caseAttempt?.comment ?? "");
                        setStepResultOverrides({});
                        setSaveMessage(null);
                        setSaveError(null);
                      }}
                    >
                      {currentRunCase.case_attempts.map((attempt) => (
                        <option key={attempt.id} value={attempt.id}>
                          {attempt.test_run_attempt_number === 1 ? "Běh 1" : `Rerun ${attempt.test_run_attempt_number - 1}`}
                          {" · "}Pokus {attempt.attempt_number}
                          {" · "}{resultLabel(attempt.result)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 disabled:opacity-50"
                    disabled={saving || !canResetCase}
                    onClick={() => void handleCreateCaseRerun()}
                    type="button"
                  >
                    <RotateCcw size={15} /> Reset / rerun test case
                  </button>
                </div>

                <h2 className="mt-1 text-2xl font-semibold">{displayedTestCase.title}</h2>
                <div className="my-3 flex flex-wrap gap-3 text-sm"><button type="button" disabled={!canResetCase} className="text-cyan-700 disabled:opacity-40" onClick={() => setProposalMode("edit")}>Navrhnout změnu scénáře</button><button type="button" disabled={!canResetCase} className="text-cyan-700 disabled:opacity-40" onClick={() => setVersionSelectorOpen(true)}>Nový pokus s jinou schválenou verzí</button></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Tester</div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{users.find((user) => user.id === selectedRunCase.assigned_to)?.name ?? "-"}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Provedl / čas</div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {users.find((user) => user.id === currentCaseAttempt.executed_by)?.name ?? "-"} / {formatDateTime(currentCaseAttempt.executed_at)}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Preconditions</div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{displayedTestCase.preconditions ?? "-"}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Expected summary</div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{displayedTestCase.expected_summary ?? "-"}</p>
                  </div>
                </div>
              </div>

              <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Výsledek</h3>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600">
                    {resultLabel(currentCaseAttempt.result)}
                  </span>
                </div>
                {run.status === "archived" && <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Archivovaný test run už nelze exekuovat.</div>}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {resultActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.result}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium ${action.className} ${selectedResult === action.result ? "ring-2 ring-cyan-500" : ""}`}
                        disabled={!canEditCase}
                        onClick={() => setSelectedResult(action.result)}
                        type="button"
                      >
                        <Icon size={15} /> {action.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 block text-sm">
                  <span className="font-medium">Komentář</span>
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                    placeholder="Doplň poznámku k provedení."
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving || !canEditCase || selectedResult === null} onClick={handleSave} type="button">
                    <Save size={16} /> {saving ? "Ukládám..." : "Uložit výsledek"}
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-60"
                    disabled={saving || !canEditCase}
                    onClick={quickPass}
                    type="button"
                  >
                    <CheckCircle2 size={16} /> Rychle Passed
                  </button>
                </div>
                {saveMessage && <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{saveMessage}</div>}
                {saveError && <div className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div>}
              </section>
            </div>
          </article>

          <article className="rounded-md border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold">Kroky testu</h3>
              <span className="text-sm text-slate-500">{completedStepCount}/{testSteps.length} testovacích kroků vyhodnoceno</span>
            </div>
            {testSteps.length === 0 ? (
              <div className="border-b border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-700">Test case obsahuje pouze netestovací kroky; celkový výsledek lze uložit ručně.</div>
            ) : null}
            <div className="divide-y divide-slate-100">
              {displayedTestCase.steps.map((step) => {
                const isTestStep = step.step_type !== "information";
                const stepResult = isTestStep ? stepResultFor(step.id) : undefined;
                const currentStepResult = stepResult?.result ?? "not_run";
                const executorName = users.find((user) => user.id === stepResult?.executed_by)?.name;
                return (
                  <div id={`step-${step.id}`} key={step.id} className="grid gap-4 p-5 md:grid-cols-[64px_1fr_1fr] lg:grid-cols-[64px_1fr_1fr_300px]">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-sm font-semibold">{step.step_order}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-slate-500">
                        <span>{isTestStep ? "Akce" : "Informace"}</span>
                        {!isTestStep ? <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700">Netestovací krok</span> : null}
                      </div>
                      <p className="mt-1 text-sm">{step.action}</p>
                      {isTestStep && step.test_data && <p className="mt-2 text-xs text-slate-500">Data: {step.test_data}</p>}
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase text-slate-500">Expected result</div>
                      <p className="mt-1 text-sm">{isTestStep ? step.expected_result ?? "-" : "Bez vyhodnocení"}</p>
                      {step.note ? <p className="mt-2 text-xs text-slate-500">Poznámka: {step.note}</p> : null}
                    </div>
                    <div className="md:col-start-2 lg:col-start-auto">
                      {isTestStep ? (
                        <>
                          <div className="text-xs font-medium uppercase text-slate-500">
                            Stav: {stepResultLabels[currentStepResult]}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {stepResultActions.map((action) => {
                              const Icon = action.icon;
                              return (
                                <button
                                  key={action.result}
                                  className={["inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold", action.className, currentStepResult === action.result ? "ring-2 ring-cyan-500" : ""].join(" ")}
                                  disabled={!canEditCase || savingStepId !== null}
                                  onClick={() => void saveStepResult(step.id, action.result)}
                                  type="button"
                                >
                                  <Icon size={14} />
                                  {savingStepId === step.id ? "UKLÁDÁM..." : action.label}
                                </button>
                              );
                            })}
                          </div>
                          {stepResult?.executed_at ? (
                            <div className="mt-2 text-xs text-slate-500">
                              {executorName ?? "Uživatel " + (stepResult.executed_by ?? "-")} · {formatDateTime(stepResult.executed_at)}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="rounded-md bg-sky-50 p-3 text-sm text-sky-700">Informační krok — bez vyhodnocení.</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {displayedTestCase.steps.length === 0 && <div className="p-5 text-sm text-slate-500">Test case nemá definované kroky.</div>}
            </div>
          </article>
        </div>

      </section>

    </div>
  );
}
