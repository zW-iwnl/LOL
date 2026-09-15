import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getDraft, saveDraft, submitDraft, workflowMutation, type CaseDraft } from "../../api/testCaseWorkflow";
import { useWorkspacePreference } from "../workspace/useWorkspacePreference";
import { withReturn } from "../workspace/navigation";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { CaseContentEditor } from "./CaseContentEditor";

export function CaseDraftEditor({ initial, onSaved, runId, caseAttemptId, onDirtyChange }: { initial: CaseDraft; onSaved?: () => void; runId?: number; caseAttemptId?: number; onDirtyChange?: (dirty: boolean) => void }) {
  const { user } = useAuth();
  const location = useLocation(); const mutationLock = useRef(false);
  const [stored, setStored] = useWorkspacePreference<{ content: CaseDraft["content"]; summary: string; revision: number } | null>(`caseDraftInput:${initial.id}`, null);
  const [conflict, setConflict] = useState(Boolean(stored && stored.revision !== initial.lock_version));
  const [draft, setDraft] = useState(initial);
  const [content, setContent] = useState(stored?.content ?? initial.content);
  const [summary, setSummary] = useState(stored?.summary ?? initial.change_summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState<number | null>(null);
  const editable = user?.id === draft.editor_id && draft.status === "open";
  const dirty = editable && (JSON.stringify(content) !== JSON.stringify(draft.content) || summary !== draft.change_summary);
  function editContent(value: CaseDraft["content"]) { setContent(value); setStored({ content: value, summary, revision: draft.lock_version }); }
  function editSummary(value: string) { setSummary(value); setStored({ content, summary: value, revision: draft.lock_version }); }
  async function reloadCurrent() {
    try { const current = await getDraft(draft.id); setDraft(current); setConflict(true); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Načtení selhalo."); }
  }
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  async function action(kind: "save" | "submit" | "execute" | "takeover") {
    if (mutationLock.current || conflict && kind !== "takeover") return;
    mutationLock.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      if (kind === "takeover") {
        const taken = await workflowMutation<CaseDraft>(`/test-case-drafts/${draft.id}/takeovers`, { lock_version: draft.lock_version });
        setDraft(taken); setContent(taken.content); setSummary(taken.change_summary); setStored(null); setConflict(false); setMessage("Návrh jste převzali."); return;
      }
      const saved = editable ? await saveDraft(draft, content, summary) : draft;
      setDraft(saved); setStored(null); setConflict(false);
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
    finally { mutationLock.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Návrh {draft.code} · revize {draft.lock_version}</h3><ApprovalStatusBadge state={draft.status} /></div>
    {draft.origin_run_id && <Link className="text-sm text-cyan-700" to={`/test-runs/${draft.origin_run_id}/execution`}>Zdrojový run #{draft.origin_run_id}</Link>}
    {!editable && <p className="rounded-md bg-amber-50 p-3 text-sm">{draft.status === "submitted" ? "Návrh je uzamčený do rozhodnutí nebo stažení žádosti." : `Návrh upravuje uživatel #${draft.editor_id}.`}</p>}
    {conflict && <div role="alert" className="rounded bg-amber-50 p-3 text-sm">Na serveru je novější revize. Rozepsaný obsah zůstal zachovaný; před dalším uložením zkontrolujte rozdíly.<details className="mt-2"><summary>Aktuální obsah na serveru</summary><div className="mt-2"><CaseContentEditor value={draft.content} onChange={() => undefined} disabled /></div></details><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="workspace-button" disabled={busy} onClick={() => { setConflict(false); setStored({ content, summary, revision: draft.lock_version }); }}>Zkontrolováno, ponechat moje změny</button><button type="button" className="workspace-button" disabled={busy} onClick={() => { setContent(draft.content); setSummary(draft.change_summary); setStored(null); setConflict(false); }}>Použít obsah serveru</button></div></div>}
    <p className="text-xs text-slate-500">{dirty ? "Rozepsané změny jsou zachované v této kartě prohlížeče; na serveru zatím nejsou uložené." : "Návrh odpovídá uloženému stavu."}</p>
    <CaseContentEditor value={content} onChange={editContent} disabled={!editable || busy} />
    <label className="block text-sm">Důvod změny / zavedení scénáře<textarea disabled={!editable || busy} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" maxLength={5000} value={summary} onChange={e => editSummary(e.target.value)} /></label>
    {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-rose-800">{error} <button type="button" className="underline" onClick={() => void reloadCurrent()}>Načíst aktuální stav bez ztráty textu</button></p>}
    {message && <p role="status" className="rounded-md bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    <div className="flex flex-wrap gap-3">
      {editable && <><button type="button" disabled={busy || conflict} className="rounded-md border border-slate-200 px-4 py-2 disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("save")}>Uložit návrh</button>
        <button type="button" disabled={busy || conflict || !summary.trim()} className="rounded-md bg-cyan-700 px-4 py-2 text-white disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-cyan-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("submit")}>Odeslat ke schválení</button></>}
      {runId && user?.id === draft.editor_id && draft.status !== "closed" && <button type="button" disabled={busy} className="rounded-md border border-cyan-700 px-4 py-2 text-cyan-800 disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("execute")}>{caseAttemptId ? "Provést upravenou verzi" : "Přidat a provést"}</button>}
      {draft.status === "open" && !editable && ["admin", "test_lead"].includes(user?.role ?? "") && <button type="button" disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void action("takeover")}>Převzít editaci návrhu</button>}
      <Link className="self-center text-cyan-700" to={withReturn(reviewId ? `/test-case-approvals/${reviewId}` : `/test-case-approvals?q=${encodeURIComponent(draft.code)}`, runId ? `/test-runs/${runId}/execution?caseAttempt=${caseAttemptId ?? ""}&attempt=${draft.origin_run_attempt_id ?? ""}` : location.pathname + location.search)}>Otevřít schvalování</Link>
    </div>
  </div>;
}
