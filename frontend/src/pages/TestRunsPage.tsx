import { Archive, Eye, Pencil, PlayCircle, Plus, Search, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getTestCases } from "../api/testCases";
import {
  addCasesToTestRun,
  archiveTestRun,
  createTestRun,
  getTestRuns,
  removeTestRunCase,
  updateTestRunCase,
  updateTestRun,
  type TestRun,
  type TestRunCaseListItem,
  type TestRunListItem,
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
type CreateStep = "details" | "cases" | "assignment";

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

function resultSummary(cases: Array<{ result: TestRunCaseListItem["result"] }>) {
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

function toForm(run: TestRun | TestRunListItem): TestRunFormState {
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

type CasePickerFiltersProps = {
  query: string;
  status: string;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
};

function CasePickerFilters({ query, status, onQueryChange, onStatusChange }: CasePickerFiltersProps) {
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_150px]">
      <label className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm"
          placeholder="Hledat podle kódu nebo názvu"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="">Všechny statusy</option>
        <option value="ready">Ready</option>
        <option value="draft">Draft</option>
        <option value="deprecated">Deprecated</option>
      </select>
    </div>
  );
}

type CasePickerListProps = {
  testCases: TestCase[];
  selectedCaseIds: number[];
  onToggle: (testCaseId: number) => void;
  emptyText?: string;
};

function CasePickerList({ testCases, selectedCaseIds, onToggle, emptyText = "Nejsou dostupné žádné test cases." }: CasePickerListProps) {
  return (
    <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
      {testCases.map((testCase) => (
        <label key={testCase.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
          <input
            className="mt-1"
            checked={selectedCaseIds.includes(testCase.id)}
            onChange={() => onToggle(testCase.id)}
            type="checkbox"
          />
          <span>
            <span className="font-medium">{testCase.code} - {testCase.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{testCase.status}</span>
          </span>
        </label>
      ))}
      {testCases.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">{emptyText}</div>}
    </div>
  );
}

export function TestRunsPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const shouldOpenCreate = searchParams.get("new") === "1" || (location.state as { openCreateRun?: boolean } | null)?.openCreateRun === true;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TestRunStatus | "">("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [createStep, setCreateStep] = useState<CreateStep>("details");
  const [selectedRun, setSelectedRun] = useState<TestRun | TestRunListItem | null>(null);
  const [form, setForm] = useState<TestRunFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("");

  const runsState = useApiResource(
    () => getTestRuns({ q: query, status: statusFilter, environment: environmentFilter, limit: 100, offset: 0 }),
    [query, statusFilter, environmentFilter, refreshKey],
  );
  const allRunsState = useApiResource(
    () => getTestRuns({ limit: 100, offset: 0 }),
    [refreshKey],
  );
  const casesState = useApiResource(() => getTestCases(), [refreshKey]);
  const usersState = useApiResource(getUsers, [refreshKey]);

  const runs = runsState.data ?? [];
  const allRuns = allRunsState.data ?? [];
  const testCases = casesState.data ?? [];
  const users = usersState.data ?? [];

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
  const availableTestCases = testCases.filter((testCase) => testCase.status === "ready" && testCase.current_approved_version_id && !assignedCaseIds.has(testCase.id));
  const filteredAvailableTestCases = availableTestCases.filter((testCase) => {
    const normalizedQuery = caseQuery.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || `${testCase.code} ${testCase.title}`.toLowerCase().includes(normalizedQuery);
    const matchesStatus = !caseStatusFilter || testCase.status === caseStatusFilter;
    return matchesQuery && matchesStatus;
  });
  const filteredAvailableIds = filteredAvailableTestCases.map((testCase) => testCase.id);
  const allFilteredSelected = filteredAvailableIds.length > 0 && filteredAvailableIds.every((id) => selectedCaseIds.includes(id));

  useEffect(() => {
    if (shouldOpenCreate && !modalMode) {
      openCreate();
      navigate("/test-runs", { replace: true });
    }
  }, [modalMode, navigate, shouldOpenCreate]);

  function openCreate() {
    setSelectedRun(null);
    setForm(emptyForm);
    setFormError(null);
    setCreateStep("details");
    setSelectedCaseIds([]);
    setAssignedTo("");
    setCaseQuery("");
    setCaseStatusFilter("");
    setModalMode("create");
  }

  function openEdit(run: TestRunListItem) {
    setSelectedRun(run);
    setForm(toForm(run));
    setFormError(null);
    setModalMode("edit");
  }

  function openDetail(run: TestRunListItem) {
    setSelectedRun(run);
    setForm(toForm(run));
    setFormError(null);
    setSelectedCaseIds([]);
    setAssignedTo("");
    setCaseQuery("");
    setCaseStatusFilter("");
    setModalMode("detail");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedRun(null);
    setFormError(null);
    setCreateStep("details");
    setSelectedCaseIds([]);
    setAssignedTo("");
    setCaseQuery("");
    setCaseStatusFilter("");
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

  function goToNextCreateStep() {
    setFormError(null);
    if (createStep === "details") {
      const validationError = validateForm();
      if (validationError) {
        setFormError(validationError);
        return;
      }
      setCreateStep("cases");
      return;
    }
    if (createStep === "cases") {
      if (selectedCaseIds.length === 0) {
        setFormError("Vyber alespoň jeden test case pro test run.");
        return;
      }
      setCreateStep("assignment");
    }
  }

  function goToPreviousCreateStep() {
    setFormError(null);
    if (createStep === "assignment") {
      setCreateStep("cases");
      return;
    }
    if (createStep === "cases") {
      setCreateStep("details");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (modalMode === "create" && selectedCaseIds.length === 0) {
      setCreateStep("cases");
      setFormError("Vyber alespoň jeden test case pro test run.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setPageError(null);
    try {
      const payload = buildPayload(form);
      let savedRun = modalMode === "edit" && selectedRun ? await updateTestRun(selectedRun.id, payload) : await createTestRun(payload);
      if (modalMode === "create" && selectedCaseIds.length > 0) {
        savedRun = await addCasesToTestRun(savedRun.id, {
          test_case_ids: selectedCaseIds,
          assigned_to: assignedTo ? Number(assignedTo) : null,
        });
      }
      setSelectedRun(savedRun);
      setModalMode("detail");
      setSelectedCaseIds([]);
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

  function toggleAllFilteredCases() {
    if (allFilteredSelected) {
      setSelectedCaseIds((current) => current.filter((id) => !filteredAvailableIds.includes(id)));
      return;
    }
    setSelectedCaseIds((current) => Array.from(new Set([...current, ...filteredAvailableIds])));
  }

  async function handleAssignRunCase(runCase: TestRunCaseListItem, value: string) {
    setSaving(true);
    setFormError(null);
    try {
      await updateTestRunCase(runCase.id, { assigned_to: value ? Number(value) : null });
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Přiřazení testera se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveRunCase(runCase: TestRunCaseListItem) {
    const testCase = testCases.find((item) => item.id === runCase.test_case_id);
    const confirmed = window.confirm(`Odebrat ${testCase?.code ?? "test case"} z test runu?`);
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await removeTestRunCase(runCase.id);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Test case se nepodařilo odebrat z runu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(run: TestRunListItem) {
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

  if (runsState.loading || allRunsState.loading || casesState.loading || usersState.loading) {
    return <LoadingState />;
  }

  if (runsState.error || allRunsState.error || casesState.error || usersState.error) {
    return <ErrorState message={runsState.error ?? allRunsState.error ?? casesState.error ?? usersState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Test Runs" description="Plánování, správa a sledování běhů testování." />
        <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">
          <Plus size={16} /> Nový test run
        </button>
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
            <p className="mt-1 text-sm text-slate-500">Změň filtr nebo založ první test run.</p>
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
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            {modalMode !== "detail" ? (
              <div className="mt-5 space-y-5">
                {modalMode === "create" ? (
                  <div className="grid gap-2 rounded-md bg-slate-50 p-2 text-sm md:grid-cols-3">
                    {[
                      ["details", "1. Nastavení"],
                      ["cases", "2. Test cases"],
                      ["assignment", "3. Přiřazení"],
                    ].map(([step, label]) => (
                      <button
                        key={step}
                        className={[
                          "rounded-md px-3 py-2 text-left font-medium",
                          createStep === step ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600 hover:bg-white",
                        ].join(" ")}
                        type="button"
                        onClick={() => setCreateStep(step as CreateStep)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className={`grid gap-4 md:grid-cols-2 ${modalMode === "create" && createStep !== "details" ? "hidden" : ""}`}>
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
                {modalMode === "create" && (
                  <section className={`rounded-md border border-slate-200 p-4 ${createStep !== "cases" ? "hidden" : ""}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">Test cases v runu</div>
                        <div className="mt-1 text-sm text-slate-500">Vybráno {selectedCaseIds.length} z {availableTestCases.length} dostupných.</div>
                      </div>
                      <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={filteredAvailableIds.length === 0} onClick={toggleAllFilteredCases} type="button">
                        {allFilteredSelected ? "Odznačit zobrazené" : "Vybrat zobrazené"}
                      </button>
                    </div>
                    <CasePickerFilters
                      query={caseQuery}
                      status={caseStatusFilter}
                      onQueryChange={setCaseQuery}
                      onStatusChange={setCaseStatusFilter}
                    />
                    <CasePickerList
                      testCases={filteredAvailableTestCases}
                      selectedCaseIds={selectedCaseIds}
                      onToggle={(testCaseId) =>
                        setSelectedCaseIds((current) =>
                          current.includes(testCaseId) ? current.filter((id) => id !== testCaseId) : [...current, testCaseId],
                        )
                      }
                    />
                  </section>
                )}
                {modalMode === "create" && (
                  <section className={`rounded-md border border-slate-200 p-4 ${createStep !== "assignment" ? "hidden" : ""}`}>
                    <div className="font-semibold">Přiřazení testerovi</div>
                    <p className="mt-1 text-sm text-slate-500">Vybrané test cases: {selectedCaseIds.length}. Přiřazení můžeš později změnit v detailu runu.</p>
                    <label className="mt-4 block text-sm">
                      <span className="font-medium">Tester</span>
                      <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                        <option value="">Nepřiřazeno</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 text-sm md:grid-cols-2">
                      <div><span className="text-slate-500">Název:</span> {form.name || "-"}</div>
                      <div><span className="text-slate-500">Prostředí:</span> {form.environment || "-"}</div>
                      <div><span className="text-slate-500">Verze:</span> {form.version || "-"}</div>
                      <div><span className="text-slate-500">Počet test cases:</span> {selectedCaseIds.length}</div>
                    </div>
                  </section>
                )}
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
                      return (
                        <div key={runCase.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_180px_120px_96px]">
                          <div className="font-medium">{testCase ? `${testCase.code} - ${testCase.title}` : runCase.test_case_id}</div>
                          <select
                            className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                            disabled={saving || selectedRunLatest.status === "archived"}
                            value={runCase.assigned_to ?? ""}
                            onChange={(event) => void handleAssignRunCase(runCase, event.target.value)}
                          >
                            <option value="">Nepřiřazeno</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                          </select>
                          <div>{resultLabel(runCase.result)}</div>
                          <button
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={saving || selectedRunLatest.status === "archived" || runCase.result !== "not_run"}
                            onClick={() => void handleRemoveRunCase(runCase)}
                            type="button"
                          >
                            <Trash2 size={14} /> Odebrat
                          </button>
                        </div>
                      );
                    })}
                    {selectedRunLatest.test_run_cases.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Zatím nejsou přiřazené žádné test cases.</div>}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-4">
                  <div className="font-semibold">Přidat test cases</div>
                  <CasePickerFilters
                    query={caseQuery}
                    status={caseStatusFilter}
                    onQueryChange={setCaseQuery}
                    onStatusChange={setCaseStatusFilter}
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                    <CasePickerList
                      emptyText={availableTestCases.length === 0 ? "Všechny dostupné test cases už jsou v runu." : "Filtru neodpovídá žádný test case."}
                      testCases={filteredAvailableTestCases}
                      selectedCaseIds={selectedCaseIds}
                      onToggle={(testCaseId) =>
                        setSelectedCaseIds((current) =>
                          current.includes(testCaseId) ? current.filter((id) => id !== testCaseId) : [...current, testCaseId],
                        )
                      }
                    />
                    <div>
                      <button className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={filteredAvailableIds.length === 0} onClick={toggleAllFilteredCases} type="button">
                        {allFilteredSelected ? "Odznačit zobrazené" : "Vybrat zobrazené"}
                      </button>
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
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={modalMode === "create" && createStep !== "details" ? goToPreviousCreateStep : closeModal} type="button">
                {modalMode === "create" && createStep !== "details" ? "Zpět" : "Zavřít"}
              </button>
              {modalMode === "create" && createStep !== "assignment" ? (
                <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" onClick={goToNextCreateStep} type="button">
                  Pokračovat
                </button>
              ) : modalMode !== "detail" ? (
                <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Ukládám..." : modalMode === "create" ? "Vytvořit test run" : "Uložit"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
