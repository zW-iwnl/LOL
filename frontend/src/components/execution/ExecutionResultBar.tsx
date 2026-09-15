import { useState } from "react";
import type { TestRunCaseResult } from "../../api/client";
import { resultColors, resultLabels, resultSymbols } from "./model";

type Props = {
  result: TestRunCaseResult | null; savedResult: TestRunCaseResult; comment: string; dirty: boolean;
  disabled: boolean; busy: boolean; message: string | null;
  onResult: (value: TestRunCaseResult) => void; onComment: (value: string) => void;
  onSave: (advance: boolean, override?: TestRunCaseResult) => void;
};
export function ExecutionResultBar(props: Props) {
  const [commentOpen, setCommentOpen] = useState(Boolean(props.comment));
  return <section className="execution-result-bar" aria-label="Celkový výsledek">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium">Výsledek</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Zvolit celkový výsledek">
        {(["passed", "failed", "blocked", "skipped"] as const).map(value => <button type="button" key={value}
          aria-pressed={props.result === value} disabled={props.disabled} onClick={() => props.onResult(value)}
          className={`workspace-button ${resultColors[value]} ${props.result === value ? "border-focus bg-selected-bg ring-1 ring-focus" : ""}`}>
          <span aria-hidden="true">{resultSymbols[value]}</span> {resultLabels[value]}
        </button>)}
      </div>
      <span className="text-xs text-muted">Uloženo: {resultLabels[props.savedResult]}</span>
    </div>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
      <details className="min-w-0 flex-1 text-xs" open={commentOpen} onToggle={event => setCommentOpen(event.currentTarget.open)}>
        <summary className="w-fit cursor-pointer py-1 font-medium text-link">Komentář{props.comment ? ` (${props.comment.length})` : ""}</summary>
        <textarea aria-label="Komentář k provedení" placeholder="Poznámka k provedení…" rows={2} value={props.comment}
          disabled={props.disabled} onChange={event => props.onComment(event.target.value)} className="mt-1 max-h-32 w-full min-w-40 rounded border border-control bg-surface p-2 text-sm" />
      </details>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="workspace-button" disabled={props.disabled} onClick={() => props.onSave(true, "passed")}>✓ Rychle úspěšné a další</button>
        <button type="button" className="workspace-button" disabled={props.disabled || props.result === null || props.result === "not_run"} onClick={() => props.onSave(false)}>Uložit</button>
        <button type="button" className="workspace-button workspace-primary" disabled={props.disabled || props.result === null || props.result === "not_run"} onClick={() => props.onSave(true)}>{props.busy ? "Ukládám…" : "Uložit a další"}</button>
      </div>
    </div>
    <p role="status" className={`mt-1 text-xs ${props.dirty ? "text-warning" : "text-muted"}`}>
      {props.dirty ? "Neuložený celkový výsledek / komentář. Rozepsané údaje zůstanou při přepnutí testu zachované v této kartě prohlížeče." : props.message ?? "Vyhodnocení kroků nemění uložený celkový výsledek."}
    </p>
  </section>;
}
