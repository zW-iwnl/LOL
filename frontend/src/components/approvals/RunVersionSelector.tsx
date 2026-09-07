import { useState } from "react";
import { request } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { getVersions, workflowMutation, type CaseVersion } from "../../api/testCaseWorkflow";
import { AccessibleDialog } from "../AccessibleDialog";
import { CaseSnapshotView } from "./CaseSnapshotView";

export function RunVersionSelector({ caseId, attemptId, currentVersionId, onClose, onExecuted }: {
  caseId: number; attemptId: number; currentVersionId: number | null; onClose: () => void; onExecuted: () => void;
}) {
  const versions = useApiResource(() => getVersions(caseId), [caseId]);
  const [selected, setSelected] = useState<CaseVersion | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changes = useApiResource(() => selected && currentVersionId ? request<{ field: string; before: unknown; after: unknown }[]>(`/test-case-versions/${selected.id}/diff?base_version_id=${currentVersionId}`) : Promise.resolve([]), [selected?.id, currentVersionId]);
  async function execute() {
    if (!selected) return;
    setBusy(true); setError("");
    try { await workflowMutation(`/test-run-case-attempts/${attemptId}/reruns`, { version_id: selected.id }); onExecuted(); }
    catch (e) { setError(e instanceof Error ? e.message : "Nový pokus se nepodařilo vytvořit."); }
    finally { setBusy(false); }
  }
  return <AccessibleDialog title="Nový pokus nad schválenou verzí" onClose={onClose} panelClassName="max-w-4xl"><div className="space-y-4">
    <p className="text-sm">Původní pokus zůstane zachovaný. Nový pokus začne se všemi výsledky nevyhodnoceno.</p>
    <select aria-label="Schválená verze" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={selected?.id ?? ""} onChange={e => setSelected(versions.data?.items.find(v => v.id === Number(e.target.value)) ?? null)}><option value="">Vyberte verzi</option>{versions.data?.items.filter(v => ["approved", "legacy_import"].includes(v.approval_state)).map(v => <option key={v.id} value={v.id}>Verze {v.version_number} · {v.content_snapshot.title}</option>)}</select>
    {(versions.error || changes.error || error) && <p role="alert" className="text-rose-700">{versions.error || changes.error || error}</p>}
    {selected && <><CaseSnapshotView content={selected.content_snapshot} /><details><summary>Porovnání s prováděnou verzí</summary>{currentVersionId ? changes.data?.map(c => <div className="my-2 rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" key={c.field}><strong>{c.field}</strong><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify({ před: c.before, po: c.after }, null, 2)}</pre></div>) : <p>Legacy provedení nemá doložený odkaz na obsahovou verzi; porovnejte s jeho historickým snapshotem.</p>}</details></>}
    <button disabled={!selected || busy || changes.loading || Boolean(changes.error)} className="rounded-md bg-cyan-700 px-4 py-2 text-white disabled:opacity-50 text-sm min-h-11 font-medium transition hover:bg-cyan-800 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => void execute()}>Potvrdit verzi a založit nový pokus</button>
  </div></AccessibleDialog>;
}
