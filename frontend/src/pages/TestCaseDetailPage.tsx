import { useState } from "react";
import { FileCheck2, FileEdit, History } from "lucide-react";
import { WorkflowTabs } from "../components/approvals/WorkflowTabs";
import { safeReturn, withReturn } from "../components/workspace/navigation";
import { Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import { getTestCase } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { createDraft, getDrafts, getReviews, type CaseDraft } from "../api/testCaseWorkflow";
import { CaseDraftEditor } from "../components/approvals/CaseDraftEditor";
import { TestCaseVersionHistory } from "../components/approvals/TestCaseVersionHistory";
import { CaseSnapshotView } from "../components/approvals/CaseSnapshotView";
import { useAuth } from "../auth/AuthContext";

export function TestCaseDetailPage() {
  const { testCaseId } = useParams();
  return <TestCaseDetail key={testCaseId} />;
}

function TestCaseDetail() {
  const [params, setParams] = useSearchParams(); const location = useLocation();
  const { testCaseId } = useParams();
  const caseId = Number(testCaseId);
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [requestedTab, setRequestedTab] = useState<string | null>(params.get("tab"));
  function setTab(value: string) { setRequestedTab(value); const next = new URLSearchParams(params); next.set("tab", value); setParams(next, { replace: true }); }
  const [created, setCreated] = useState<CaseDraft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useApiResource(() => getTestCase(caseId), [caseId, refresh]);
  const drafts = useApiResource(() => getDrafts(`case_id=${caseId}`), [caseId, refresh]);
  const returned = useApiResource(() => getReviews(`case_id=${caseId}&decided=true&limit=1`), [caseId, refresh]);
  const caseItem = state.data;
  const tab = requestedTab ?? (caseItem?.current_approved_version_id ? "published" : "draft");
  async function propose(versionId?: number) {
    setBusy(true); setError("");
    try { setCreated(await createDraft(caseId, versionId)); setTab("draft"); }
    catch (e) { setError(e instanceof Error ? e.message : "Návrh se nepodařilo vytvořit."); }
    finally { setBusy(false); }
  }
  if ((!state.data && state.loading) || (!drafts.data && drafts.loading)) return <LoadingState />;
  if (!caseItem || state.error || drafts.error) return <ErrorState message={state.error ?? drafts.error ?? "Test case neexistuje."} />;
  const draft = created ?? drafts.data?.items[0];
  const archived = caseItem.status === "deprecated";
  return <div className="workspace-page">
    <Link className="text-sm text-link" to={safeReturn(params.get("returnTo"), "/test-cases")}>{params.has("returnTo") ? "← Zpět na předchozí práci" : "← Zpět do Repository"}</Link>
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-semibold">{caseItem.code} · {caseItem.title}</h2><p className="text-sm text-muted">{archived ? "Archivovaný scénář" : caseItem.current_approved_version_id ? `Publikovaná verze ${caseItem.version}` : "Dosud nemá schválenou verzi"}</p></div><Link className="text-link" to={withReturn(`/test-case-approvals?q=${encodeURIComponent(caseItem.code)}`, location.pathname + location.search)}>Schvalování tohoto scénáře</Link></header>
    <WorkflowTabs label="Sekce test case" value={tab} onChange={setTab} tabs={[
      { id: "published", label: "Publikovaný obsah", icon: FileCheck2 },
      { id: "draft", label: "Návrh změny", icon: FileEdit },
      { id: "versions", label: "Historie verzí", icon: History },
    ]} />
    {error && <p role="alert" className="text-danger">{error}</p>}
    <div className="workspace-scroll">
    {tab === "draft" && <section className="rounded-md border border-border bg-surface p-3">{returned.data?.items.filter(review => draft?.status === "open" && review.test_case_id === caseId && review.status === "changes_requested").slice(0, 1).map(review => <div key={review.id} className="mb-3 rounded bg-warning-bg p-3 text-sm"><p className="font-medium">Vráceno k dopracování</p><p className="whitespace-pre-wrap">{review.decision_reason}</p><Link className="text-link underline" to={withReturn(`/test-case-approvals/${review.id}`, location.pathname + location.search)}>Otevřít připomínky a rozhodnutí</Link></div>)}{draft ? <CaseDraftEditor key={`${draft.id}:${refresh}`} initial={draft} onSaved={() => setRefresh(n => n + 1)} /> : <div className="space-y-3"><p>Úpravy vytvoří návrh nové verze. Publikovaný obsah ani existující provedení se nezmění.</p><button disabled={busy || archived} className="rounded-md bg-accent px-4 py-2 text-on-accent disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-accent-hover disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => void propose()}>Navrhnout novou verzi</button></div>}{draft && user?.id !== draft.editor_id && <p className="mt-3 text-sm text-muted">Otevřená větev má jednoho editora. Vedoucí může editaci explicitně převzít.</p>}</section>}
    {tab === "published" && <section className="rounded-md border border-border bg-surface p-5">{caseItem.current_approved_version_id ? <CaseSnapshotView content={{ ...caseItem, steps: caseItem.steps.map(s => ({ ...s, step_key: String(s.id) })) }} /> : <p>Scénář se dostane do běžné nabídky pro runy až po schválení. Rozpracovaný obsah najdete v návrhu.</p>}</section>}
    {tab === "versions" && <TestCaseVersionHistory caseId={caseId} publishedId={caseItem.current_approved_version_id ?? null} onRestore={!draft && !archived ? id => void propose(id) : undefined} />}
    </div>
  </div>;
}
