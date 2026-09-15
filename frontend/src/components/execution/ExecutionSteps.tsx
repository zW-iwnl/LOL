import type { TestRunStepResult, TestRunStepResultValue, User } from "../../api/client";
import { formatDateTime, resultColors, resultSymbols, type SnapshotStep } from "./model";

const actions = [
  { value: "passed", label: "Splněno" }, { value: "failed", label: "Chyba" }, { value: "skipped", label: "Přeskočeno" },
] as const;
type Props = {
  steps: SnapshotStep[]; results: TestRunStepResult[]; users: User[]; disabled: boolean; savingStepId: number | null;
  onResult: (stepId: number, result: Exclude<TestRunStepResultValue, "not_run">) => void;
};
export function ExecutionSteps({ steps, results, users, disabled, savingStepId, onResult }: Props) {
  const tests = steps.filter(step => step.step_type !== "information");
  const byStep = new Map(results.map(result => [result.test_step_id, result]));
  const completed = tests.filter(step => byStep.has(step.id) && byStep.get(step.id)?.result !== "not_run").length;
  return <section aria-label="Kroky testu">
    <div className="flex items-center justify-between gap-2 border-y border-border bg-surface-muted px-3 py-2">
      <h3 className="text-sm font-semibold">Kroky testu</h3><span className="text-xs text-muted">{completed}/{tests.length} vyhodnoceno · kroky se ukládají ihned</span>
    </div>
    {tests.length === 0 && <p className="bg-info-bg p-3 text-sm text-info">{steps.length ? "Test obsahuje pouze informační kroky." : "Test nemá definované kroky."} Celkový výsledek lze uložit ručně.</p>}
    <div className="execution-step-columns execution-step-heading" aria-hidden="true"><span>#</span><span>Akce a testovací data</span><span>Očekávaný výsledek</span><span>Vyhodnocení</span></div>
    {steps.map(step => {
      const information = step.step_type === "information";
      const result = byStep.get(step.id);
      const value = result?.result ?? "not_run";
      const executor = users.find(user => user.id === result?.executed_by)?.name;
      return <div id={`step-${step.id}`} key={step.id} className={`execution-step-columns execution-step ${information ? "bg-info-bg/60" : ""}`}>
        <span className="text-xs font-semibold text-muted">{step.step_order}</span>
        <div className={information ? "execution-information" : ""}>
          {information && <span className="mr-2 text-xs font-medium text-info">Informace</span>}
          <p className={`whitespace-pre-wrap break-words text-sm ${information ? "inline" : ""}`}>{step.action}</p>
          {step.test_data && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted"><b>Data:</b> {step.test_data}</p>}
          {information && step.note && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{step.note}</p>}
        </div>
        {!information && <>
          <div><span className="execution-mobile-label">Očekávaný výsledek</span><p className="whitespace-pre-wrap break-words text-sm">{step.expected_result ?? "—"}</p>
            {step.note && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted"><b>Poznámka:</b> {step.note}</p>}
          </div>
          <div>
            <div className="flex gap-1" role="group" aria-label={`Vyhodnocení kroku ${step.step_order}`}>
              {actions.map(action => <button type="button" key={action.value} aria-label={action.label} title={action.label}
                aria-pressed={value === action.value} disabled={disabled} onClick={() => onResult(step.id, action.value)}
                className={`grid h-8 w-9 place-items-center rounded border text-base font-bold disabled:opacity-40 ${resultColors[action.value]} ${value === action.value ? "border-focus bg-selected-bg ring-1 ring-focus" : "border-border bg-surface hover:bg-surface-muted"}`}>
                {resultSymbols[action.value]}
              </button>)}
            </div>
            <span className={savingStepId === step.id ? "mt-1 block text-[11px] text-muted" : "sr-only"}>{savingStepId === step.id ? "Ukládám…" : actions.find(action => action.value === value)?.label ?? "Nevyhodnoceno"}</span>
            {result?.executed_at && <details className="mt-1 text-[11px] text-muted"><summary className="cursor-pointer">Provedení</summary>{executor ?? `Uživatel ${result.executed_by ?? "—"}`}<br />{formatDateTime(result.executed_at)}</details>}
          </div>
        </>}
      </div>;
    })}
  </section>;
}
