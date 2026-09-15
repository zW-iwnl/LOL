import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getDraftSummaries, getReviews, type DraftSummary, type Page, type Review } from "../../api/testCaseWorkflow";
import { useApiResource } from "../../api/hooks";
import { useWorkspacePreference } from "../workspace/useWorkspacePreference";
import { VirtualList } from "../workspace/VirtualList";
import { Pagination, WorkspacePanels } from "../workspace/Workspace";
import { safeReturn, withReturn } from "../workspace/navigation";
import { useDebounced } from "../workspace/useDebounced";
import { ApprovalStatusBadge } from "./ApprovalStatusBadge";
import { ApprovalFilters } from "./ApprovalFilters";
import { ReviewDetailPanel } from "./ReviewDetailPanel";
const tabs = [["queue", "Ke schválení"], ["mine", "Moje žádosti"], ["drafts", "Rozpracované návrhy"], ["history", "Historie rozhodnutí"]];
export function ApprovalWorkspace() {
  const [params, setParams] = useSearchParams(); const { reviewId } = useParams(); const navigate = useNavigate(); const location = useLocation();
  const tab = tabs.some(([id]) => id === params.get("tab")) ? params.get("tab")! : "queue";
  const offset = Math.max(0, Number(params.get("offset")) || 0); const limit = [25, 50, 100].includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 50;
  const [refresh, setRefresh] = useState(0); const [queries, setQueries] = useWorkspacePreference<Record<string, string>>("approvalQueries", {});
  const [navOpen, setNavOpen] = useWorkspacePreference("approvalNavigation", true); const [width, setWidth] = useWorkspacePreference("approvalWidth", 330);
  const [mobileDetail, setMobileDetail] = useState(Boolean(reviewId)); const [completed, setCompleted] = useState(false);
  const q = useDebounced(params.get("q") ?? "");
  const query = new URLSearchParams(params); ["tab", "review", "returnTo"].forEach(key => query.delete(key));
  query.set("q", q); query.set("offset", String(offset)); query.set("limit", String(limit));
  if (tab === "queue") query.set("status", "pending");
  if (tab === "mine") { query.set("mine", "true"); query.delete("assigned_to_me"); }
  if (tab === "history") { query.set("decided", "true"); if (query.get("status") === "pending") query.delete("status"); }
  const queryString = query.toString();
  const state = useApiResource<Page<Review | DraftSummary>>(() => tab === "drafts" ? getDraftSummaries(queryString) : getReviews(queryString), [tab, queryString, refresh]);
  const items = state.data?.items ?? []; const total = state.data?.total ?? 0;
  const chosen = completed || tab === "drafts" ? null : Number(reviewId ?? params.get("review")) || items[0]?.id || null;
  const selectionRef = useRef(chosen); selectionRef.current = chosen;
  useEffect(() => { if (!state.loading && state.data && offset > 0 && offset >= total) { const next = new URLSearchParams(params); next.set("offset", String(Math.max(0, Math.ceil(total / limit) - 1) * limit)); setParams(next, { replace: true }); } }, [state.loading, state.data, offset, total, limit]);
  function update(key: string, values: string[]) {
    const next = new URLSearchParams(params); next.delete(key); next.delete("offset");
    if (key === "assignment") { next.delete("assigned_to_me"); next.delete("unassigned"); if (values[0] !== "all") next.set(values[0], "true"); }
    else values.filter(Boolean).forEach(value => next.append(key, value));
    setCompleted(false); setParams(next, { replace: true });
  }
  function select(id: number) {
    setCompleted(false); setMobileDetail(true);
    const next = new URLSearchParams(params); next.delete("review"); navigate(`/test-case-approvals/${id}?${next}`, { replace: true });
  }
  async function changed(id: number, next: boolean) {
    setRefresh(value => value + 1);
    if (!next || selectionRef.current !== id) return;
    const index = Math.max(0, items.findIndex(item => item.id === id));
    const data = await getReviews(queryString);
    if (selectionRef.current !== id) return;
    const available = data.items.filter(item => item.id !== id);
    const target = available[index] ?? available[0];
    if (target) select(target.id);
    else { setCompleted(true); navigate(`/test-case-approvals?${params}`, { replace: true }); }
  }
  return <div className={`workspace-page approval-workspace ${mobileDetail ? "approval-show-detail" : "approval-show-list"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-base font-semibold">Schvalování test cases</h1>{params.get("returnTo") && <button type="button" className="workspace-button" onClick={() => navigate(safeReturn(params.get("returnTo"), "/test-cases"))}>Zpět na předchozí práci</button>}</div>
    <nav role="tablist" aria-label="Schvalovací fronty" className="flex flex-wrap gap-1">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`workspace-button ${tab === id ? "workspace-active-tab" : ""}`} onClick={() => {
      setQueries({ ...queries, [tab]: params.toString() }); const next = new URLSearchParams(queries[id] ?? ""); next.set("tab", id); next.delete("review"); setCompleted(false); setMobileDetail(false); navigate(`/test-case-approvals?${next}`);
    }}>{label}</button>)}</nav>
    <ApprovalFilters params={params} tab={tab} onChange={update} />
    <div className="flex items-center gap-3 text-xs"><button type="button" className="workspace-button hidden lg:inline-flex" onClick={() => setNavOpen(!navOpen)}>{navOpen ? "Skrýt frontu" : "Zobrazit frontu"}</button><button type="button" className="workspace-button lg:hidden" onClick={() => setMobileDetail(!mobileDetail)}>{mobileDetail ? "Zpět na seznam" : "Zobrazit detail"}</button><label className="workspace-width-control">Šířka fronty <input type="range" aria-label="Šířka fronty" min={280} max={440} step={10} value={width} onChange={e => setWidth(Number(e.target.value))} /></label><span>{total} položek</span></div>
    <WorkspacePanels width={width} navigation={navOpen || !mobileDetail ? <aside className={`workspace-navigation ${!navOpen ? "lg:!hidden" : ""}`} aria-label="Schvalovací fronta">
      {state.error && <p role="alert" className="p-2 text-sm text-rose-700">{state.error}<button type="button" className="underline ml-2" onClick={() => setRefresh(value => value + 1)}>Zkusit znovu</button></p>}{state.loading && <p role="status" className="p-2 text-xs">Načítám frontu…</p>}
      <VirtualList items={items} itemKey={item => item.id} rowHeight={84} label="Žádosti a návrhy" storageKey={`approval-scroll:${tab}:${offset}`} render={item => <button type="button" data-focus-target disabled={state.loading} className={`approval-queue-row ${chosen === item.id ? "is-selected" : ""}`} aria-current={chosen === item.id ? "true" : undefined} onClick={() => tab === "drafts" ? navigate(withReturn(`/test-cases/${item.test_case_id}?tab=draft`, location.pathname + location.search)) : select(item.id)}>
        <span className="flex items-center justify-between gap-1"><strong className="text-cyan-800">{item.code}{"version_number" in item ? ` · v${item.version_number}` : ""}</strong><ApprovalStatusBadge state={item.status} /></span><span className="block truncate">{item.title}</span><span className="block truncate text-[11px] text-slate-500">{"editor_name" in item ? item.editor_name : `${item.author_name} → ${item.reviewer_name ?? "Nepřiřazeno"}`}</span><span className="block text-[10px] text-slate-500">{new Date("updated_at" in item ? item.updated_at : item.created_at).toLocaleDateString("cs-CZ")}{"blocking_count" in item && item.blocking_count ? ` · ${item.blocking_count} blokujících` : ""}</span>
      </button>} />
      <Pagination total={total} offset={offset} limit={limit} busy={state.loading} onChange={value => { const next = new URLSearchParams(params); next.set("offset", String(value)); setParams(next); }} onLimit={value => update("limit", [String(value)])} />
    </aside> : undefined}>
      {chosen && Number.isSafeInteger(chosen) && chosen > 0 ? <ReviewDetailPanel key={chosen} reviewId={chosen} onChanged={changed} /> : <section className="workspace-detail p-4 text-sm text-slate-500">{completed ? "V této části fronty už není další žádost. Můžete změnit filtr nebo pokračovat na jiné stránce." : tab === "drafts" ? "Vyberte rozpracovaný návrh a pokračujte v editoru." : state.loading ? "Načítám…" : "Fronta je prázdná. Změňte filtr nebo přejděte na další frontu."}</section>}
    </WorkspacePanels>
  </div>;
}
