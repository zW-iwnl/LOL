import { useState } from "react";
import { getVersions, type CaseVersion } from "../../api/testCaseWorkflow";
import { useApiResource } from "../../api/hooks";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { CaseSnapshotView } from "./CaseSnapshotView";

export function TestCaseVersionHistory({ caseId, publishedId, onRestore }: { caseId: number; publishedId: number | null; onRestore?: (id: number) => void }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<CaseVersion | null>(null);
  const state = useApiResource(() => getVersions(caseId, offset), [caseId, offset]);
  return <div className="space-y-4">
    {state.error && <p role="alert" className="text-rose-700">{state.error}</p>}
    {state.data?.items.map(v => <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-4"><button type="button" className="font-medium text-cyan-700" onClick={() => setSelected(v)}>Verze {v.version_number}</button><ApprovalStatusBadge state={v.approval_state} /><span className="text-sm">{v.id === publishedId ? "Aktuální publikovaná" : "Historická"} · {new Date(v.created_at).toLocaleString("cs-CZ")}</span>{onRestore && <button type="button" className="ml-auto text-sm text-cyan-700" onClick={() => onRestore(v.id)}>Navrhnout obnovu této verze</button>}</div>)}
    {!state.loading && state.data?.total === 0 && <p className="text-slate-500">Žádná zmrazená verze. Vznikne při odeslání nebo provedení návrhu.</p>}
    <div className="flex gap-3"><button disabled={offset === 0} onClick={() => setOffset(offset - 50)} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">Předchozí</button><button disabled={offset + 50 >= (state.data?.total ?? 0)} onClick={() => setOffset(offset + 50)} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">Další</button></div>
    {selected && <section className="rounded-md border border-slate-200 bg-white p-4"><p className="mb-3 text-sm text-slate-500">Neměnný obsah verze {selected.version_number}</p><CaseSnapshotView content={selected.content_snapshot} /></section>}
  </div>;
}
