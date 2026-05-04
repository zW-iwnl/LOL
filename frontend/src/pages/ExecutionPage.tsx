import { ArrowLeft, Ban, CheckCircle2, CircleSlash, Save, X, XCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
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

export function ExecutionPage() {
  const { testRunId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const executionState = useApiResource(
    () => (testRunId ? getTestRunExecution(Number(testRunId)) : Promise.reject(new Error("Chybí ID test runu."))),
    [testRunId, refreshKey],
  );
  const [selectedRunCaseId, setSelectedRunCaseId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestRunCaseResult>("passed");
  const [comment, setComment] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectTitle, setDefectTitle] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [defectPriority, setDefectPriority] = useState<DefectCreate["priority"]>("high");

  const run = executionState.data;
  const selectedRunCase = useMemo(() => {
    if (!run) {
      return null;
    }
    return run.test_run_cases.find((item) => item.id === selectedRunCaseId) ?? nextNotRun(run.test_run_cases);
  }, [run, selectedRunCaseId]);

  if (executionState.loading) {
    return <LoadingState />;
  }

  if (executionState.error || !run) {
    return <ErrorState message={executionState.error ?? "Execution data nejsou dostupná."} />;
  }

  if (!selectedRunCase) {
    return <ErrorState message="Test run neobsahuje žádné test cases." />;
  }

  const currentRunCase = selectedRunCase;

  async function saveResult(defect?: DefectCreate | null) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
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
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Výsledek se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (selectedResult === "failed") {
      setDefectTitle(`Selhání: ${currentRunCase.test_case.code} - ${currentRunCase.test_case.title}`);
      setShowDefectModal(true);
      return;
    }
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
          </div>
          <div className="divide-y divide-slate-100">
            {run.test_run_cases.map((runCase) => (
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
                <div className="text-sm font-medium">{runCase.test_case.code}</div>
                <div className="mt-1 truncate text-sm text-slate-600">{runCase.test_case.title}</div>
                <div className="mt-2 text-xs text-slate-500">{resultLabel(runCase.result)}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <article className="rounded-md border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-cyan-700">{selectedRunCase.test_case.code}</div>
            <h2 className="mt-1 text-2xl font-semibold">{selectedRunCase.test_case.title}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Preconditions</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{selectedRunCase.test_case.preconditions ?? "-"}</p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">Expected summary</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{selectedRunCase.test_case.expected_summary ?? "-"}</p>
              </div>
            </div>
          </article>

          <article className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold">Kroky testu</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {selectedRunCase.test_case.steps.map((step) => (
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
              {selectedRunCase.test_case.steps.length === 0 && <div className="p-5 text-sm text-slate-500">Test case nemá definované kroky.</div>}
            </div>
          </article>
        </div>

        <aside className="h-fit rounded-md border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Výsledek provedení</h3>
          <p className="mt-1 text-sm text-slate-500">Aktuální výsledek: {resultLabel(selectedRunCase.result)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {resultActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.result}
                  className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${action.className} ${selectedResult === action.result ? "ring-2 ring-cyan-500" : ""}`}
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
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} onClick={handleSave} type="button">
            <Save size={16} /> {saving ? "Ukládám..." : "Uložit výsledek"}
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
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={() => void saveResult(null)} type="button">
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
