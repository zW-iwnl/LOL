import { useState } from "react";
import { FileCheck2, FileEdit, History } from "lucide-react";
import { WorkflowTabs } from "../components/approvals/WorkflowTabs";
import { Link, useParams } from "react-router-dom";
import { getTestCase } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { createDraft, getDrafts, type CaseDraft } from "../api/testCaseWorkflow";
import { CaseDraftEditor } from "../components/approvals/CaseDraftEditor";
import { TestCaseVersionHistory } from "../components/approvals/TestCaseVersionHistory";
import { CaseSnapshotView } from "../components/approvals/CaseSnapshotView";
import { useAuth } from "../auth/AuthContext";

export function TestCaseDetailPage() {
  const { testCaseId } = useParams();
  const caseId = Number(testCaseId);
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState("draft");
  const [created, setCreated] = useState<CaseDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useApiResource(() => getTestCase(caseId), [caseId, refresh]);
  const drafts = useApiResource(() => getDrafts(`case_id=${caseId}`), [caseId, refresh]);
  const caseItem = state.data;
  async function propose(versionId?: number) {
    setBusy(true); setError("");
    try { setCreated(await createDraft(caseId, versionId)); setTab("draft"); }
    catch (e) { setError(e instanceof Error ? e.message : "Návrh se nepodařilo vytvořit."); }
    finally { setBusy(false); }
  }
  if (state.loading || drafts.loading) return <LoadingState />;
  if (!caseItem || state.error || drafts.error) return <ErrorState message={state.error ?? drafts.error ?? "Test case neexistuje."} />;
  const draft = created ?? drafts.data?.items[0];
  const archived = caseItem.status === "deprecated";
  return <div className="space-y-5">
    <Link className="text-sm text-cyan-700" to="/test-cases">← Zpět do Repository</Link>
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-semibold">{caseItem.code} · {caseItem.title}</h2><p className="text-sm text-slate-500">{archived ? "Archivovaný scénář" : caseItem.current_approved_version_id ? `Publikovaná verze ${caseItem.version}` : "Dosud nemá schválenou verzi"}</p></div><Link className="text-cyan-700" to={`/test-case-approvals?q=${encodeURIComponent(caseItem.code)}`}>Schvalování tohoto scénáře</Link></header>
    <WorkflowTabs label="Sekce test case" value={tab} onChange={setTab} tabs={[
      { id: "published", label: "Publikovaný obsah", icon: FileCheck2 },
      { id: "draft", label: "Návrh změny", icon: FileEdit },
      { id: "versions", label: "Historie verzí", icon: History },
    ]} />
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {tab === "draft" && <section className="rounded-md border border-slate-200 bg-white p-5">{draft ? <CaseDraftEditor key={`${draft.id}:${refresh}`} initial={draft} onSaved={() => setRefresh(n => n + 1)} /> : <div className="space-y-3"><p>Úpravy vytvoří návrh nové verze. Publikovaný obsah ani existující provedení se nezmění.</p><button disabled={busy || archived} className="rounded-md bg-cyan-700 px-4 py-2 text-white disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-cyan-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void propose()}>Navrhnout novou verzi</button></div>}{draft && user?.id !== draft.editor_id && <p className="mt-3 text-sm text-slate-500">Otevřená větev má jednoho editora. Vedoucí může editaci explicitně převzít.</p>}</section>}
    {tab === "published" && <section className="rounded-md border border-slate-200 bg-white p-5">{caseItem.current_approved_version_id ? <CaseSnapshotView content={{ ...caseItem, steps: caseItem.steps.map(s => ({ ...s, step_key: String(s.id) })) }} /> : <p>Scénář se dostane do běžné nabídky pro runy až po schválení. Rozpracovaný obsah najdete v návrhu.</p>}</section>}
    {tab === "versions" && <TestCaseVersionHistory caseId={caseId} publishedId={caseItem.current_approved_version_id ?? null} onRestore={!draft && !archived ? id => void propose(id) : undefined} />}
  </div>;
}
