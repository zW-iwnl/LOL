import { ExecutionMenu } from "./ExecutionMenu";
import type { User } from "../../api/client";
import type { TestRunCaseAttemptHistory, TestRunExecutionCase } from "../../api/testRuns";
import { ApprovalStatusBadge } from "../approvals/ApprovalStatusBadge";
import { formatDateTime, resultLabels, type ExecutionSnapshot } from "./model";

type Props = {
  item: TestRunExecutionCase; attempt: TestRunCaseAttemptHistory; snapshot: ExecutionSnapshot; users: User[];
  busy: boolean; canReset: boolean; onAttempt: (id: number) => void;
  onRerun: () => void; onProposal: () => void; onVersion: () => void;
};
export function ExecutionCaseHeader({ item, attempt, snapshot, users, busy, canReset, onAttempt, onRerun, onProposal, onVersion }: Props) {
  return <header className="space-y-2 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-link">{snapshot.code}</span>
        <span className="rounded bg-surface-muted px-2 py-1">Verze {attempt.version_number ?? "nedoložena"}</span>
        <ApprovalStatusBadge state={attempt.approval_state} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Historie test case" className="max-w-full rounded border border-control p-1.5 text-xs" value={attempt.id} disabled={busy} onChange={event => onAttempt(Number(event.target.value))}>
          {item.case_attempts.map(history => <option key={history.id} value={history.id}>
            Běh {history.test_run_attempt_number} · Pokus {history.attempt_number} · {resultLabels[history.result]}
          </option>)}
        </select>
        <ExecutionMenu label="Akce testu">
          <button type="button" disabled={busy || !canReset} onClick={onRerun}>Reset / rerun test case</button>
          <button type="button" disabled={busy || !canReset} onClick={onProposal}>Navrhnout změnu scénáře</button>
          <button type="button" disabled={busy || !canReset} onClick={onVersion}>Nový pokus s jinou schválenou verzí</button>
        </ExecutionMenu>
      </div>
    </div>
    <h2 className="break-words text-lg font-semibold leading-snug">{snapshot.title}</h2>
    {attempt.closure_reason === "definition_changed" && <p className="text-xs text-warning">Pokus ukončen změnou definice.</p>}
    {snapshot.preconditions && <details open key={attempt.id} className="text-sm"><summary className="cursor-pointer text-xs font-medium text-muted">Předpoklady</summary><p className="mt-1 whitespace-pre-wrap break-words">{snapshot.preconditions}</p></details>}
    <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
      <details className="text-xs text-muted"><summary className="cursor-pointer font-medium">Podrobnosti testu a schválení</summary>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><dt className="font-medium">Tester</dt><dd>{users.find(user => user.id === item.assigned_to)?.name ?? "Nepřiřazeno"}</dd></div>
          <div><dt className="font-medium">Provedl / čas</dt><dd>{users.find(user => user.id === attempt.executed_by)?.name ?? "—"} · {formatDateTime(attempt.executed_at)}</dd></div>
          <div><dt className="font-medium">Schválení při zahájení</dt><dd><ApprovalStatusBadge state={attempt.approval_state_at_start ?? attempt.approval_state_at_binding} /></dd></div>
          <div><dt className="font-medium">Suita ve snapshotu</dt><dd>{typeof attempt.execution_snapshot?.suite_name === "string" ? attempt.execution_snapshot.suite_name : "Nedoložena"}</dd></div>
        </dl>
      </details>
      {snapshot.expected_summary && <details className="min-w-0 text-sm" open={!snapshot.steps.length}><summary className="cursor-pointer text-xs font-medium text-muted">Očekávaný celkový výsledek</summary><p className="mt-1 whitespace-pre-wrap break-words">{snapshot.expected_summary}</p></details>}
    </div>
  </header>;
}
