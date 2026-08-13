import { CalendarRange, CheckCircle2, Link2, PlayCircle, Plus, Rocket, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addRunsToTestPlan,
  createMilestone,
  createRelease,
  createRunFromTestPlan,
  createTestPlan,
  getMilestones,
  getReleases,
  getTestPlans,
  removeRunFromTestPlan,
  type TestPlan,
  type TestPlanStatus,
} from "../api/planning";
import { getTestRuns } from "../api/testRuns";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { useActiveProject } from "../projects/ActiveProjectContext";

const planStatusLabels: Record<TestPlanStatus, string> = {
  draft: "Draft",
  active: "Aktivní",
  completed: "Dokončený",
  archived: "Archivovaný",
};

function toApiDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(value));
}

function planProgress(plan: TestPlan) {
  const runCases = plan.test_runs.flatMap((run) => run.test_run_cases);
  const done = runCases.filter((runCase) => runCase.result !== "not_run").length;
  const passed = runCases.filter((runCase) => runCase.result === "passed").length;
  return {
    total: runCases.length,
    done,
    passRate: done ? Math.round((passed / done) * 100) : 0,
  };
}

export function TestPlansPage() {
  const { projects, activeProjectId, activeProject, setActiveProjectId, loading: projectsLoading, error: projectsError } = useActiveProject();
  const [refreshKey, setRefreshKey] = useState(0);
  const releasesState = useApiResource(() => (activeProjectId ? getReleases(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const milestonesState = useApiResource(() => (activeProjectId ? getMilestones(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const plansState = useApiResource(() => (activeProjectId ? getTestPlans(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const runsState = useApiResource(() => (activeProjectId ? getTestRuns(activeProjectId, { limit: 100, offset: 0 }) : Promise.resolve([])), [activeProjectId, refreshKey]);

  const [releaseForm, setReleaseForm] = useState({ name: "", description: "", releaseDate: "" });
  const [milestoneForm, setMilestoneForm] = useState({ name: "", releaseId: "", plannedStart: "", plannedEnd: "" });
  const [planForm, setPlanForm] = useState({ name: "", description: "", releaseId: "", milestoneId: "", status: "draft" as TestPlanStatus });
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [linkRunIds, setLinkRunIds] = useState<number[]>([]);
  const [showCreateRunModal, setShowCreateRunModal] = useState(false);
  const [runForm, setRunForm] = useState({ name: "", description: "", version: "", environment: "TEST", plannedStart: "", plannedEnd: "" });
  const [createdRunId, setCreatedRunId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releases = releasesState.data ?? [];
  const milestones = milestonesState.data ?? [];
  const plans = plansState.data ?? [];
  const runs = runsState.data ?? [];
  const selectedPlan = plans.find((plan) => plan.id === Number(selectedPlanId)) ?? plans[0] ?? null;
  const linkedRunIds = new Set(selectedPlan?.test_runs.map((run) => run.id) ?? []);
  const availableRuns = runs.filter((run) => !linkedRunIds.has(run.id));
  const selectedPlanCaseIds = new Set(selectedPlan?.test_runs.flatMap((run) => run.test_run_cases.map((runCase) => runCase.test_case_id)) ?? []);
  const createRunDisabledReason = selectedPlan?.status === "archived"
    ? "Archivovaný plán nelze spustit."
    : selectedPlanCaseIds.size === 0
      ? "Nejdřív přidej do plánu run s test cases."
      : null;
  const kpis = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.status === "active").length;
    const allRunIds = new Set(plans.flatMap((plan) => plan.test_runs.map((run) => run.id)));
    return { releases: releases.length, milestones: milestones.length, plans: plans.length, activePlans, plannedRuns: allRunIds.size };
  }, [milestones.length, plans, releases.length]);

  if (projectsLoading || releasesState.loading || milestonesState.loading || plansState.loading || runsState.loading) {
    return <LoadingState />;
  }

  if (projectsError || releasesState.error || milestonesState.error || plansState.error || runsState.error) {
    return <ErrorState message={projectsError ?? releasesState.error ?? milestonesState.error ?? plansState.error ?? runsState.error ?? "Plánování není dostupné."} />;
  }

  async function handleCreateRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId || !releaseForm.name.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createRelease(activeProjectId, {
        name: releaseForm.name.trim(),
        description: releaseForm.description.trim() || null,
        status: "planned",
        release_date: toApiDate(releaseForm.releaseDate),
      });
      setReleaseForm({ name: "", description: "", releaseDate: "" });
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Release se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId || !milestoneForm.name.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createMilestone(activeProjectId, {
        name: milestoneForm.name.trim(),
        release_id: milestoneForm.releaseId ? Number(milestoneForm.releaseId) : null,
        planned_start: toApiDate(milestoneForm.plannedStart),
        planned_end: toApiDate(milestoneForm.plannedEnd),
        status: "planned",
      });
      setMilestoneForm({ name: "", releaseId: "", plannedStart: "", plannedEnd: "" });
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Milestone se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId || !planForm.name.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = await createTestPlan(activeProjectId, {
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        release_id: planForm.releaseId ? Number(planForm.releaseId) : null,
        milestone_id: planForm.milestoneId ? Number(planForm.milestoneId) : null,
        status: planForm.status,
        test_run_ids: selectedRunIds,
      });
      setPlanForm({ name: "", description: "", releaseId: "", milestoneId: "", status: "draft" });
      setSelectedRunIds([]);
      setSelectedPlanId(String(plan.id));
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test plan se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkRuns() {
    if (!selectedPlan || linkRunIds.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addRunsToTestPlan(selectedPlan.id, linkRunIds);
      setLinkRunIds([]);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test runy se nepodařilo přidat do plánu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRunFromPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const previousRunIds = new Set(selectedPlan.test_runs.map((run) => run.id));
      const updatedPlan = await createRunFromTestPlan(selectedPlan.id, {
        name: runForm.name.trim() || null,
        description: runForm.description.trim() || null,
        version: runForm.version.trim() || null,
        environment: runForm.environment.trim() || null,
        planned_start: toApiDate(runForm.plannedStart),
        planned_end: toApiDate(runForm.plannedEnd),
      });
      const createdRun = updatedPlan.test_runs.find((run) => !previousRunIds.has(run.id)) ?? null;
      setSelectedPlanId(String(updatedPlan.id));
      setCreatedRunId(createdRun?.id ?? null);
      setMessage(createdRun ? `Test run "${createdRun.name}" byl vytvořen z plánu.` : "Test run byl vytvořen z plánu.");
      setRunForm({ name: "", description: "", version: "", environment: "TEST", plannedStart: "", plannedEnd: "" });
      setShowCreateRunModal(false);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run z test plánu se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveRun(planId: number, runId: number) {
    setSaving(true);
    setError(null);
    try {
      await removeRunFromTestPlan(planId, runId);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test run se nepodařilo odebrat z plánu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Test Plans" description={`Plánování releasů, milestonů a větších testovacích cyklů${activeProject ? ` pro ${activeProject.name}` : ""}.`} />
        <label className="min-w-64 text-sm">
          <span className="font-medium">Projekt</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={activeProjectId ?? ""}
            onChange={(event) => {
              setActiveProjectId(event.target.value ? Number(event.target.value) : null);
              setSelectedPlanId("");
              setSelectedRunIds([]);
              setLinkRunIds([]);
            }}
          >
            {projects.length === 0 ? <option value="">Žádný projekt</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Releasy" value={kpis.releases} />
        <KpiCard label="Milestony" value={kpis.milestones} />
        <KpiCard label="Test plány" value={kpis.plans} />
        <KpiCard label="Aktivní plány" value={kpis.activePlans} />
        <KpiCard label="Runy v plánech" value={kpis.plannedRuns} />
      </section>

      {error && <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && (
        <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={17} />
            <span>{message}</span>
          </div>
          {createdRunId ? (
            <Link className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200" to={`/test-runs/${createdRunId}/execution`}>
              <PlayCircle size={16} /> Otevřít execution
            </Link>
          ) : null}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreateRelease(event)}>
          <div className="flex items-center gap-2 font-semibold"><Rocket size={18} /> Nový release</div>
          <label className="mt-4 block text-sm">
            <span className="font-medium">Název</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={releaseForm.name} onChange={(event) => setReleaseForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Datum release</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="date" value={releaseForm.releaseDate} onChange={(event) => setReleaseForm((current) => ({ ...current, releaseDate: event.target.value }))} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Popis</span>
            <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={releaseForm.description} onChange={(event) => setReleaseForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            <Plus size={16} /> Vytvořit release
          </button>
        </form>

        <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreateMilestone(event)}>
          <div className="flex items-center gap-2 font-semibold"><CalendarRange size={18} /> Nový milestone</div>
          <label className="mt-4 block text-sm">
            <span className="font-medium">Název</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={milestoneForm.name} onChange={(event) => setMilestoneForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Release</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={milestoneForm.releaseId} onChange={(event) => setMilestoneForm((current) => ({ ...current, releaseId: event.target.value }))}>
              <option value="">Bez release</option>
              {releases.map((release) => <option key={release.id} value={release.id}>{release.name}</option>)}
            </select>
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Start</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="date" value={milestoneForm.plannedStart} onChange={(event) => setMilestoneForm((current) => ({ ...current, plannedStart: event.target.value }))} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Konec</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="date" value={milestoneForm.plannedEnd} onChange={(event) => setMilestoneForm((current) => ({ ...current, plannedEnd: event.target.value }))} />
            </label>
          </div>
          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            <Plus size={16} /> Vytvořit milestone
          </button>
        </form>

        <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreatePlan(event)}>
          <div className="font-semibold">Nový test plan</div>
          <label className="mt-4 block text-sm">
            <span className="font-medium">Název</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Release</span>
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={planForm.releaseId} onChange={(event) => setPlanForm((current) => ({ ...current, releaseId: event.target.value }))}>
                <option value="">Bez release</option>
                {releases.map((release) => <option key={release.id} value={release.id}>{release.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Milestone</span>
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={planForm.milestoneId} onChange={(event) => setPlanForm((current) => ({ ...current, milestoneId: event.target.value }))}>
                <option value="">Bez milestone</option>
                {milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Status</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={planForm.status} onChange={(event) => setPlanForm((current) => ({ ...current, status: event.target.value as TestPlanStatus }))}>
              <option value="draft">Draft</option>
              <option value="active">Aktivní</option>
              <option value="completed">Dokončený</option>
              <option value="archived">Archivovaný</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Test runy</span>
            <div className="mt-1 max-h-28 overflow-auto rounded-md border border-slate-200">
              {runs.map((run) => (
                <label key={run.id} className="flex gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                  <input checked={selectedRunIds.includes(run.id)} onChange={() => setSelectedRunIds((current) => current.includes(run.id) ? current.filter((id) => id !== run.id) : [...current, run.id])} type="checkbox" />
                  <span>{run.name}</span>
                </label>
              ))}
              {runs.length === 0 && <div className="px-3 py-4 text-sm text-slate-500">Nejsou dostupné žádné test runy.</div>}
            </div>
          </label>
          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            <Plus size={16} /> Vytvořit test plan
          </button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="font-semibold">Test plány</div>
            <div className="mt-1 text-sm text-slate-500">Vyber plán a spravuj jeho runy.</div>
          </div>
          <div className="max-h-[720px] overflow-auto p-2">
            {plans.map((plan) => {
              const progress = planProgress(plan);
              const selected = selectedPlan?.id === plan.id;
              return (
                <button
                  key={plan.id}
                  className={[
                    "mb-2 block w-full rounded-md border px-4 py-3 text-left text-sm",
                    selected ? "border-cyan-200 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setSelectedPlanId(String(plan.id))}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{plan.name}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs text-slate-600">{planStatusLabels[plan.status]}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{plan.test_runs.length} runů / pass rate {progress.passRate}%</div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-cyan-600" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                  </div>
                </button>
              );
            })}
            {plans.length === 0 && <div className="px-3 py-8 text-sm text-slate-500">Zatím neexistuje žádný test plan.</div>}
          </div>
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-5">
          {selectedPlan ? (
            <>
              {(() => {
                const progress = planProgress(selectedPlan);
                return (
                  <div className="border-b border-slate-200 pb-5">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <div className="text-sm font-medium text-cyan-700">Test plan</div>
                        <h2 className="mt-1 text-2xl font-semibold">{selectedPlan.name}</h2>
                        <p className="mt-2 text-sm text-slate-500">{selectedPlan.description ?? "Bez popisu."}</p>
                      </div>
                      <span className="w-fit rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{planStatusLabels[selectedPlan.status]}</span>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-4">
                      <KpiCard label="Runy" value={selectedPlan.test_runs.length} />
                      <KpiCard label="Testy" value={progress.total} />
                      <KpiCard label="Hotovo" value={progress.done} />
                      <KpiCard label="Pass rate" value={progress.passRate} />
                    </div>
                  </div>
                );
              })()}

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="font-semibold">Runy ve vybraném plánu</div>
                <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || Boolean(createRunDisabledReason)} onClick={() => setShowCreateRunModal(true)} type="button">
                  Create run from plan
                </button>
              </div>
              {createRunDisabledReason ? <div className="mt-2 text-sm text-slate-500">{createRunDisabledReason}</div> : null}
              <div className="mt-4 space-y-2">
                {selectedPlan.test_runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{run.name}</div>
                      <div className="text-xs text-slate-500">{run.status} / {run.environment ?? "-"}</div>
                    </div>
                    <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" disabled={saving} onClick={() => void handleRemoveRun(selectedPlan.id, run.id)} type="button" title="Odebrat z plánu">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {selectedPlan.test_runs.length === 0 && <div className="text-sm text-slate-500">Plán zatím neobsahuje test runy.</div>}
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="text-sm font-medium">Přidat runy</div>
                <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200">
                  {availableRuns.map((run) => (
                    <label key={run.id} className="flex gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                      <input checked={linkRunIds.includes(run.id)} onChange={() => setLinkRunIds((current) => current.includes(run.id) ? current.filter((id) => id !== run.id) : [...current, run.id])} type="checkbox" />
                      <span>{run.name}</span>
                    </label>
                  ))}
                  {availableRuns.length === 0 && <div className="px-3 py-4 text-sm text-slate-500">Všechny runy už jsou v plánu.</div>}
                </div>
                <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving || linkRunIds.length === 0} onClick={() => void handleLinkRuns()} type="button">
                  <Link2 size={16} /> Přidat do plánu
                </button>
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-slate-500">Vyber nebo vytvoř test plan.</div>
          )}
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ListPanel title="Releasy" items={releases.map((release) => `${release.name} - ${formatDate(release.release_date)}`)} />
        <ListPanel title="Milestony" items={milestones.map((milestone) => `${milestone.name} - ${formatDate(milestone.planned_start)} až ${formatDate(milestone.planned_end)}`)} />
      </section>

      {showCreateRunModal && selectedPlan ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-2xl rounded-md bg-white p-5 shadow-xl" onSubmit={(event) => void handleCreateRunFromPlan(event)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Create run from plan</h2>
                <p className="mt-1 text-sm text-slate-500">Zdroj: {selectedPlan.name}. Test cases se převezmou z runů v plánu.</p>
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setShowCreateRunModal(false)} type="button">
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-3 rounded-md bg-slate-50 p-4 text-sm md:grid-cols-3">
              <div><span className="text-slate-500">Zdrojové runy:</span> {selectedPlan.test_runs.length}</div>
              <div><span className="text-slate-500">Unikátní test cases:</span> {selectedPlanCaseIds.size}</div>
              <div><span className="text-slate-500">Plan status:</span> {planStatusLabels[selectedPlan.status]}</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Název runu</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder={`${selectedPlan.name} - Run`} value={runForm.name} onChange={(event) => setRunForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Popis</span>
                <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2" value={runForm.description} onChange={(event) => setRunForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Verze</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={runForm.version} onChange={(event) => setRunForm((current) => ({ ...current, version: event.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Prostředí</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" list="plan-run-environments" value={runForm.environment} onChange={(event) => setRunForm((current) => ({ ...current, environment: event.target.value }))} />
                <datalist id="plan-run-environments">
                  <option value="DEV" />
                  <option value="TEST" />
                  <option value="UAT" />
                  <option value="PROD-LIKE" />
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Plánovaný začátek</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="datetime-local" value={runForm.plannedStart} onChange={(event) => setRunForm((current) => ({ ...current, plannedStart: event.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Plánovaný konec</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="datetime-local" value={runForm.plannedEnd} onChange={(event) => setRunForm((current) => ({ ...current, plannedEnd: event.target.value }))} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={() => setShowCreateRunModal(false)} type="button">
                Zrušit
              </button>
              <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                {saving ? "Vytvářím..." : "Vytvořit run"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </article>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4 font-semibold">{title}</div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => <div key={item} className="px-5 py-3 text-sm">{item}</div>)}
        {items.length === 0 && <div className="px-5 py-6 text-sm text-slate-500">Žádné záznamy.</div>}
      </div>
    </section>
  );
}
