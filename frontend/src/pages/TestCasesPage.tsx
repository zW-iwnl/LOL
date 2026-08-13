import { ArrowLeft, ArrowUp, Check, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Copy, Edit3, Folder, ImageIcon, ListTree, MoreHorizontal, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import {
  createTestCase,
  createTestSuite,
  getAllTestCases,
  getTestCases,
  getTestSuites,
  type Priority,
  type TestCase,
  type TestCaseCreate,
  type TestCaseStatus,
  type TestSuite,
} from "../api/client";
import { ErrorState, LoadingState, useApiResource, useCurrentProject } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { useActiveProject } from "../projects/ActiveProjectContext";

const priorities: Priority[] = ["low", "medium", "high", "critical"];
const statuses: TestCaseStatus[] = ["draft", "ready", "deprecated"];
const defaultTypes = ["manual", "automated", "api", "regression"];

type Filters = {
  suiteId: string;
  priority: string;
  status: string;
  type: string;
};

type TestCaseForm = {
  suiteId: string;
  code: string;
  title: string;
  description: string;
  preconditions: string;
  expectedSummary: string;
  priority: Priority;
  type: string;
  status: TestCaseStatus;
  automated: boolean;
  steps: TestCaseFormStep[];
};

type SuiteForm = {
  name: string;
  parentSuiteId: string;
  description: string;
};

type TestCaseFormStep = {
  localId: number;
  action: string;
  expectedResult: string;
  testData: string;
};

const emptyForm: TestCaseForm = {
  suiteId: "",
  code: "",
  title: "",
  description: "",
  preconditions: "",
  expectedSummary: "",
  priority: "medium",
  type: "manual",
  status: "draft",
  automated: false,
  steps: [{ localId: 1, action: "", expectedResult: "", testData: "" }],
};

export function TestCasesPage() {
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const { projects, activeProjectId } = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenCreate = searchParams.get("new") === "1";
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<Filters>({ suiteId: "", priority: "", status: "", type: "" });
  const [form, setForm] = useState<TestCaseForm>(emptyForm);
  const [suiteForm, setSuiteForm] = useState<SuiteForm>({ name: "", parentSuiteId: "", description: "" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [suitesCollapsed, setSuitesCollapsed] = useState(false);
  const [collapsedSuiteIds, setCollapsedSuiteIds] = useState<Set<number>>(new Set());
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const createProjectId = activeProjectId;
  const projectById = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const suitesState = useApiResource(() => (activeProjectId ? getTestSuites(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const createSuitesState = useApiResource(() => (createProjectId ? getTestSuites(createProjectId) : Promise.resolve([])), [createProjectId]);
  const casesState = useApiResource(() => (activeProjectId ? getTestCases(activeProjectId) : getAllTestCases()), [activeProjectId, refreshKey]);
  const suiteName = (suiteId: number | null) => suitesState.data?.find((suite) => suite.id === suiteId)?.name ?? "Bez suity";
  const suiteCounts = useMemo(() => {
    const counts = new Map<number | null, number>();
    for (const testCase of casesState.data ?? []) {
      counts.set(testCase.suite_id, (counts.get(testCase.suite_id) ?? 0) + 1);
    }
    return counts;
  }, [casesState.data]);
  const totalCases = casesState.data?.length ?? 0;
  const suites = suitesState.data ?? [];
  const suiteIdsWithChildren = useMemo(() => {
    return new Set(suites.filter((suite) => suite.parent_suite_id !== null).map((suite) => suite.parent_suite_id as number));
  }, [suites]);
  const visibleSuites = useMemo(() => {
    const hiddenAncestorIds = new Set<number>();
    return suites.filter((suite) => {
      if (suite.parent_suite_id !== null && hiddenAncestorIds.has(suite.parent_suite_id)) {
        hiddenAncestorIds.add(suite.id);
        return false;
      }
      if (suite.parent_suite_id !== null && collapsedSuiteIds.has(suite.parent_suite_id)) {
        hiddenAncestorIds.add(suite.id);
        return false;
      }
      return true;
    });
  }, [collapsedSuiteIds, suites]);
  const currentSuiteId = filters.suiteId && filters.suiteId !== "none" ? Number(filters.suiteId) : null;
  const currentSuite = currentSuiteId ? suites.find((suite) => suite.id === currentSuiteId) ?? null : null;
  const currentChildSuites = useMemo(() => {
    return suites.filter((suite) => suite.parent_suite_id === currentSuiteId);
  }, [currentSuiteId, suites]);

  useEffect(() => {
    if (shouldOpenCreate) {
      setShowCreateForm(true);
    }
  }, [shouldOpenCreate]);

  const availableTypes = useMemo(() => {
    const fromData = new Set((casesState.data ?? []).map((testCase) => testCase.type));
    return Array.from(new Set([...defaultTypes, ...fromData]));
  }, [casesState.data]);

  const filteredCases = useMemo(() => {
    return (casesState.data ?? []).filter((testCase) => {
      if (filters.suiteId === "none" && testCase.suite_id !== null) return false;
      if (filters.suiteId && filters.suiteId !== "none" && testCase.suite_id !== Number(filters.suiteId)) return false;
      if (filters.priority && testCase.priority !== filters.priority) return false;
      if (filters.status && testCase.status !== filters.status) return false;
      if (filters.type && testCase.type !== filters.type) return false;
      return true;
    });
  }, [casesState.data, filters]);
  const selectedTestCase = useMemo(() => {
    return filteredCases.find((testCase) => testCase.id === selectedTestCaseId) ?? null;
  }, [filteredCases, selectedTestCaseId]);

  function validateForm(): string | null {
    if (!form.title.trim()) return "Název test case je povinný.";
    if (!priorities.includes(form.priority)) return "Priorita musí být low, medium, high nebo critical.";
    if (!statuses.includes(form.status)) return "Status musí být draft, ready nebo deprecated.";
    const incompleteStep = form.steps.find((step) => !step.action.trim() && (step.expectedResult.trim() || step.testData.trim()));
    if (incompleteStep) return "Krok s očekávaným výsledkem nebo daty musí mít vyplněnou akci.";
    return null;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!createProjectId) return;

    const error = validateForm();
    setValidationError(error);
    setMessage(null);
    if (error) return;

    const steps: TestCaseCreate["steps"] = form.steps
      .filter((step) => step.action.trim())
      .map((step, index) => ({
        step_order: index + 1,
        action: step.action.trim(),
        expected_result: step.expectedResult.trim() || null,
        test_data: step.testData.trim() || null,
      }));

    try {
      await createTestCase(createProjectId, {
        suite_id: form.suiteId ? Number(form.suiteId) : null,
        code: form.code.trim() || `TC-${Date.now().toString().slice(-6)}`,
        title: form.title.trim(),
        description: form.description.trim() || null,
        preconditions: form.preconditions.trim() || null,
        expected_summary: null,
        priority: form.priority,
        type: form.type.trim() || "manual",
        status: form.status,
        automated: form.automated,
        steps,
      });
      setForm(emptyForm);
      setShowCreateForm(false);
      setRefreshKey((value) => value + 1);
      setMessage("Test case byl vytvořen.");
    } catch (createError) {
      setValidationError(createError instanceof Error ? createError.message : "Test case se nepodařilo vytvořit.");
    }
  }

  async function handleCreateSuite(event: FormEvent) {
    event.preventDefault();
    if (!activeProjectId || !suiteForm.name.trim()) {
      setValidationError("Název suity je povinný.");
      return;
    }

    setValidationError(null);
    setMessage(null);
    try {
      const createdSuite = await createTestSuite(activeProjectId, {
        name: suiteForm.name.trim(),
        parent_suite_id: suiteForm.parentSuiteId ? Number(suiteForm.parentSuiteId) : null,
        description: suiteForm.description.trim() || null,
        is_active: true,
      });
      setSuiteForm({ name: "", parentSuiteId: "", description: "" });
      setShowSuiteModal(false);
      setFilters((current) => ({ ...current, suiteId: String(createdSuite.id) }));
      setRefreshKey((value) => value + 1);
      setMessage("Suite byla vytvořena.");
    } catch (createError) {
      setValidationError(createError instanceof Error ? createError.message : "Suite se nepodařilo vytvořit.");
    }
  }

  function toggleSuiteCollapsed(suiteId: number) {
    setCollapsedSuiteIds((current) => {
      const next = new Set(current);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  }

  function goToParentSuite() {
    if (!currentSuite) {
      return;
    }
    setFilters((current) => ({ ...current, suiteId: currentSuite.parent_suite_id ? String(currentSuite.parent_suite_id) : "" }));
    setSelectedTestCaseId(null);
  }

  if (projectLoading || suitesState.loading || createSuitesState.loading || casesState.loading) {
    return <LoadingState />;
  }

  if (projectError || suitesState.error || createSuitesState.error || casesState.error) {
    return <ErrorState message={projectError ?? suitesState.error ?? createSuitesState.error ?? casesState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <PageHeader title="Repository" description={`Správa test cases v suitách${project ? ` pro ${project.name}` : ""}.`} />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          type="button"
          disabled={!createProjectId}
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />} {showCreateForm ? "Zavřít editor" : "Nový test case"}
        </button>
      </div>
      {validationError && <ErrorState message={validationError} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      {showCreateForm ? (
        <form className="rounded-md border border-slate-200 bg-white" onSubmit={(event) => void handleCreate(event)}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Nový test case</h2>
              <p className="mt-1 text-sm text-slate-500">Ukládá se do projektu: {projectById.get(createProjectId ?? 0)?.name ?? project?.name ?? "-"}</p>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50" type="button" onClick={() => setShowCreateForm(false)}>
                <X size={16} /> Zrušit
              </button>
              <button className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                <Check size={16} /> Vytvořit test case
              </button>
            </div>
          </div>
          <TestCaseFormFields form={form} suites={createSuitesState.data ?? []} availableTypes={availableTypes} onChange={setForm} />
        </form>
      ) : null}

      <section className={`grid gap-6 ${selectedTestCase ? "xl:grid-cols-[320px_minmax(0,1fr)_520px]" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
        <aside className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold"><ListTree size={18} /> Suity</h2>
            <div className="flex items-center gap-2">
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                disabled={!activeProjectId}
                onClick={() => setShowSuiteModal(true)}
                title="Přidat suitu"
                type="button"
              >
                <Plus size={16} />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setSuitesCollapsed(false);
                  setCollapsedSuiteIds(new Set(suites.map((suite) => suite.id)));
                }}
                title="Sbalit suity"
                type="button"
              >
                <ChevronsUp size={16} />
              </button>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setSuitesCollapsed(false);
                  setCollapsedSuiteIds(new Set());
                }}
                title="Rozbalit suity"
                type="button"
              >
                <ChevronsDown size={16} />
              </button>
            </div>
          </div>
          <div className={`max-h-[720px] overflow-auto p-2 ${suitesCollapsed ? "hidden" : ""}`}>
            <button
              className={[
                "mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                filters.suiteId === "" ? "bg-cyan-50 text-cyan-700" : "hover:bg-slate-50",
              ].join(" ")}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, suiteId: "" }))}
            >
              <span className="font-medium">Všechny suity</span>
              <span className="text-xs text-slate-500">{totalCases}</span>
            </button>
            <button
              className={[
                "mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                filters.suiteId === "none" ? "bg-cyan-50 text-cyan-700" : "hover:bg-slate-50",
              ].join(" ")}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, suiteId: "none" }))}
            >
              <span className="font-medium">Bez suity</span>
              <span className="text-xs text-slate-500">{suiteCounts.get(null) ?? 0}</span>
            </button>
            {visibleSuites.map((suite) => {
              const hasChildren = suiteIdsWithChildren.has(suite.id);
              const isCollapsed = collapsedSuiteIds.has(suite.id);
              const rowPadding = 12 + suite.level * 16;
              return (
              <button
                key={suite.id}
                className={[
                  "mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                  filters.suiteId === String(suite.id) ? "bg-cyan-50 text-cyan-700" : "hover:bg-slate-50",
                ].join(" ")}
                style={{ paddingLeft: `${rowPadding}px` }}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, suiteId: String(suite.id) }))}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {hasChildren ? (
                    <span
                      className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-slate-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSuiteCollapsed(suite.id);
                      }}
                      role="button"
                      tabIndex={0}
                      title={isCollapsed ? "Rozbalit suitu" : "Sbalit suitu"}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </span>
                  ) : (
                    <span className="h-5 w-5" />
                  )}
                  <span className="min-w-0 truncate font-medium">{suite.name}</span>
                </span>
                <span className="ml-2 text-xs text-slate-500">{suiteCounts.get(suite.id) ?? 0}</span>
              </button>
            );
            })}
          </div>
        </aside>

        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {currentSuite ? (
                    <button
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                      onClick={goToParentSuite}
                      title="Zpět o úroveň"
                      type="button"
                    >
                      <ArrowLeft size={17} />
                    </button>
                  ) : null}
                  <h2 className="font-semibold">{currentSuite ? currentSuite.name : "All"}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {currentChildSuites.length} suit / {currentSuite ? filteredCases.length : 0} test cases
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({ ...current, suiteId: "" }));
                    setSelectedTestCaseId(null);
                  }}
                >
                  <RotateCcw size={16} /> Reset
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" type="button" title="Další akce">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-2 p-4">
            {currentChildSuites.map((suite) => (
              <button
                key={suite.id}
                className="flex w-full items-center gap-3 rounded-md bg-slate-50 px-3 py-3 text-left text-sm transition hover:bg-slate-100"
                type="button"
                onClick={() => {
                  setFilters((current) => ({ ...current, suiteId: String(suite.id) }));
                  setSelectedTestCaseId(null);
                }}
              >
                <Folder size={18} className="text-slate-500" />
                <span className="min-w-0 flex-1 truncate font-medium">{suite.name}</span>
                <span className="text-xs text-slate-500">{suiteCounts.get(suite.id) ?? 0}</span>
              </button>
            ))}
            {currentSuite ? (
              <label className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
                <input type="checkbox" />
                <span>Select all</span>
              </label>
            ) : null}
            {currentSuite ? filteredCases.map((testCase) => (
              <button
                key={testCase.id}
                className={[
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                  selectedTestCase?.id === testCase.id ? "bg-slate-200" : "bg-slate-50 hover:bg-slate-100",
                ].join(" ")}
                type="button"
                aria-label={`Otevřít test case ${testCase.code}`}
                onClick={() => setSelectedTestCaseId(testCase.id)}
              >
                <input className="pointer-events-none" type="checkbox" tabIndex={-1} />
                <ArrowUp size={16} className={testCase.priority === "critical" || testCase.priority === "high" ? "text-rose-600" : "text-slate-400"} />
                <span className="grid h-6 w-6 place-items-center rounded-md bg-white text-xs text-slate-500">{testCase.automated ? "A" : "M"}</span>
                <span className="font-medium text-cyan-700">{testCase.code}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{testCase.title}</span>
                <span className="hidden rounded-md bg-white px-2 py-1 text-xs text-slate-500 md:inline">{testCase.status}</span>
              </button>
            )) : null}
            {currentChildSuites.length === 0 && (!currentSuite || filteredCases.length === 0) && (
              <div className="rounded-md border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                {currentSuite ? "Tato suita zatím neobsahuje podsložky ani test cases." : "Zatím nejsou vytvořené žádné suity."}
              </div>
            )}
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" type="button" onClick={() => setShowCreateForm(true)}>
              <Plus size={16} /> Quick test
            </button>
          </div>
        </div>

        {selectedTestCase ? (
          <TestCasePreviewPanel
            testCase={selectedTestCase}
            suiteName={suiteName(selectedTestCase.suite_id)}
            projectLabel={projectById.get(selectedTestCase.project_id)?.code ?? String(selectedTestCase.project_id)}
            onClose={() => setSelectedTestCaseId(null)}
          />
        ) : null}
      </section>

      {showSuiteModal ? (
        <CreateSuiteModal
          form={suiteForm}
          suites={suitesState.data ?? []}
          onChange={setSuiteForm}
          onClose={() => setShowSuiteModal(false)}
          onSubmit={handleCreateSuite}
        />
      ) : null}
    </div>
  );
}

function CreateSuiteModal({
  form,
  suites,
  onChange,
  onClose,
  onSubmit,
}: {
  form: SuiteForm;
  suites: TestSuite[];
  onChange: (form: SuiteForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
      <form className="w-full max-w-md rounded-md bg-white p-5 shadow-xl" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Create suite</h2>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button" title="Zavřít">
            <X size={18} />
          </button>
        </div>
        <label className="mt-5 block text-sm">
          <span className="font-medium">Suite name <span className="text-rose-600">*</span></span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="For example: Web Application"
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Parent suite</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.parentSuiteId}
            onChange={(event) => onChange({ ...form, parentSuiteId: event.target.value })}
          >
            <option value="">Project root</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>{" ".repeat(suite.level * 2)}{suite.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Description</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </label>
        <div className="mt-8 flex justify-end gap-2">
          <button className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function TestCasePreviewPanel({
  testCase,
  suiteName,
  projectLabel,
  onClose,
}: {
  testCase: TestCase;
  suiteName: string;
  projectLabel: string;
  onClose: () => void;
}) {
  return (
    <aside className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{testCase.code}</div>
          <h2 className="mt-1 truncate text-2xl font-semibold">{testCase.title}</h2>
          <div className="mt-1 text-sm text-slate-500">{suiteName}</div>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button" title="Zavřít detail">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
        <Link className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" to={`/test-cases/${testCase.id}`}>
          <Edit3 size={16} /> Edit
        </Link>
        <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" type="button">
          <Copy size={16} /> Clone
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" type="button">
          <Trash2 size={16} /> Delete
        </button>
      </div>

      <div className="flex gap-6 border-b border-slate-200 px-5 text-sm font-medium">
        {["General", "Properties", "Runs", "History", "Defects", "Comments"].map((tab, index) => (
          <button key={tab} className={`border-b-2 py-3 ${index === 0 ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500"}`} type="button">
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-6 p-5">
        <section>
          <h3 className="text-sm font-semibold">Description</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{testCase.description || "Not set"}</p>
        </section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <section>
            <h3 className="text-sm font-semibold">Pre-conditions</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{testCase.preconditions || "Not set"}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold">Post-conditions</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{testCase.expected_summary || "Not set"}</p>
          </section>
        </div>
        <section className="rounded-md border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold">Steps</h3>
            <Link className="text-sm font-medium text-cyan-700" to={`/test-cases/${testCase.id}`}>Edit</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {testCase.steps.map((step) => (
              <div key={step.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[42px_1fr]">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 font-semibold text-slate-600">{step.step_order}</div>
                <div>
                  <div className="leading-6">{step.action}</div>
                  {step.expected_result && <div className="mt-1 text-slate-500">Expected: {step.expected_result}</div>}
                  {step.test_data && <div className="mt-1 text-slate-500">Data: {step.test_data}</div>}
                </div>
              </div>
            ))}
            {testCase.steps.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Test case zatím nemá kroky.</div>}
          </div>
        </section>
        <section className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3"><span className="text-slate-500">Projekt</span><span className="font-medium">{projectLabel}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Priorita</span><span className="font-medium">{testCase.priority}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Typ</span><span className="font-medium">{testCase.type}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="font-medium">{testCase.status}</span></div>
          <div className="flex justify-between gap-3"><span className="text-slate-500">Automation</span><span className="font-medium">{testCase.automated ? "Automated" : "Manual"}</span></div>
        </section>
      </div>
    </aside>
  );
}

function TestCaseFormFields({
  form,
  suites,
  availableTypes,
  onChange,
}: {
  form: TestCaseForm;
  suites: Array<{ id: number; name: string; level: number }>;
  availableTypes: string[];
  onChange: (form: TestCaseForm) => void;
}) {
  function updateStep(localId: number, patch: Partial<TestCaseFormStep>) {
    onChange({
      ...form,
      steps: form.steps.map((step) => (step.localId === localId ? { ...step, ...patch } : step)),
    });
  }

  function addStep() {
    const nextId = Math.max(0, ...form.steps.map((step) => step.localId)) + 1;
    onChange({
      ...form,
      steps: [...form.steps, { localId: nextId, action: "", expectedResult: "", testData: "" }],
    });
  }

  function removeStep(localId: number) {
    const nextSteps = form.steps.filter((step) => step.localId !== localId);
    onChange({
      ...form,
      steps: nextSteps.length ? nextSteps : [{ localId: 1, action: "", expectedResult: "", testData: "" }],
    });
  }

  return (
    <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5 p-5">
        <div className="rounded-md border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">Základ</div>
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <label className="text-sm">
                <span className="font-medium">Kód</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="Automaticky" />
              </label>
              <label className="text-sm">
                <span className="font-medium">Název *</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Co přesně tester ověřuje" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Popis</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Preconditions</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.preconditions} onChange={(event) => onChange({ ...form, preconditions: event.target.value })} />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
            <div className="text-sm font-semibold">Test Case Steps</div>
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700" type="button">
              Classic
              <ChevronsDown size={14} />
            </button>
          </div>
          <div>
            {form.steps.map((step, index) => (
              <div key={step.localId} className="grid items-center gap-3 border-b border-slate-100 px-4 py-4 md:grid-cols-[28px_minmax(0,1fr)_minmax(0,0.96fr)_minmax(0,0.96fr)_36px_36px]">
                <div className="text-center text-sm text-slate-700">{index + 1}</div>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.action} onChange={(event) => updateStep(step.localId, { action: event.target.value })} placeholder="Step action" />
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.testData} onChange={(event) => updateStep(step.localId, { testData: event.target.value })} placeholder="Data" />
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.expectedResult} onChange={(event) => updateStep(step.localId, { expectedResult: event.target.value })} placeholder="Expected result" />
                <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" title="Přidat obrázek">
                  <ImageIcon size={15} />
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" onClick={() => removeStep(step.localId)} title="Další akce">
                  <MoreHorizontal size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-4 py-3">
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" type="button" onClick={addStep}>
              <Plus size={16} /> New step
            </button>
          </div>
        </div>
      </div>

      <aside className="border-t border-slate-200 bg-slate-50 p-5 xl:border-l xl:border-t-0">
        <div className="text-sm font-semibold">Vlastnosti</div>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Suite</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={form.suiteId} onChange={(event) => onChange({ ...form, suiteId: event.target.value })}>
              <option value="">Bez suity</option>
              {suites.map((suite) => <option key={suite.id} value={suite.id}>{" ".repeat(suite.level * 2)}{suite.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Priorita</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as Priority })}>
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Typ</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2" list="test-case-types" value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value })} />
            <datalist id="test-case-types">{availableTypes.map((type) => <option key={type} value={type} />)}</datalist>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Status</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as TestCaseStatus })}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-medium">Automated</span>
            <input checked={form.automated} type="checkbox" onChange={(event) => onChange({ ...form, automated: event.target.checked })} />
          </label>
        </div>
      </aside>
    </div>
  );
}
