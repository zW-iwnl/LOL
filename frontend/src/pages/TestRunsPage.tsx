import { Archive, Eye, Pencil, PlayCircle, Plus, Search, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects } from "../api/projects";
import { getTestCases } from "../api/testCases";
import {
  addCasesToTestRun,
  archiveTestRun,
  createTestRun,
  getTestRuns,
  updateTestRun,
  type TestRun,
  type TestRunCase,
  type TestRunCreatePayload,
  type TestRunStatus,
} from "../api/testRuns";
import { getUsers, type TestCase } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { resultLabel } from "../data/mockData";

const statusLabels: Record<TestRunStatus, string> = {
  open: "Otevřený",
  in_progress: "Probíhá",
  completed: "Dokončený",
  archived: "Archivovaný",
};

const statusClasses: Record<TestRunStatus, string> = {
  open: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
};

type ModalMode = "create" | "edit" | "detail";

type TestRunFormState = {
  name: string;
  description: string;
  version: string;
  environment: string;
  status: TestRunStatus;
  planned_start: string;
  planned_end: string;
};

const emptyForm: TestRunFormState = {
  name: "",
  description: "",
  version: "",
  environment: "TEST",
  status: "open",
  planned_start: "",
  planned_end: "",
};

function statusBadge(status: TestRunStatus) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function resultSummary(cases: TestRunCase[]) {
  const counts = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    not_run: 0,
  };
  for (const runCase of cases) {
    counts[runCase.result] += 1;
  }
  const executed = counts.passed + counts.failed + counts.blocked + counts.skipped;
  const passRate = executed ? Math.round((counts.passed / executed) * 100) : 0;
  return { counts, executed, total: cases.length, passRate };
}

function toForm(run: TestRun): TestRunFormState {
  return {
    name: run.name,
    description: run.description ?? "",
    version: run.version ?? "",
    environment: run.environment ?? "TEST",
    status: run.status,
    planned_start: toDateTimeLocal(run.planned_start),
    planned_end: toDateTimeLocal(run.planned_end),
  };
}

function buildPayload(form: TestRunFormState): TestRunCreatePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    version: form.version.trim() || null,
    environment: form.environment.trim() || null,
    status: form.status,
    planned_start: toApiDateTime(form.planned_start),
    planned_end: toApiDateTime(form.planned_end),
  };
}

