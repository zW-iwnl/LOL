import { ClipboardCheck, FileEdit, History, Inbox } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { WorkflowTabs } from "../components/approvals/WorkflowTabs";
import { Link, useSearchParams } from "react-router-dom";
import { getTestCaseTags } from "../api/client";
import { useApiResource } from "../api/hooks";
import { getDrafts, getReviews } from "../api/testCaseWorkflow";
import { ApprovalStatusBadge } from "../components/approvals/ApprovalStatusBadge";
import { MultiTagSelect } from "../components/TestCaseTags";

export function TestCaseApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "queue";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const query = new URLSearchParams(params);
  query.delete("tab");
  if (!query.has("status") && tab === "queue") query.set("status", "pending");
  if (tab === "mine") query.set("mine", "true");
  if (tab === "history") query.set("decided", "true");
  const state = useApiResource(() => getReviews(query.toString()), [query.toString()]);
  const drafts = useApiResource(() => getDrafts(`offset=${offset}&mine=${tab === "mine"}${params.get("origin_run_id") ? `&origin_run_id=${params.get("origin_run_id")}` : ""}`), [offset, tab, params.get("origin_run_id")]);
  const tags = useApiResource(getTestCaseTags, []);
  function update(key: string, values: string[]) {
    const next = new URLSearchParams(params); next.delete(key); next.delete("offset");
    for (const value of values) if (value || key === "status") next.append(key, value);
    setParams(next, { replace: true });
  }
  const total = tab === "drafts" ? drafts.data?.total ?? 0 : state.data?.total ?? 0;
  return <div className="space-y-6">
    <PageHeader title="Schvalování test cases" description="Posuzujte přesnou verzi scénáře. Schválení definice je nezávislé na výsledku testování." />
    <WorkflowTabs label="Schvalovací fronty" value={tab} tabs={[
      { id: "queue", label: "Ke schválení", icon: Inbox },
      { id: "mine", label: "Moje žádosti", icon: ClipboardCheck },
      { id: "drafts", label: "Rozpracované návrhy", icon: FileEdit },
      { id: "history", label: "Historie rozhodnutí", icon: History },
    ]} onChange={key => { const next = new URLSearchParams(params); next.set("tab", key); next.delete("status"); next.delete("offset"); setParams(next); }} />
    {tab !== "drafts" && <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap gap-3"><label className="grow text-sm">Kód nebo název<input type="search" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={params.get("q") ?? ""} onChange={e => update("q", [e.target.value])} /></label>
        <label className="text-sm">Stav<select className="mt-1 block rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={params.get("status") ?? (tab === "queue" ? "pending" : "")} onChange={e => update("status", [e.target.value])}><option value="">Všechny stavy</option>{[["pending", "Ke schválení"], ["approved", "Schváleno"], ["changes_requested", "K dopracování"], ["rejected", "Zamítnuto"], ["withdrawn", "Staženo"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="self-end pb-2 text-sm"><input type="checkbox" checked={params.get("unassigned") === "true"} onChange={e => update("unassigned", [e.target.checked ? "true" : ""])} /> Jen nepřiřazené</label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">{([["business_area", "Business oblast"], ["application_domain", "Aplikace/doména"], ["object_type", "Objekt"]] as const).map(([category, label]) => <MultiTagSelect key={category} label={label} tags={(tags.data ?? []).filter(t => t.category === category)} values={params.getAll(`${category}_id`).map(Number)} onChange={ids => update(`${category}_id`, ids.map(String))} />)}</div>
    </section>}
    <label className="block text-sm">Zdrojový run (ID)<input type="number" min={1} className="ml-3 w-32 rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={params.get("origin_run_id") ?? ""} onChange={e => update("origin_run_id", [e.target.value])} /></label>
    {(state.error || drafts.error || tags.error) && <p role="alert" className="text-rose-700">{state.error || drafts.error || tags.error}</p>}
    <p className="text-sm text-slate-500">{total} položek odpovídá výběru</p>
    {tab === "drafts" ? <div className="space-y-2">{drafts.data?.items.map(d => <Link key={d.id} className="flex flex-wrap justify-between gap-3 rounded-md border border-slate-200 bg-white p-4" to={`/test-cases/${d.test_case_id}`}><span>{d.code} · {d.content.title}</span><span>Editor #{d.editor_id} {d.origin_run_id ? `· Run #${d.origin_run_id}` : ""} <ApprovalStatusBadge state={d.status} /></span></Link>)}</div> :
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Scénář / verze", "Stav", "Autor", "Reviewer", "Původ", "Odesláno"].map(h => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{state.data?.items.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link className="font-medium text-cyan-700" to={`/test-case-approvals/${r.id}`}>{r.code} · v{r.version_number}<span className="block font-normal">{r.title}</span></Link></td><td className="px-4 py-3"><ApprovalStatusBadge state={r.status} /></td><td className="px-4 py-3">{r.author_name}</td><td className="px-4 py-3">{r.reviewer_name ?? "Nepřiřazeno"}</td><td className="px-4 py-3">{r.origin_run_id ? <Link className="text-cyan-700" to={`/test-runs/${r.origin_run_id}/execution`}>Run #{r.origin_run_id}</Link> : "Repository"}</td><td className="px-4 py-3">{new Date(r.created_at).toLocaleString("cs-CZ")}</td></tr>)}</tbody></table></div>}
    {!state.loading && !drafts.loading && total === 0 && <p className="rounded-md bg-white p-5 text-slate-500">Výběru neodpovídá žádná položka.</p>}
    <div className="flex gap-3"><button disabled={offset === 0} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { const p = new URLSearchParams(params); p.set("offset", String(Math.max(0, offset - 50))); setParams(p); }}>Předchozí</button><button disabled={offset + 50 >= total} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { const p = new URLSearchParams(params); p.set("offset", String(offset + 50)); setParams(p); }}>Další</button></div>
  </div>;
}
