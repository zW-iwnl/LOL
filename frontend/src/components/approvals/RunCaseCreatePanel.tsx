import { useState } from "react";
import { getTestSuites } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { createDraft, emptyContent, getDrafts, workflowMutation, type CaseDraft } from "../../api/testCaseWorkflow";
import { AccessibleDialog } from "../AccessibleDialog";
import { CaseDraftEditor } from "./CaseDraftEditor";

export function RunCaseCreatePanel({ runId, caseId, caseAttemptId, onClose, onExecuted }: {
  runId: number; caseId?: number; caseAttemptId?: number; onClose: () => void; onExecuted: () => void;
}) {
  const [draft, setDraft] = useState<CaseDraft | null>(null);
  const [suiteId, setSuiteId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const suites = useApiResource(getTestSuites, []);
  const proposals = useApiResource(() => getDrafts(caseId ? `case_id=${caseId}` : `origin_run_id=${runId}`), [caseId, runId]);
  async function create() {
    setBusy(true); setError("");
    try {
      setDraft(caseId ? await createDraft(caseId, undefined, caseAttemptId) :
        await workflowMutation<CaseDraft>(`/test-runs/${runId}/case-drafts`, { suite_id: Number(suiteId), content: { ...emptyContent(), title } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Vytvoření selhalo."); }
    finally { setBusy(false); }
  }
  return <AccessibleDialog title={caseId ? "Návrh změny scénáře v runu" : "Nový test case v tomto runu"} onClose={() => { if (!dirty || window.confirm("Zavřít editor a zahodit neuložené změny návrhu?")) onClose(); }} panelClassName="max-w-4xl">
    {draft ? <CaseDraftEditor key={draft.id} initial={draft} runId={draft.origin_run_id === runId ? runId : undefined} caseAttemptId={caseAttemptId} onSaved={onExecuted} onDirtyChange={setDirty} /> : <div className="space-y-4">
      <p className="text-sm text-slate-500">Návrh lze uložit, provést v tomto runu a následně odeslat nezávislému reviewerovi. Do ostatních runů se dostane až po schválení.</p>
      {(proposals.data?.items ?? []).map(d => <button type="button" key={d.id} className="block w-full rounded-md border border-slate-200 p-3 text-left" onClick={() => setDraft(d)}>Otevřít návrh {d.code} · {d.content.title} · {d.status}</button>)}
      {!caseId && <><label className="block text-sm">Test suita<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={suiteId} onChange={e => setSuiteId(e.target.value)}><option value="">Vyberte suitu</option>{suites.data?.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-sm">Název scénáře<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" maxLength={255} value={title} onChange={e => setTitle(e.target.value)} /></label></>}
      {(error || suites.error || proposals.error) && <p role="alert" className="text-rose-700">{error || suites.error || proposals.error}</p>}
      <button type="button" className="rounded-md bg-cyan-700 px-4 py-2 text-white disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-cyan-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" disabled={busy || (!caseId && (!title.trim() || !suiteId)) || Boolean(caseId && proposals.data?.items.length)} onClick={() => void create()}>{caseId ? "Založit návrh úpravy" : "Uložit nový návrh"}</button>
    </div>}
  </AccessibleDialog>;
}
