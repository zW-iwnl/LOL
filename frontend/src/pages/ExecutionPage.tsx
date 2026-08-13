import { ArrowLeft, Ban, CheckCircle2, CircleSlash, Save, SkipForward, X, XCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getUsers,
  updateTestRunCaseResult,
  type DefectCreate,
  type TestRunCaseResult,
} from "../api/client";
import { getTestRunExecution, type TestRunExecutionCase } from "../api/testRuns";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { resultLabel } from "../data/mockData";

const resultActions = [
  { result: "passed" as const, label: "Passed", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { result: "failed" as const, label: "Failed", icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-700" },
  { result: "blocked" as const, label: "Blocked", icon: Ban, className: "border-amber-200 bg-amber-50 text-amber-700" },
  { result: "skipped" as const, label: "Skipped", icon: CircleSlash, className: "border-slate-200 bg-slate-50 text-slate-700" },
];

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
    steps: snapshot.steps,
  };
}

export function ExecutionPage() {
  const { testRunId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const executionState = useApiResource(
    () => (testRunId ? getTestRunExecution(Number(testRunId)) : Promise.reject(new Error("Chybí ID test runu."))),
    [testRunId, refreshKey],
  );
  const usersState = useApiResource(getUsers, [refreshKey]);
  const [selectedRunCaseId, setSelectedRunCaseId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestRunCaseResult>("passed");
  const [resultFilter, setResultFilter] = useState<TestRunCaseResult | "">("");
  const [comment, setComment] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectTitle, setDefectTitle] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [defectPriority, setDefectPriority] = useState<DefectCreate["priority"]>("high");

  const run = executionState.data;
  const users = usersState.data ?? [];
  const selectedRunCase = useMemo(() => {
    if (!run) {
      return null;
    }
    return run.test_run_cases.find((item) => item.id === selectedRunCaseId) ?? nextNotRun(run.test_run_cases);
  }, [run, selectedRunCaseId]);
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

  if (executionState.loading || usersState.loading) {
    return <LoadingState />;
  }

  if (executionState.error || usersState.error || !run) {
    return <ErrorState message={executionState.error ?? usersState.error ?? "Execution data nejsou dostupná."} />;
  }

  if (!selectedRunCase) {
    return <ErrorState message="Test run neobsahuje žádné test cases." />;
  }

  const currentRunCase = selectedRunCase;
  const currentRun = run;
  const currentSnapshot = snapshotValue(currentRunCase.test_case_snapshot);
  const displayedTestCase = currentSnapshot ?? {
    code: currentRunCase.test_case.code,
    title: currentRunCase.test_case.title,
    preconditions: currentRunCase.test_case.preconditions,
    expected_summary: currentRunCase.test_case.expected_summary,
    steps: currentRunCase.test_case.steps,
  };

  async function saveResult(defect?: DefectCreate | null) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const nextRunCase = currentRun.test_run_cases.find((item) => item.id !== currentRunCase.id && item.result === "not_run");
      await updateTestRunCaseResult(currentRunCase.id, {
        result: selectedResult,
        comment: comment || null,
        defect: selectedResult === "failed" ? defect ?? null : null,
      });
      setSaveMessage("Výsledek byl uložen.");
      setShowDefectModal(false);
      setDefectTitle("");
      setDefectDescription("");
      setComment("");
      if (nextRunCase) {
        setSelectedRunCaseId(nextRunCase.id);
        setSelectedResult("passed");
      }
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Výsledek se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (selectedResult === "failed") {
      setDefectTitle(`Selhání: ${displayedTestCase.code} - ${displayedTestCase.title}`);
      setShowDefectModal(true);
      return;
    }
    void saveResult(null);
  }

  function goToNextPending() {
    if (!nextPendingRunCase) {
      return;
    }
    setSelectedRunCaseId(nextPendingRunCase.id);
    setSelectedResult("passed");
    setComment(nextPendingRunCase.comment ?? "");
    setSaveMessage(null);
    setSaveError(null);
  }

  function quickPass() {
    setSelectedResult("passed");
    void saveResult(null);
  }

  function handleDefectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveResult({
      title: defectTitle,
      description: defectDescription || null,
      priority: defectPriority,
      severity: defectPriority,
      status: "open",
      test_run_case_id: currentRunCase.id,
    });
  }

  return (
    <div className="space-y-6">
      <Link to="/test-runs" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700">
        <ArrowLeft size={16} /> Zpět na test runy
      </Link>

      <section className="grid gap-6 xl:grid-cols-[340px_1fr_360px]">
        <aside className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">{run.name}</h2>
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
                  setSelectedResult(runCase.result === "not_run" ? "passed" : runCase.result);
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
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-cyan-700">
              <span>{displayedTestCase.code}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">Verze {selectedRunCase.test_case_version}</span>
              {currentSnapshot ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Snapshot runu</span> : null}
            </div>
            <h2 className="mt-1 text-2xl font-semibold">{displayedTestCase.title}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Tester</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{users.find((user) => user.id === selectedRunCase.assigned_to)?.name ?? "-"}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Provedl / čas</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {users.find((user) => user.id === selectedRunCase.executed_by)?.name ?? "-"} / {formatDateTime(selectedRunCase.executed_at)}
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
          </article>

          <article className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold">Kroky testu</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {displayedTestCase.steps.map((step) => (
                <div key={step.id} className="grid gap-4 p-5 md:grid-cols-[64px_1fr_1fr]">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-sm font-semibold">{step.step_order}</div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Akce</div>
                    <p className="mt-1 text-sm">{step.action}</p>
                    {step.test_data && <p className="mt-2 text-xs text-slate-500">Data: {step.test_data}</p>}
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Expected result</div>
                    <p className="mt-1 text-sm">{step.expected_result ?? "-"}</p>
                  </div>
                </div>
              ))}
              {displayedTestCase.steps.length === 0 && <div className="p-5 text-sm text-slate-500">Test case nemá definované kroky.</div>}
            </div>
          </article>
        </div>

        <aside className="h-fit rounded-md border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Výsledek provedení</h3>
          <p className="mt-1 text-sm text-slate-500">Aktuální výsledek: {resultLabel(selectedRunCase.result)}</p>
          {run.status === "archived" && <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Archivovaný test run už nelze exekuovat.</div>}
          {selectedResult === "failed" ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              Failed výsledek při uložení nabídne založení defectu. Lze ho uložit i bez defectu s potvrzením v modalu.
            </div>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {resultActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.result}
                  className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${action.className} ${selectedResult === action.result ? "ring-2 ring-cyan-500" : ""}`}
                  disabled={run.status === "archived"}
                  onClick={() => setSelectedResult(action.result)}
                  type="button"
                >
                  <Icon size={16} /> {action.label}
                </button>
              );
            })}
          </div>
          <label className="mt-5 block text-sm">
            <span className="font-medium">Komentář</span>
            <textarea
              className="mt-1 min-h-36 w-full rounded-md border border-slate-200 px-3 py-2"
              placeholder="Doplň poznámku k provedení."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving || run.status === "archived"} onClick={handleSave} type="button">
            <Save size={16} /> {saving ? "Ukládám..." : "Uložit výsledek"}
          </button>
          <button
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-60"
            disabled={saving || run.status === "archived"}
            onClick={quickPass}
            type="button"
          >
            <CheckCircle2 size={16} /> Rychle uložit Passed
          </button>
          {saveMessage && <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{saveMessage}</div>}
          {saveError && <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div>}
        </aside>
      </section>

      {showDefectModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl" onSubmit={handleDefectSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Založit defect</h2>
                <p className="mt-1 text-sm text-slate-500">Defect bude navázaný na aktuální execution položku.</p>
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setShowDefectModal(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <label className="mt-5 block text-sm">
              <span className="font-medium">Název</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={defectTitle} onChange={(event) => setDefectTitle(event.target.value)} />
            </label>
            <label className="mt-4 block text-sm">
              <span className="font-medium">Priorita</span>
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={defectPriority} onChange={(event) => setDefectPriority(event.target.value as DefectCreate["priority"])}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="mt-4 block text-sm">
              <span className="font-medium">Popis</span>
              <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2" value={defectDescription} onChange={(event) => setDefectDescription(event.target.value)} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50" onClick={() => void saveResult(null)} type="button">
                Uložit bez defectu
              </button>
              <button className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                {saving ? "Ukládám..." : "Uložit a založit defect"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