export function TestRunsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestRunStatus | "">("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [form, setForm] = useState<TestRunFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [assignedTo, setAssignedTo] = useState("");

  const projectsState = useApiResource(() => getProjects({ limit: 100, offset: 0 }), []);
  const activeProjectId = selectedProjectId ?? projectsState.data?.[0]?.id ?? null;
  const runsState = useApiResource(
    () =>
      activeProjectId
        ? getTestRuns(activeProjectId, { q: query, status: statusFilter, environment: environmentFilter, limit: 100, offset: 0 })
        : Promise.resolve([]),
    [activeProjectId, query, statusFilter, environmentFilter, refreshKey],
  );
  const allRunsState = useApiResource(
    () => (activeProjectId ? getTestRuns(activeProjectId, { limit: 100, offset: 0 }) : Promise.resolve([])),
    [activeProjectId, refreshKey],
  );
  const casesState = useApiResource(() => (activeProjectId ? getTestCases(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const usersState = useApiResource(getUsers, [refreshKey]);

  const projects = projectsState.data ?? [];
  const runs = runsState.data ?? [];
  const allRuns = allRunsState.data ?? [];
  const testCases = casesState.data ?? [];
  const users = usersState.data ?? [];

  const selectedProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const selectedRunLatest = useMemo(
    () => (selectedRun ? runs.find((run) => run.id === selectedRun.id) ?? selectedRun : null),
    [runs, selectedRun],
  );

  const kpis = useMemo(() => {
    const passRates = allRuns.map((run) => resultSummary(run.test_run_cases).passRate).filter((rate) => rate > 0);
    return {
      total: allRuns.length,
      active: allRuns.filter((run) => run.status === "open" || run.status === "in_progress").length,
      completed: allRuns.filter((run) => run.status === "completed").length,
      averagePassRate: passRates.length ? Math.round(passRates.reduce((sum, rate) => sum + rate, 0) / passRates.length) : 0,
    };
  }, [allRuns]);

  const assignedCaseIds = new Set((selectedRunLatest?.test_run_cases ?? []).map((runCase) => runCase.test_case_id));
  const availableTestCases = testCases.filter((testCase) => !assignedCaseIds.has(testCase.id));

  function openCreate() {
    setSelectedRun(null);
    setForm(emptyForm);
    setFormError(null);
    setSelectedCaseIds([]);
    setAssignedTo("");
    setModalMode("create");
  }

  function openEdit(run: TestRun) {
    setSelectedRun(run);
    setForm(toForm(run));
    setFormError(null);
    setModalMode("edit");
  }

  function openDetail(run: TestRun) {
    setSelectedRun(run);
    setForm(toForm(run));
    setFormError(null);
    setSelectedCaseIds([]);
    setAssignedTo("");
    setModalMode("detail");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedRun(null);
    setFormError(null);
    setSelectedCaseIds([]);
    setAssignedTo("");
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Název test runu je povinný.";
    }
    if (form.planned_start && form.planned_end && new Date(form.planned_start) > new Date(form.planned_end)) {
      return "Plánovaný začátek musí být před plánovaným koncem.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId) {
      setFormError("Nejdřív vyber projekt.");
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    setPageError(null);
    try {
      const payload = buildPayload(form);
      const savedRun = modalMode === "edit" && selectedRun ? await updateTestRun(selectedRun.id, payload) : await createTestRun(activeProjectId, payload);
      setSelectedRun(savedRun);
      setModalMode("detail");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Test run se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCases() {
    const run = selectedRunLatest;
    if (!run || selectedCaseIds.length === 0) {
      setFormError("Vyber alespoň jeden test case.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const updatedRun = await addCasesToTestRun(run.id, {
        test_case_ids: selectedCaseIds,
        assigned_to: assignedTo ? Number(assignedTo) : null,
      });
      setSelectedRun(updatedRun);
      setSelectedCaseIds([]);
      setAssignedTo("");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Test cases se nepodařilo přidat.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(run: TestRun) {
    const confirmed = window.confirm(`Archivovat test run ${run.name}?`);
    if (!confirmed) {
      return;
    }

    setPageError(null);
    try {
      await archiveTestRun(run.id);
      setRefreshKey((value) => value + 1);
      if (selectedRun?.id === run.id) {
        closeModal();
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Test run se nepodařilo archivovat.");
    }
  }

  if (projectsState.loading || runsState.loading || allRunsState.loading || casesState.loading || usersState.loading) {
    return <LoadingState />;
  }

  if (projectsState.error || runsState.error || allRunsState.error || casesState.error || usersState.error) {
    return <ErrorState message={projectsState.error ?? runsState.error ?? allRunsState.error ?? casesState.error ?? usersState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Test Runs" description="Plánování, správa a sledování běhů testování." />
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={activeProjectId ?? ""}
            onChange={(event) => {
              setSelectedProjectId(Number(event.target.value));
              closeModal();
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">
            <Plus size={16} /> Nový test run
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Celkem test runů</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.total}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Aktivní runy</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.active}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Dokončené runy</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.completed}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Průměrný pass rate</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.averagePassRate}%</div>
        </article>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none ring-cyan-500 transition focus:border-cyan-500 focus:ring-2"
              placeholder="Hledat test run..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TestRunStatus | "")}>
              <option value="">Vše</option>
              <option value="open">Otevřené</option>
              <option value="in_progress">Probíhá</option>
              <option value="completed">Dokončené</option>
              <option value="archived">Archivované</option>
            </select>
            <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)}>
              <option value="">Vše</option>
              <option value="DEV">DEV</option>
              <option value="TEST">TEST</option>
              <option value="UAT">UAT</option>
              <option value="PROD-LIKE">PROD-LIKE</option>
            </select>
          </div>
        </div>

        {pageError && <div className="m-5 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{pageError}</div>}

        {runs.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-slate-100 text-slate-500">
              <PlayCircle size={22} />
            </div>
            <h2 className="mt-4 font-semibold">Žádné test runy</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedProject ? "Změň filtr nebo založ první test run." : "Nejdřív založ projekt."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Název</th>
                  <th className="px-5 py-3 font-medium">Verze</th>
                  <th className="px-5 py-3 font-medium">Prostředí</th>
                  <th className="px-5 py-3 font-medium">Stav</th>
                  <th className="px-5 py-3 font-medium">Plán</th>
                  <th className="px-5 py-3 font-medium">Výsledek</th>
                  <th className="px-5 py-3 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const summary = resultSummary(run.test_run_cases);
                  return (
                    <tr key={run.id} className="border-t border-slate-100">
                      <td className="px-5 py-4">
                        <div className="font-semibold">{run.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{run.description ?? "-"}</div>
                      </td>
                      <td className="px-5 py-4">{run.version ?? "-"}</td>
                      <td className="px-5 py-4">{run.environment ?? "-"}</td>
                      <td className="px-5 py-4">{statusBadge(run.status)}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{formatDateTime(run.planned_start)}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(run.planned_end)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${summary.passRate}%` }} />
                          </div>
                          <span className="text-xs font-medium">{summary.passRate}%</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          P {summary.counts.passed} / F {summary.counts.failed} / B {summary.counts.blocked} / S {summary.counts.skipped} / N {summary.counts.not_run}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openDetail(run)} type="button">
                            <Eye size={14} /> Detail
                          </button>
                          <Link className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" to={`/test-runs/${run.id}/execution`}>
                            <PlayCircle size={14} /> Spustit execution
                          </Link>
                          <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openEdit(run)} type="button">
                            <Pencil size={14} /> Upravit
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={run.status === "archived"}
                            onClick={() => void handleArchive(run)}
                            type="button"
                          >
                            <Archive size={14} /> Archivovat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4 py-6">
          <form className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-md bg-white p-5 shadow-xl" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {modalMode === "create" ? "Nový test run" : modalMode === "edit" ? "Upravit test run" : "Detail test runu"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Projekt: {selectedProject?.name ?? "-"}</p>
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            {modalMode !== "detail" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium">Název test runu</span>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium">Popis</span>
                  <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Verze</span>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Prostředí</span>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" list="test-run-environments" value={form.environment} onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value }))} />
                  <datalist id="test-run-environments">
                    <option value="DEV" />
                    <option value="TEST" />
                    <option value="UAT" />
                    <option value="PROD-LIKE" />
                  </datalist>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Status</span>
                  <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TestRunStatus }))}>
                    <option value="open">Otevřený</option>
                    <option value="in_progress">Probíhá</option>
                    <option value="completed">Dokončený</option>
                    <option value="archived">Archivovaný</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Plánovaný začátek</span>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="datetime-local" value={form.planned_start} onChange={(event) => setForm((current) => ({ ...current, planned_start: event.target.value }))} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Plánovaný konec</span>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="datetime-local" value={form.planned_end} onChange={(event) => setForm((current) => ({ ...current, planned_end: event.target.value }))} />
                </label>
              </div>
            ) : selectedRunLatest ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 rounded-md bg-slate-50 p-4 text-sm md:grid-cols-3">
                  <div><span className="text-slate-500">Název:</span> {selectedRunLatest.name}</div>
                  <div><span className="text-slate-500">Verze:</span> {selectedRunLatest.version ?? "-"}</div>
                  <div><span className="text-slate-500">Prostředí:</span> {selectedRunLatest.environment ?? "-"}</div>
                  <div><span className="text-slate-500">Stav:</span> {statusLabels[selectedRunLatest.status]}</div>
                  <div><span className="text-slate-500">Plán start:</span> {formatDateTime(selectedRunLatest.planned_start)}</div>
                  <div><span className="text-slate-500">Plán konec:</span> {formatDateTime(selectedRunLatest.planned_end)}</div>
                </div>

                <div className="flex justify-end">
                  <Link className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white" to={`/test-runs/${selectedRunLatest.id}/execution`}>
                    <PlayCircle size={16} /> Otevřít execution
                  </Link>
                </div>

                <section className="rounded-md border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3 font-semibold">Přiřazené test cases</div>
                  <div className="max-h-60 overflow-auto">
                    {selectedRunLatest.test_run_cases.map((runCase) => {
                      const testCase = testCases.find((item) => item.id === runCase.test_case_id);
                      const assignee = users.find((user) => user.id === runCase.assigned_to);
                      return (
                        <div key={runCase.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_160px_120px]">
                          <div className="font-medium">{testCase ? `${testCase.code} - ${testCase.title}` : runCase.test_case_id}</div>
                          <div className="text-slate-500">{assignee?.name ?? "-"}</div>
                          <div>{resultLabel(runCase.result)}</div>
                        </div>
                      );
                    })}
                    {selectedRunLatest.test_run_cases.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Zatím nejsou přiřazené žádné test cases.</div>}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-4">
                  <div className="font-semibold">Přidat test cases</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                    <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
                      {availableTestCases.map((testCase: TestCase) => (
                        <label key={testCase.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                          <input
                            className="mt-1"
                            checked={selectedCaseIds.includes(testCase.id)}
                            onChange={() =>
                              setSelectedCaseIds((current) =>
                                current.includes(testCase.id) ? current.filter((id) => id !== testCase.id) : [...current, testCase.id],
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            <span className="font-medium">{testCase.code} - {testCase.title}</span>
                            <span className="mt-1 block text-xs text-slate-500">{testCase.priority} / {testCase.status}</span>
                          </span>
                        </label>
                      ))}
                      {availableTestCases.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Všechny dostupné test cases už jsou v runu.</div>}
                    </div>
                    <div>
                      <label className="block text-sm">
                        <span className="font-medium">Tester</span>
                        <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                          <option value="">Nepřiřazeno</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </label>
                      <button className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving || selectedCaseIds.length === 0} onClick={() => void handleAddCases()} type="button">
                        Přidat do test runu
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {formError && <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={closeModal} type="button">
                Zavřít
              </button>
              {modalMode !== "detail" && (
                <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Ukládám..." : "Uložit"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
