import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { WorkspacePanels } from "../workspace/Workspace";
import { useWorkspacePreference } from "../workspace/useWorkspacePreference";
import { TestRunCreatePanel } from "./TestRunCreatePanel";
import { TestRunNavigator } from "./TestRunNavigator";
import { TestRunDetailPanel } from "./TestRunDetailPanel";
import { useTestRunsWorkspace } from "./useTestRunsWorkspace";

export function TestRunsWorkspace() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [remembered, remember] = useWorkspacePreference<number | null>("selectedRun", null);
  const [collapsed, setCollapsed] = useWorkspacePreference("runsNavigationCollapsed", false);
  const rawId = params.has("run") ? params.get("run") : remembered;
  const runId = rawId && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const invalidId = Boolean(rawId && !runId);
  const createOpen = params.get("new") === "1" || (location.state as { openCreateRun?: boolean } | null)?.openCreateRun === true;
  const data = useTestRunsWorkspace(runId);
  const dirtyRef = useRef(false);
  const [dirty, setDirtyState] = useState(false);
  const [notice, setNotice] = useState("");
  const newButton = useRef<HTMLButtonElement>(null);
  const onDirty = useCallback((value: boolean) => { dirtyRef.current = value; setDirtyState(value); }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const current = new URLSearchParams(currentLocation.search);
    const next = new URLSearchParams(nextLocation.search);
    const leaving = currentLocation.pathname !== nextLocation.pathname || current.get("run") !== next.get("run") || current.get("new") !== next.get("new");
    return (dirtyRef.current || data.saving) && leaving;
  });
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (!data.saving && window.confirm("Zahodit rozepsaný formulář?")) { onDirty(false); blocker.proceed(); }
    else blocker.reset();
  }, [blocker, data.saving, onDirty]);
  useEffect(() => {
    if (!dirty && !data.saving) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, data.saving]);
  useEffect(() => { onDirty(false); if (params.has("run")) remember(runId); }, [runId, createOpen]);
  useEffect(() => {
    if (params.has("q")) data.setQuery(params.get("q") || "");
    if (params.has("status")) { const value = params.get("status") || ""; if (["", "open", "in_progress", "completed", "archived"].includes(value)) data.setStatus(value as typeof data.status); }
    if (params.has("environment")) data.setEnvironment(params.get("environment") || "");
    if (params.has("offset")) data.setOffset(Math.max(0, Number(params.get("offset")) || 0));
    if (params.has("limit") && [25, 50, 100].includes(Number(params.get("limit")))) data.setLimit(Number(params.get("limit")));
  }, [location.key]);
  function url(id: number | null, create = false) {
    const next = new URLSearchParams({ run: id ? String(id) : "", q: data.query, status: data.status, environment: data.environment, offset: String(data.offset), limit: String(data.limit) });
    if (create) next.set("new", "1");
    return `/test-runs?${next}`;
  }
  function confirmLeave() {
    if (data.saving) return false;
    if (dirtyRef.current && !window.confirm("Zahodit rozepsaný formulář?")) return false;
    onDirty(false); return true;
  }
  function changeFilters(values: Record<string, string>) {
    const next = new URL(url(runId, createOpen), window.location.origin);
    Object.entries(values).forEach(([key, value]) => next.searchParams.set(key, value));
    navigate(next.pathname + next.search, { replace: true });
  }
  function backToList() {
    if (!confirmLeave()) return;
    const previous = runId;
    remember(null); navigate(url(null));
    requestAnimationFrame(() => (document.getElementById(`run-${previous}`) ?? newButton.current)?.focus());
  }
  const stats = data.list.data?.stats;
  const showDetail = createOpen || Boolean(runId) || invalidId;
  return <div className={`workspace-page runs-workspace ${showDetail ? "runs-show-detail" : "runs-show-list"}`}>
    <div className="execution-run-toolbar">
      <button className="workspace-button hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Zobrazit seznam" : "Sbalit seznam"}</button>
      {showDetail && <button className="workspace-button lg:hidden" disabled={data.saving} onClick={backToList}>Zpět na běhy</button>}
      <h1 className="text-base font-semibold">Běhy testování</h1>
      <p className="text-xs text-muted" title={`Průměrná úspěšnost běhů s vyhodnocenými testy: ${stats?.averagePassRate ?? 0} %. Jde o průměr za běhy, nikoli podíl všech testů.`}>Celkově: {stats?.total ?? "—"} běhů · Aktivní {stats?.active ?? "—"} · Dokončené {stats?.completed ?? "—"}</p>
      <button ref={newButton} className="workspace-button workspace-primary ml-auto" disabled={data.saving || createOpen} onClick={() => navigate(url(runId, true))}>Nový test run</button>
    </div>
    {notice && <p role="status" className="text-xs text-success">{notice}</p>}
    {data.users.error && <p role="alert" className="text-xs text-danger">Testery nelze načíst: {data.users.error} <button className="workspace-button" onClick={data.refresh}>Zkusit znovu</button></p>}
    <WorkspacePanels width={320} navigation={<TestRunNavigator className={collapsed ? "lg:!hidden" : ""} runs={data.list.data?.items ?? []} selectedId={runId} query={data.query} status={data.status} environment={data.environment} onQuery={value => changeFilters({ q: value, offset: "0" })} onStatus={value => changeFilters({ status: value, offset: "0" })} onEnvironment={value => changeFilters({ environment: value, offset: "0" })} onSelect={id => navigate(url(id))} total={data.list.data?.total ?? 0} offset={data.offset} limit={data.limit} onPage={value => changeFilters({ offset: String(value) })} onLimit={value => changeFilters({ limit: String(value), offset: "0" })} loading={data.list.loading} error={data.list.error} onRetry={data.refresh} disabled={data.saving} />}>
      <section className="workspace-detail" aria-label={createOpen ? "Založení běhu" : "Detail běhu"}>
        {createOpen ? <div className="workspace-scroll"><TestRunCreatePanel users={data.users.data ?? []} onDirtyChange={onDirty} onCancel={() => { onDirty(false); navigate(url(runId)); requestAnimationFrame(() => newButton.current?.focus()); }} onCreated={run => { onDirty(false); data.setOffset(0); data.setQuery(""); data.setStatus(""); data.setEnvironment(""); remember(run.id); setNotice(`Test run „${run.name}“ byl vytvořen.`); data.refresh(); navigate(`/test-runs?run=${run.id}&q=&status=&environment=&offset=0&limit=${data.limit}`, { replace: true }); }} /></div>
          : invalidId ? <p role="alert" className="p-4 text-sm text-danger">Neplatné ID běhu.</p>
          : runId && data.detail.error ? <div role="alert" className="p-4 text-sm text-danger">{data.detail.error}<button className="workspace-button ml-2" onClick={data.refresh}>Zkusit znovu</button></div>
          : runId && !data.run ? <p role="status" className="p-4 text-sm text-muted">Načítám běh…</p>
          : data.run ? <TestRunDetailPanel key={data.run.id} run={data.run} users={data.users.data ?? []} usersUnavailable={data.users.loading || Boolean(data.users.error)} revision={data.revision} saving={data.saving} error={data.error} returnTo={url(runId)} outsideList={!data.list.loading && Boolean(data.list.data) && !data.list.data?.items.some(item => item.id === runId)} onDirty={onDirty} confirmLeave={confirmLeave} mutate={data.mutate} />
          : <div className="p-6 text-sm text-muted">Vyber běh ze seznamu nebo založ nový.</div>}
      </section>
    </WorkspacePanels>
  </div>;
}
