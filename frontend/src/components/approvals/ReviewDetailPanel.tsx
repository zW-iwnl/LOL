import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useApiResource } from "../../api/hooks";
import { getReview, workflowMutation } from "../../api/testCaseWorkflow";
import { useWorkspacePreference } from "../workspace/useWorkspacePreference";
import { WorkspaceMenu } from "../workspace/WorkspaceMenu";
import { withReturn } from "../workspace/navigation";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { CaseSnapshotView } from "./CaseSnapshotView";
import { ReviewDiff } from "./ReviewDiff";
import { ReviewComments } from "./ReviewComments";
import { ReviewDecisionBar } from "./ReviewDecisionBar";
const eventLabels: Record<string, string> = { review_submitted: "Odesláno ke schválení", review_assigned: "Přiřazen reviewer", review_decided: "Rozhodnutí", review_withdrawn: "Žádost stažena", review_comment_added: "Přidána připomínka", review_comment_resolved: "Vyřešena připomínka", draft_created: "Založen návrh", draft_saved: "Uložen návrh", draft_taken_over: "Převzata editace", version_frozen: "Vytvořena verze" };
export function ReviewDetailPanel({ reviewId, onChanged }: { reviewId: number; onChanged: (id: number, next: boolean) => Promise<void> }) {
  const { user } = useAuth(); const location = useLocation();
  const [refresh, setRefresh] = useState(0); const [tab, setTab] = useWorkspacePreference(`reviewTab:${reviewId}`, "changes");
  const [input, setInput] = useWorkspacePreference(`reviewInput:${reviewId}`, { body: "", field: "", blocking: false, reason: "" });
  const [reviewer, setReviewer] = useState(""); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(""); const [feedback, setFeedback] = useState("");
  const state = useApiResource(() => getReview(reviewId), [reviewId, refresh]);
  const review = state.data; const disabled = busy || state.loading;
  async function mutate(path: string, payload: unknown, method = "POST", next = false, clear?: "body" | "reason") {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setFeedback("");
    try {
      await workflowMutation(path, payload, method);
      if (clear) setInput({ ...input, [clear]: "" });
      setRefresh(value => value + 1); setFeedback("Změna byla uložena.");
      await onChanged(reviewId, next); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Operaci se nepodařilo dokončit."); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  function showChange(field: string) {
    setTab("changes"); requestAnimationFrame(() => document.getElementById(`change-${field}`)?.scrollIntoView({ block: "nearest" }));
  }
  if (!review) return <section className="workspace-detail p-3" aria-label="Detail schválení">{state.error ? <p role="alert">{state.error}<button type="button" className="workspace-button ml-2" onClick={() => setRefresh(value => value + 1)}>Zkusit znovu</button></p> : <p role="status" className="text-sm">Načítám žádost…</p>}</section>;
  const base = `/test-case-reviews/${review.id}`;
  const caps = review.capabilities;
  const currentPath = location.pathname + location.search;
  const runParams = new URLSearchParams();
  if (review.origin_run_attempt_id) runParams.set("attempt", String(review.origin_run_attempt_id));
  if (review.origin_run_case_id) runParams.set("case", String(review.origin_run_case_id));
  if (review.origin_case_attempt_id) runParams.set("caseAttempt", String(review.origin_case_attempt_id));
  const tabs = [["changes", "Změny"], ["scenario", "Celý scénář"], ["comments", `Připomínky (${review.comments.filter(c => !c.resolved_at).length})`], ["history", "Historie"]];
  return <section className="workspace-detail" aria-label="Detail schválení">
    <header className="space-y-2 border-b border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="text-base font-semibold break-words">{review.code} · verze {review.version_number}</h2><p className="text-sm break-words">{review.title}</p></div><ApprovalStatusBadge state={review.status} /></div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Autor: {review.author_name}</span><span>Reviewer: {review.reviewer_name ?? "Nepřiřazeno"}</span><WorkspaceMenu label="Akce žádosti">
        <Link to={withReturn(`/test-cases/${review.test_case_id}?tab=draft`, currentPath)}>Detail a návrh test case</Link>
        {review.origin_run_id && <Link to={withReturn(`/test-runs/${review.origin_run_id}/execution?${runParams}`, currentPath)}>{review.origin_run_name ?? `Run #${review.origin_run_id}`} · zdrojové provedení</Link>}
        {caps?.can_withdraw && <button type="button" disabled={disabled} onClick={() => void mutate(`${base}/withdrawals`, { lock_version: review.lock_version })}>Stáhnout žádost a upravit návrh</button>}
      </WorkspaceMenu></div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Detail review">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={`workspace-button ${tab === value ? "workspace-active-tab" : ""}`} onClick={() => setTab(value)}>{label}</button>)}</div>
    </header>
    <div className="workspace-scroll p-3">
      {(error || state.error) && <div role="alert" className="mb-2 rounded bg-rose-50 p-2 text-sm text-rose-800">{error || state.error} <button type="button" className="underline" disabled={disabled} onClick={() => { setError(""); setRefresh(value => value + 1); }}>Načíst aktuální stav</button></div>}
      {feedback && <p role="status" className="mb-2 text-xs text-emerald-800">{feedback}</p>}
      {state.loading && <p role="status" className="text-xs">Obnovuji stav…</p>}
      {tab === "changes" && <><p className="mb-3 rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap">Důvod změny: {review.version.change_summary || "—"}</p><p className="mb-2 text-xs text-slate-500">{review.base_version_number ? `Porovnání s publikovanou verzí ${review.base_version_number} při odeslání.` : "První publikace scénáře."}</p><ReviewDiff changes={review.changes} firstVersion={!review.base_approved_version_id} onComment={caps?.can_comment ? field => { setInput({ ...input, field }); setTab("comments"); requestAnimationFrame(() => document.getElementById("review-comment-body")?.focus()); } : undefined} /></>}
      {tab === "scenario" && <CaseSnapshotView content={review.version.content_snapshot} />}
      {tab === "comments" && <ReviewComments review={review} {...input} busy={disabled} onBody={body => setInput({ ...input, body })} onField={field => setInput({ ...input, field })} onBlocking={blocking => setInput({ ...input, blocking })} onChange={showChange}
        onAdd={() => void mutate(`${base}/comments`, { body: input.body, field_path: input.field || null, is_blocking: Boolean(caps?.can_block && input.blocking) }, "POST", false, "body")}
        onResolve={id => void mutate(`/test-case-review-comments/${id}/resolutions`, {})} />}
      {tab === "history" && <div className="space-y-2 text-xs"><h3 className="font-semibold">Poslední události test case (nejvýše 100)</h3><p>Žádost odeslána {new Date(review.created_at).toLocaleString("cs-CZ")} · {review.author_name}</p>{review.decision_reason && <p className="rounded bg-amber-50 p-2 whitespace-pre-wrap">Rozhodnutí: {review.decision_reason}</p>}{review.history?.map(event => <p className="border-b py-2" key={event.id}>{new Date(event.created_at).toLocaleString("cs-CZ")} · {eventLabels[event.event_type] ?? "Změna test case"}</p>)}</div>}
      {caps?.can_assign && <details className="mt-4 border-t pt-2 text-xs"><summary className="cursor-pointer text-cyan-800">Přiřazení reviewera</summary><div className="mt-2 flex gap-2"><select aria-label="Přiřadit reviewerovi" className="workspace-input min-w-0 flex-1" disabled={disabled} value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">Vyberte nezávislého reviewera</option>{caps.eligible_reviewers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button type="button" className="workspace-button" disabled={disabled || !reviewer} onClick={() => void mutate(`${base}/assignment`, { lock_version: review.lock_version, reviewer_id: Number(reviewer) }, "PATCH")}>Přiřadit</button></div></details>}
    </div>
    <ReviewDecisionBar error={error} review={review} busy={disabled} reason={input.reason} onReason={reason => setInput({ ...input, reason })} onBlocking={() => setTab("comments")}
      onClaim={() => void mutate(`${base}/assignment`, { lock_version: review.lock_version, reviewer_id: user!.id }, "PATCH")}
      onDecide={(status, next) => mutate(`${base}/decisions`, { lock_version: review.lock_version, status, reason: status === "approved" ? "" : input.reason }, "POST", next, "reason")} />
  </section>;
}
