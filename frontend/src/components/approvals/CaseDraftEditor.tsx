import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { saveDraft, submitDraft, workflowMutation, type CaseDraft } from "../../api/testCaseWorkflow";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { CaseContentEditor } from "./CaseContentEditor";

export function CaseDraftEditor({ initial, onSaved, runId, caseAttemptId, onDirtyChange }: { initial: CaseDraft; onSaved?: () => void; runId?: number; caseAttemptId?: number; onDirtyChange?: (dirty: boolean) => void }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState(initial);
  const [content, setContent] = useState(initial.content);
  const [summary, setSummary] = useState(initial.change_summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const editable = user?.id === draft.editor_id && draft.status === "open";
  const dirty = editable && (JSON.stringify(content) !== JSON.stringify(draft.content) || summary !== draft.change_summary);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  async function action(kind: "save" | "submit" | "execute" | "takeover") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (kind === "takeover") {
        const taken = await workflowMutation<CaseDraft>(`/test-case-drafts/${draft.id}/takeovers`, { lock_version: draft.lock_version });
        setDraft(taken); setMessage("Návrh jste převzali."); return;
      }
      const saved = editable ? await saveDraft(draft, content, summary) : draft;
      setDraft(saved);
      if (kind === "submit") {
        const review = await submitDraft(saved, summary);
        setReviewId(review.id); setDraft({ ...saved, status: "submitted", lock_version: saved.lock_version + 1 });
        setMessage("Verze byla odeslána do schvalovací fronty.");
      } else if (kind === "execute" && runId) {
        if (caseAttemptId) {
          await workflowMutation(`/test-run-case-attempts/${caseAttemptId}/reruns`, { draft_id: saved.id, lock_version: saved.lock_version });
          setMessage("Upravená verze má nový pokus. Původní výsledky zůstaly zachované.");
        } else {
          await workflowMutation(`/test-runs/${runId}/draft-executions`, { draft_id: saved.id, lock_version: saved.lock_version });
          setMessage("Rozsah runu rozšířen o 1 test.");
        }
        onSaved?.();
      } else { setMessage("Návrh uložen. Uložení nemění publikovanou verzi."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Operace selhala."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Návrh {draft.code} · revize {draft.lock_version}</h3><ApprovalStatusBadge state={draft.status} /></div>
    {draft.origin_run_id && <Link className="text-sm text-cyan-700" to={`/test-runs/${draft.origin_run_id}/execution`}>Zdrojový run #{draft.origin_run_id}</Link>}
    {!editable && <p className="rounded-md bg-amber-50 p-3 text-sm">{draft.status === "submitted" ? "Návrh je uzamčený do rozhodnutí nebo stažení žádosti." : `Návrh upravuje uživatel #${draft.editor_id}.`}</p>}
    <CaseContentEditor value={content} onChange={setContent} disabled={!editable || busy} />
    <label className="block text-sm">Důvod změny / zavedení scénáře<textarea disabled={!editable || busy} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" maxLength={5000} value={summary} onChange={e => setSummary(e.target.value)} /></label>
    {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-rose-800">{error} Při konfliktu obnovte detail; rozepsaný text si nejprve zkopírujte.</p>}
    {message && <p role="status" className="rounded-md bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    <div className="flex flex-wrap gap-3">
      {editable && <><button type="button" disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("save")}>Uložit návrh</button>
        <button type="button" disabled={busy || !summary.trim()} className="rounded-md bg-cyan-700 px-4 py-2 text-white disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-cyan-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("submit")}>Odeslat ke schválení</button></>}
      {runId && user?.id === draft.editor_id && draft.status !== "closed" && <button type="button" disabled={busy} className="rounded-md border border-cyan-700 px-4 py-2 text-cyan-800 disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("execute")}>{caseAttemptId ? "Provést upravenou verzi" : "Přidat a provést"}</button>}
      {draft.status === "open" && !editable && ["admin", "test_lead"].includes(user?.role ?? "") && <button type="button" disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("takeover")}>Převzít editaci návrhu</button>}
      <Link className="self-center text-cyan-700" to={reviewId ? `/test-case-approvals/${reviewId}` : `/test-case-approvals?q=${encodeURIComponent(draft.code)}`}>Otevřít schvalování</Link>
    </div>
  </div>;
}
