import { useState } from "react";
import type { ReviewDetail } from "../../api/testCaseWorkflow";
import { AccessibleDialog } from "../AccessibleDialog";
export function ReviewDecisionBar({ review, busy, reason, error, onReason, onDecide, onClaim, onBlocking }: {
  review: ReviewDetail; busy: boolean; reason: string; error?: string; onReason: (value: string) => void; onDecide: (status: string, next: boolean) => Promise<boolean>; onClaim: () => void; onBlocking: () => void;
}) {
  const [decision, setDecision] = useState<string | null>(null);
  const caps = review.capabilities;
  if (review.status !== "pending") return <footer className="workspace-decision-bar text-xs text-muted">Žádost je uzavřená. {review.decision_reason}</footer>;
  return <footer className="workspace-decision-bar space-y-2">
    {caps?.approval_reason && <p className="text-xs text-warning">{caps.approval_reason} {review.comments.some(c => c.is_blocking && !c.resolved_at) && <button type="button" className="underline" onClick={onBlocking}>Otevřít připomínky</button>}</p>}
    <div className="flex flex-wrap gap-2">{caps?.can_claim && <button type="button" className="workspace-button" disabled={busy} onClick={onClaim}>Převzít ke schválení</button>}
      <button type="button" className="workspace-button workspace-primary" disabled={busy || !caps?.can_approve} onClick={() => void onDecide("approved", false)}>Schválit a publikovat</button>
      <button type="button" className="workspace-button" disabled={busy || !caps?.can_approve} onClick={() => void onDecide("approved", true)}>Schválit a další</button>
      <button type="button" className="workspace-button" disabled={busy || !caps?.can_decide} onClick={() => setDecision("changes_requested")}>Vrátit k dopracování</button>
      <button type="button" className="workspace-button text-danger" disabled={busy || !caps?.can_decide} onClick={() => setDecision("rejected")}>Zamítnout</button>
    </div>
    {decision && <AccessibleDialog title={decision === "rejected" ? "Zamítnout žádost" : "Vrátit k dopracování"} onClose={() => !busy && setDecision(null)}><form onSubmit={async e => { e.preventDefault(); if (await onDecide(decision, false)) setDecision(null); }} className="space-y-3"><p className="text-sm">{decision === "rejected" ? "Zamítnutí uzavře tento návrh. Pro opravu scénáře použijte vrácení k dopracování." : "Autor dostane důvod a může pokračovat v návrhu."}</p><label className="block text-sm">Důvod rozhodnutí<textarea aria-label="Důvod rozhodnutí" className="workspace-input mt-1 w-full" required rows={4} maxLength={10000} disabled={busy} value={reason} onChange={e => onReason(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<button type="submit" className="workspace-button workspace-primary" disabled={busy || !reason.trim()}>Potvrdit rozhodnutí</button></form></AccessibleDialog>}
  </footer>;
}
