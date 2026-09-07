import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getUsers } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { getReview, workflowMutation } from "../api/testCaseWorkflow";
import { ApprovalStatusBadge } from "../components/approvals/ApprovalStatusBadge";
import { CaseSnapshotView } from "../components/approvals/CaseSnapshotView";

function display(value: unknown) { return value == null ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 2); }
export function TestCaseApprovalDetailPage() {
  const { reviewId } = useParams();
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [field, setField] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [reviewerId, setReviewerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = useApiResource(() => getReview(Number(reviewId)), [reviewId, refresh]);
  const users = useApiResource(getUsers, []);
  async function mutate(path: string, payload: unknown, method = "POST") {
    setBusy(true); setError("");
    try { await workflowMutation(path, payload, method); setRefresh(r => r + 1); setBody(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Operace selhala."); }
    finally { setBusy(false); }
  }
  if (state.loading) return <LoadingState />;
  if (!state.data || state.error) return <ErrorState message={state.error ?? "Žádost neexistuje."} />;
  const review = state.data;
  const pending = review.status === "pending";
  const mayReview = ["reviewer", "test_lead", "admin"].includes(user?.role ?? "") && user?.id !== review.submitted_by && !review.version.contributors.includes(user?.id ?? 0);
  const lead = ["admin", "test_lead"].includes(user?.role ?? "");
  const base = `/test-case-reviews/${review.id}`;
  return <div className="space-y-5">
    <Link className="text-cyan-700" to="/test-case-approvals">← Schvalovací fronta</Link>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{review.code} · verze {review.version_number}</h2><ApprovalStatusBadge state={review.status} /></header>
    <div className="flex flex-wrap gap-4 text-sm"><span>Autor: {review.author_name}</span><span>Reviewer: {review.reviewer_name ?? "Nepřiřazeno"}</span><Link className="text-cyan-700" to={`/test-cases/${review.test_case_id}`}>Detail a návrh test case</Link>{review.origin_run_id && <Link className="text-cyan-700" to={`/test-runs/${review.origin_run_id}/execution`}>Zdrojový run #{review.origin_run_id}</Link>}</div>
    <p className="rounded-md border border-slate-200 bg-white p-4">Důvod změny: {review.version.change_summary || "—"}</p>
    {review.decision_reason && <p className="rounded-md bg-amber-50 p-4">Rozhodnutí: {review.decision_reason}</p>}
    {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-rose-800">{error}</p>}
    <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-md border border-slate-200 bg-white p-5"><CaseSnapshotView content={review.version.content_snapshot} /></div><div className="space-y-3 rounded-md border border-slate-200 bg-white p-5"><h3 className="font-semibold">Změny vůči předchozí publikované verzi</h3>{review.changes.length === 0 && <p>Obsah se neliší.</p>}{review.changes.map(c => <details key={c.field} className="rounded-md border border-slate-200 p-3" open><summary className="break-all text-sm font-medium">{c.field}</summary><div className="mt-2 grid gap-2 md:grid-cols-2"><div><p className="text-xs text-slate-500">Před změnou</p><pre className="whitespace-pre-wrap break-words rounded-md bg-rose-50 p-2 text-xs">{display(c.before)}</pre></div><div><p className="text-xs text-slate-500">Návrh</p><pre className="whitespace-pre-wrap break-words rounded-md bg-emerald-50 p-2 text-xs">{display(c.after)}</pre></div></div></details>)}</div></section>
    <section className="space-y-3 rounded-md border border-slate-200 bg-white p-5"><h3 className="font-semibold">Připomínky</h3>{review.comments.map(c => <div className="rounded-md border border-slate-200 p-3" key={c.id}><p className="text-xs text-slate-500">Uživatel #{c.author_id} · {c.is_blocking ? "Blokující" : "Poznámka"} · {c.resolved_at ? "Vyřešeno" : "Otevřeno"} {c.field_path}</p><p className="whitespace-pre-wrap">{c.body}</p>{pending && !c.resolved_at && <button disabled={busy} className="mt-2 text-sm text-cyan-700" onClick={() => void mutate(`/test-case-review-comments/${c.id}/resolutions`, {})}>Označit jako vyřešené</button>}</div>)}
      {pending && <><label className="block text-sm">Připomínka<textarea className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" maxLength={10000} value={body} onChange={e => setBody(e.target.value)} /></label><label className="block text-sm">Ke změně<select className="ml-3 max-w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={field} onChange={e => setField(e.target.value)}><option value="">Celý scénář</option>{review.changes.map(c => <option key={c.field} value={c.field}>{c.field}</option>)}</select></label>{mayReview && <label className="block text-sm"><input type="checkbox" checked={blocking} onChange={e => setBlocking(e.target.checked)} /> Blokuje schválení</label>}<button disabled={busy || !body.trim()} className="rounded-md border border-slate-200 px-4 py-2 disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void mutate(`${base}/comments`, { body, is_blocking: blocking, field_path: field || null })}>Přidat připomínku</button></>}
    </section>
    {pending && <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      {mayReview && <><div className="flex flex-wrap gap-3">{!review.reviewer_id && <button disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void mutate(`${base}/assignment`, { lock_version: review.lock_version, reviewer_id: user!.id }, "PATCH")}>Převzít ke schválení</button>}{lead && <><select aria-label="Přiřadit reviewerovi" className="rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={reviewerId} onChange={e => setReviewerId(e.target.value)}><option value="">Vyberte reviewera</option>{users.data?.filter(u => ["reviewer", "test_lead", "admin"].includes(u.role) && u.id !== review.submitted_by).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><button disabled={busy || !reviewerId} onClick={() => void mutate(`${base}/assignment`, { lock_version: review.lock_version, reviewer_id: Number(reviewerId) }, "PATCH")}>Přiřadit</button></>}</div>
        <label className="block text-sm">Důvod rozhodnutí (povinný při vrácení nebo zamítnutí)<textarea className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={reason} maxLength={10000} onChange={e => setReason(e.target.value)} /></label>
        <div className="flex flex-wrap gap-3">{[["approved", "Schválit a publikovat"], ["changes_requested", "Vrátit k dopracování"], ["rejected", "Zamítnout"]].map(([status, label]) => <button key={status} disabled={busy || (!lead && review.reviewer_id !== user?.id) || (status !== "approved" && !reason.trim())} className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 ${status === "approved" ? "bg-cyan-700 text-white hover:bg-cyan-800" : status === "rejected" ? "border border-rose-200 text-rose-700 hover:bg-rose-50" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => void mutate(`${base}/decisions`, { lock_version: review.lock_version, status, reason })}>{label}</button>)}</div></>}
      {user?.id === review.submitted_by && <button disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void mutate(`${base}/withdrawals`, { lock_version: review.lock_version })}>Stáhnout žádost a upravit návrh</button>}
    </section>}
  </div>;
}
