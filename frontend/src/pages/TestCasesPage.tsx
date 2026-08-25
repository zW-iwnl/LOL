import { Check, Copy, Edit3, ImageIcon, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import {
  createTestCase,
  createTestSuite,
  deleteTestCase,
  deleteTestSuite,
  getTestCases,
  getTestSuites,
  getSuiteGroups,
  getTestCaseTags,
  updateTestCase,
  updateTestSuite,
  type TestCase,
  type TestCaseCreate,
  type TestCaseTag,
  type SuiteGroup,
  type TestSuite,
  type TestStepType,
} from "../api/client";
import type { RepositorySearchType } from "../api/repositorySearch";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { RepositorySearch } from "../components/RepositorySearch";
import { MultiTagSelect, TagChips } from "../components/TestCaseTags";
import { RepositoryWorkspace } from "../components/repository/RepositoryWorkspace";
import { buildRepositoryWorkspaceModel } from "../components/repository/repositoryModel";
import { REPOSITORY_ROOT_LABEL, type SuiteSelection } from "../components/test-suites/suiteTree";
import { useSuiteViewState } from "../components/test-suites/useSuiteViewState";

type Filters = {
  suiteId: string;
  businessAreaIds: number[];
  applicationDomainIds: number[];
  objectTypeIds: number[];
};

type TestCaseForm = {
  suiteId: string;
  code: string;
  title: string;
  description: string;
  preconditions: string;
  expectedSummary: string;
  tagIds: number[];
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
  stepType: TestStepType;
  action: string;
  expectedResult: string;
  testData: string;
  note: string;
};

const emptyForm: TestCaseForm = {
  suiteId: "",
  code: "",
  title: "",
  description: "",
  preconditions: "",
  expectedSummary: "",
  tagIds: [],
  automated: false,
  steps: [{ localId: 1, stepType: "test", action: "", expectedResult: "", testData: "", note: "" }],
};

export function TestCasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenCreate = searchParams.get("new") === "1";
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<Filters>(() => ({
    suiteId: searchParams.get("suite") ?? "",
    businessAreaIds: readNumberParams(searchParams, "business_area_id"),
    applicationDomainIds: readNumberParams(searchParams, "application_domain_id"),
    objectTypeIds: readNumberParams(searchParams, "object_type_id"),
  }));
  const [form, setForm] = useState<TestCaseForm>(emptyForm);
  const [suiteForm, setSuiteForm] = useState<SuiteForm>({ name: "", parentSuiteId: "", description: "" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSuiteModal, setShowSuiteModal] = useState(false);
  const [editingSuiteId, setEditingSuiteId] = useState<number | null>(null);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<number | null>(null);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<number>>(new Set());
  const [deletingTestCases, setDeletingTestCases] = useState(false);
  const [movingTestCases, setMovingTestCases] = useState(false);
  const [favoriteSuiteIds, setFavoriteSuiteIds] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suiteView, setSuiteView] = useSuiteViewState("repository", "folders");
  const suitesState = useApiResource(() => getTestSuites(), [refreshKey]);
  const groupsState = useApiResource<SuiteGroup[]>(() => getSuiteGroups(), [refreshKey]);
  const tagsState = useApiResource(() => getTestCaseTags(), [refreshKey]);
  const tagFilters = {
    businessAreaIds: filters.businessAreaIds,
    applicationDomainIds: filters.applicationDomainIds,
    objectTypeIds: filters.objectTypeIds,
  };
  const repositoryQuery = searchParams.get("q") ?? searchParams.get("search") ?? "";
  const repositorySearchType = parseRepositorySearchType(searchParams.get("type"));
  const casesState = useApiResource(
    () => getTestCases(tagFilters),
    [filters.businessAreaIds.join(","), filters.applicationDomainIds.join(","), filters.objectTypeIds.join(","), refreshKey],
  );
  const tags = tagsState.data ?? [];
  const tagsFor = (category: TestCaseTag["category"]) => tags.filter((tag) => tag.category === category);
  const suiteName = (suiteId: number | null) => suitesState.data?.find((suite) => suite.id === suiteId)?.name ?? REPOSITORY_ROOT_LABEL;
  const suites = suitesState.data ?? [];
  const repositoryModel = useMemo(
    () => buildRepositoryWorkspaceModel(suites, casesState.data ?? []),
    [casesState.data, suites],
  );
  const currentSuiteId = filters.suiteId ? Number(filters.suiteId) : null;
  const suiteById = useMemo(() => new Map(suites.map((suite) => [suite.id, suite])), [suites]);
  const editingSuite = editingSuiteId ? suiteById.get(editingSuiteId) ?? null : null;
  const suiteParentOptions = editingSuite
    ? suites.filter((suite) => suite.id !== editingSuite.id && !suite.path.startsWith(`${editingSuite.path}/`))
    : suites;

  useEffect(() => {
    if (!shouldOpenCreate) return;
    setShowCreateForm(true);
    const suiteId = Number(searchParams.get("suite"));
    if (suiteId && suiteById.has(suiteId)) {
      setForm((current) => ({ ...current, suiteId: String(suiteId) }));
    }
  }, [searchParams, shouldOpenCreate, suiteById]);

  useEffect(() => {
    setFavoriteSuiteIds(readStoredIds("fet-suite-favorites"));
  }, []);

  useEffect(() => {
    const suiteParam = searchParams.get("suite");
    if (suiteParam === "none") {
      setFilters((current) => ({ ...current, suiteId: "" }));
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("suite");
        return next;
      }, { replace: true });
      return;
    }

    const suiteId = Number(suiteParam);
    if (suiteId && suiteById.has(suiteId)) {
      if (filters.suiteId !== String(suiteId)) setFilters((current) => ({ ...current, suiteId: String(suiteId) }));
    } else if (!suiteParam && filters.suiteId) {
      setFilters((current) => ({ ...current, suiteId: "" }));
    }
  }, [filters.suiteId, searchParams, suiteById]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      setNumberParams(next, "business_area_id", filters.businessAreaIds);
      setNumberParams(next, "application_domain_id", filters.applicationDomainIds);
      setNumberParams(next, "object_type_id", filters.objectTypeIds);
      return next.toString() === current.toString() ? current : next;
    }, { replace: true });
  }, [filters.applicationDomainIds, filters.businessAreaIds, filters.objectTypeIds, setSearchParams]);

  function selectSuite(suiteId: number | null, testCaseId: number | null = null) {
    const value = suiteId === null ? "" : String(suiteId);
    setFilters((current) => ({ ...current, suiteId: value }));
    setSelectedTestCaseId(testCaseId);
    setSelectedTestCaseIds(new Set());
    const nextParams = new URLSearchParams(searchParams);
    if (typeof suiteId === "number") nextParams.set("suite", String(suiteId));
    else nextParams.delete("suite");
    setSearchParams(nextParams, { replace: true });
  }

  function updateRepositoryQuery(query: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      setOptionalParam(next, "q", query);
      next.delete("search");
      return next;
    }, { replace: true });
  }

  function updateRepositorySearchType(type: RepositorySearchType) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (type === "all") next.delete("type");
      else next.set("type", type);
      return next;
    }, { replace: true });
  }

  function openSearchSuite(suiteId: number) {
    setFilters((current) => ({ ...current, suiteId: String(suiteId) }));
    setSelectedTestCaseId(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("suite", String(suiteId));
      next.delete("q");
      next.delete("search");
      return next;
    }, { replace: true });
  }

  function openSearchTestCase(testCaseId: number, suiteId: number | null) {
    const value = suiteId === null ? "" : String(suiteId);
    setFilters((current) => ({ ...current, suiteId: value }));
    setSelectedTestCaseId(testCaseId);
    setSelectedTestCaseIds(new Set());
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (suiteId === null) next.delete("suite");
      else next.set("suite", String(suiteId));
      next.delete("q");
      next.delete("search");
      return next;
    }, { replace: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById("repository-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function toggleFavoriteSuite(suiteId: number) {
    const key = "fet-suite-favorites";
    setFavoriteSuiteIds((current) => storeIds(key, current.includes(suiteId) ? current.filter((id) => id !== suiteId) : [...current, suiteId]));
  }

  function selectNavigatorSuite(selection: SuiteSelection) {
    if (selection === "root") {
      selectSuite(null);
    } else {
      selectSuite(selection);
    }
  }

  const selectedTestCase = useMemo(() => {
    return (casesState.data ?? []).find((testCase) => testCase.id === selectedTestCaseId) ?? null;
  }, [casesState.data, selectedTestCaseId]);
  const createFormSelection: SuiteSelection | null = showCreateForm
    ? form.suiteId ? Number(form.suiteId) : "root"
    : null;

  useEffect(() => {
    setSelectedTestCaseIds(new Set());
  }, [filters.applicationDomainIds, filters.businessAreaIds, filters.objectTypeIds]);

  function toggleTestCaseSelection(testCaseId: number, checked: boolean) {
    setSelectedTestCaseIds((current) => {
      const next = new Set(current);
      if (checked) next.add(testCaseId);
      else next.delete(testCaseId);
      return next;
    });
  }

  function toggleAllTestCases(testCaseIds: number[], checked: boolean) {
    setSelectedTestCaseIds((current) => {
      const next = new Set(current);
      for (const testCaseId of testCaseIds) {
        if (checked) next.add(testCaseId);
        else next.delete(testCaseId);
      }
      return next;
    });
  }

  async function handleDeleteSelectedTestCases(testCaseIds: number[]) {
    const ids = testCaseIds.filter((testCaseId) => selectedTestCaseIds.has(testCaseId));
    if (ids.length === 0) return;

    const confirmed = window.confirm(`Opravdu smazat ${ids.length} vybraných test cases? Tuto akci nelze vrátit zpět.`);
    if (!confirmed) return;

    setDeletingTestCases(true);
    setValidationError(null);
    setMessage(null);
    const failedIds = new Set<number>();
    let firstError: string | null = null;

    for (const testCaseId of ids) {
      try {
        await deleteTestCase(testCaseId);
      } catch (deleteError) {
        failedIds.add(testCaseId);
        firstError ??= deleteError instanceof Error ? deleteError.message : "Test case se nepodařilo smazat.";
      }
    }

    const deletedCount = ids.length - failedIds.size;
    setSelectedTestCaseIds((current) => {
      const next = new Set(current);
      for (const testCaseId of ids) next.delete(testCaseId);
      for (const testCaseId of failedIds) next.add(testCaseId);
      return next;
    });
    if (selectedTestCaseId !== null && !failedIds.has(selectedTestCaseId) && ids.includes(selectedTestCaseId)) {
      setSelectedTestCaseId(null);
    }
    if (deletedCount > 0) {
      setMessage(deletedCount === 1 ? "Test case byl smazán." : `Bylo smazáno ${deletedCount} test cases.`);
      setRefreshKey((value) => value + 1);
    }
    if (failedIds.size > 0) {
      setValidationError(`${failedIds.size} test cases se nepodařilo smazat. ${firstError ?? ""}`.trim());
    }
    setDeletingTestCases(false);
  }

  async function handleMoveSelectedTestCases(testCaseIds: number[], target: SuiteSelection) {
    const ids = testCaseIds.filter((testCaseId) => selectedTestCaseIds.has(testCaseId));
    if (ids.length === 0) return;
    const targetSuiteId = target === "root" ? null : target;
    const targetName = target === "root" ? REPOSITORY_ROOT_LABEL : suiteById.get(target)?.name ?? "vybraná suita";
    if (!window.confirm(`Přesunout ${ids.length} test cases do „${targetName}“?`)) return;

    setMovingTestCases(true);
    setValidationError(null);
    setMessage(null);
    const failedIds = new Set<number>();
    let firstError: string | null = null;
    for (const testCaseId of ids) {
      try {
        await updateTestCase(testCaseId, { suite_id: targetSuiteId });
      } catch (moveError) {
        failedIds.add(testCaseId);
        firstError ??= moveError instanceof Error ? moveError.message : "Test case se nepodařilo přesunout.";
      }
    }

    const movedCount = ids.length - failedIds.size;
    setSelectedTestCaseIds((current) => {
      const next = new Set(current);
      for (const testCaseId of ids) next.delete(testCaseId);
      for (const testCaseId of failedIds) next.add(testCaseId);
      return next;
    });
    if (movedCount > 0) {
      setMessage(movedCount === 1 ? `Test case byl přesunut do suity „${targetName}“.` : `Bylo přesunuto ${movedCount} test cases do suity „${targetName}“.`);
      setRefreshKey((value) => value + 1);
    }
    if (failedIds.size > 0) setValidationError(`${failedIds.size} test cases se nepodařilo přesunout. ${firstError ?? ""}`.trim());
    setMovingTestCases(false);
  }

  function validateForm(): string | null {
    if (!form.title.trim()) return "Název test case je povinný.";
    const selectedTags = tags.filter((tag) => form.tagIds.includes(tag.id));
    if (!(["business_area", "application_domain", "object_type"] as const).every((category) => selectedTags.some((tag) => tag.category === category))) {
      return "Business oblast, aplikace/doména a objekt jsou povinné.";
    }
    const incompleteStep = form.steps.find((step) => !step.action.trim() && (step.expectedResult.trim() || step.testData.trim() || step.note.trim()));
    if (incompleteStep) return "Krok s očekávaným výsledkem nebo daty musí mít vyplněnou akci.";
    return null;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const error = validateForm();
    setValidationError(error);
    setMessage(null);
    if (error) return;

    const steps: TestCaseCreate["steps"] = form.steps
      .filter((step) => step.action.trim())
      .map((step, index) => ({
        step_order: index + 1,
        action: step.action.trim(),
        step_type: step.stepType,
        note: step.note.trim() || null,
        expected_result: step.stepType === "test" ? step.expectedResult.trim() || null : null,
        test_data: step.stepType === "test" ? step.testData.trim() || null : null,
      }));

    try {
      await createTestCase({
        suite_id: form.suiteId ? Number(form.suiteId) : null,
        code: form.code.trim() || `TC-${Date.now().toString().slice(-6)}`,
        title: form.title.trim(),
        description: form.description.trim() || null,
        preconditions: form.preconditions.trim() || null,
        expected_summary: null,
        tag_ids: form.tagIds,
        status: "draft",
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

  async function handleSaveSuite(event: FormEvent) {
    event.preventDefault();
    if (!suiteForm.name.trim()) {
      setValidationError("Název suity je povinný.");
      return;
    }

    setValidationError(null);
    setMessage(null);
    try {
      const payload = {
        name: suiteForm.name.trim(),
        parent_suite_id: suiteForm.parentSuiteId ? Number(suiteForm.parentSuiteId) : null,
        description: suiteForm.description.trim() || null,
      };
      const savedSuite = editingSuite
        ? await updateTestSuite(editingSuite.id, payload)
        : await createTestSuite({ ...payload, is_active: true });
      setSuiteForm({ name: "", parentSuiteId: "", description: "" });
      setEditingSuiteId(null);
      setShowSuiteModal(false);
      selectSuite(savedSuite.id);
      setRefreshKey((value) => value + 1);
      setMessage(editingSuite ? "Test suite byla upravena." : "Test suite byla vytvořena.");
    } catch (saveError) {
      setValidationError(saveError instanceof Error ? saveError.message : "Test suite se nepodařilo uložit.");
    }
  }

  function openCreateSuiteModal(selection: SuiteSelection) {
    setEditingSuiteId(null);
    setSuiteForm({ name: "", parentSuiteId: selection === "root" ? "" : String(selection), description: "" });
    setValidationError(null);
    setShowSuiteModal(true);
  }

  function openEditSuiteModal(suite: TestSuite) {
    setEditingSuiteId(suite.id);
    setSuiteForm({
      name: suite.name,
      parentSuiteId: suite.parent_suite_id ? String(suite.parent_suite_id) : "",
      description: suite.description ?? "",
    });
    setValidationError(null);
    setShowSuiteModal(true);
  }

  function closeSuiteModal() {
    setShowSuiteModal(false);
    setEditingSuiteId(null);
    setSuiteForm({ name: "", parentSuiteId: "", description: "" });
  }

  async function handleDeleteSuite(suite: TestSuite) {
    const confirmed = window.confirm(`Smazat test suite "` + suite.name + `"? Mazání je možné jen u prázdné suity bez podsuit a test cases.`);
    if (!confirmed) return;

    const parentSuiteId = suite.parent_suite_id;
    setValidationError(null);
    setMessage(null);
    try {
      await deleteTestSuite(suite.id);
      setFavoriteSuiteIds((current) => storeIds("fet-suite-favorites", current.filter((id) => id !== suite.id)));
      selectSuite(parentSuiteId);
      setSelectedTestCaseId(null);
      setRefreshKey((value) => value + 1);
      setMessage("Test suite byla smazána.");
    } catch (deleteError) {
      setValidationError(deleteError instanceof Error ? deleteError.message : "Test suite se nepodařilo smazat.");
    }
  }

  function openCreateForm(selection: SuiteSelection) {
    setForm((current) => ({
      ...current,
      suiteId: selection === "root" ? "" : String(selection),
    }));
    setShowCreateForm(true);
  }

  if (suitesState.loading || groupsState.loading || tagsState.loading || casesState.loading) {
    return <LoadingState />;
  }

  if (suitesState.error || groupsState.error || tagsState.error || casesState.error) {
    return <ErrorState message={suitesState.error ?? groupsState.error ?? tagsState.error ?? casesState.error ?? "Data nejsou dostupná."} />;
  }
  const createFormNode = showCreateForm ? (
    <TestCaseCreateEditor
      form={form}
      suites={suites}
      tags={tags}
      onChange={setForm}
      onCancel={() => setShowCreateForm(false)}
      onSubmit={handleCreate}
    />
  ) : null;
  const previewNode = selectedTestCase ? (
    <TestCasePreviewPanel
      testCase={selectedTestCase}
      suiteName={suiteName(selectedTestCase.suite_id)}
      onClose={() => setSelectedTestCaseId(null)}
    />
  ) : null;


  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Repository</h2>
      {validationError && <ErrorState message={validationError} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <RepositorySearch
          query={repositoryQuery}
          type={repositorySearchType}
          filterControls={(
            <>
              <MultiTagSelect label="Business oblast" values={filters.businessAreaIds} tags={tagsFor("business_area")} onChange={(values) => setFilters((current) => ({ ...current, businessAreaIds: values }))} />
              <MultiTagSelect label="Aplikace/doména" values={filters.applicationDomainIds} tags={tagsFor("application_domain")} onChange={(values) => setFilters((current) => ({ ...current, applicationDomainIds: values }))} />
              <MultiTagSelect label="Objekt" values={filters.objectTypeIds} tags={tagsFor("object_type")} onChange={(values) => setFilters((current) => ({ ...current, objectTypeIds: values }))} />
            </>
          )}
          {...tagFilters}
          onQueryChange={updateRepositoryQuery}
          onTypeChange={updateRepositorySearchType}
          onSelectSuite={openSearchSuite}
          onSelectTestCase={openSearchTestCase}
        />
      </section>

      <RepositoryWorkspace
        model={repositoryModel}
        groups={groupsState.data ?? []}
        tags={tags}
        onGroupsChanged={() => setRefreshKey((value) => value + 1)}
        selected={currentSuiteId ?? "root"}
        view={suiteView}
        query={repositorySearchType === "cases" ? "" : repositoryQuery}
        favoriteSuiteIds={favoriteSuiteIds}
        selectedCaseIds={selectedTestCaseIds}
        deletingCases={deletingTestCases}
        movingCases={movingTestCases}
        createForm={createFormNode}
        createFormSelection={createFormSelection}
        preview={previewNode}
        onViewChange={setSuiteView}
        onSelectSuite={selectNavigatorSuite}
        onToggleFavorite={toggleFavoriteSuite}
        onCreateTestCase={openCreateForm}
        onCreateSuite={openCreateSuiteModal}
        onEditSuite={openEditSuiteModal}
        onDeleteSuite={(suite) => void handleDeleteSuite(suite)}
        onToggleCase={toggleTestCaseSelection}
        onToggleAllCases={toggleAllTestCases}
        onDeleteCases={(testCaseIds) => void handleDeleteSelectedTestCases(testCaseIds)}
        onMoveCases={(testCaseIds, target) => void handleMoveSelectedTestCases(testCaseIds, target)}
        onOpenCase={(testCase) => setSelectedTestCaseId(testCase.id)}
      />


      {showSuiteModal ? (
        <SuiteModal
          form={suiteForm}
          suites={suiteParentOptions}
          editing={Boolean(editingSuite)}
          onChange={setSuiteForm}
          onClose={closeSuiteModal}
          onSubmit={handleSaveSuite}
        />
      ) : null}
    </div>
  );
}

function parseRepositorySearchType(value: string | null): RepositorySearchType {
  return value === "suites" || value === "cases" ? value : "all";
}

function setOptionalParam(params: URLSearchParams, name: string, value: string) {
  const normalized = value.trim();
  if (normalized) params.set(name, normalized);
  else params.delete(name);
}

function readNumberParams(params: URLSearchParams, name: string): number[] {
  return params.getAll(name).map(Number).filter((value) => Number.isInteger(value) && value > 0);
}

function setNumberParams(params: URLSearchParams, name: string, values: number[]) {
  params.delete(name);
  for (const value of values) params.append(name, String(value));
}


function readStoredIds(key: string): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function storeIds(key: string, ids: number[]): number[] {
  localStorage.setItem(key, JSON.stringify(ids));
  return ids;
}


function TestCaseCreateEditor({
  form,
  suites,
  tags,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: TestCaseForm;
  suites: TestSuite[];
  tags: TestCaseTag[];
  onChange: (form: TestCaseForm) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="bg-white" onSubmit={(event) => void onSubmit(event)}>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nový test case</h2>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100" type="button" onClick={onCancel}>
            <X size={16} /> Zrušit
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            <Check size={16} /> Vytvořit test case
          </button>
        </div>
      </div>
      <TestCaseFormFields form={form} suites={suites} tags={tags} onChange={onChange} />
    </form>
  );
}

function SuiteModal({
  form,
  suites,
  editing,
  onChange,
  onClose,
  onSubmit,
}: {
  form: SuiteForm;
  suites: TestSuite[];
  editing: boolean;
  onChange: (form: SuiteForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
      <form className="w-full max-w-md rounded-md bg-white p-5 shadow-xl" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{editing ? "Upravit test suite" : "Vytvořit test suite"}</h2>
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} type="button" title="Zavřít">
            <X size={18} />
          </button>
        </div>
        <label className="mt-5 block text-sm">
          <span className="font-medium">Název suity <span className="text-rose-600">*</span></span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Například Webová aplikace"
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Nadřazená suita</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.parentSuiteId}
            onChange={(event) => onChange({ ...form, parentSuiteId: event.target.value })}
          >
            <option value="">{REPOSITORY_ROOT_LABEL}</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>{" ".repeat(suite.level * 2)}{suite.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Popis</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </label>
        <div className="mt-8 flex justify-end gap-2">
          <button className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200" onClick={onClose} type="button">
            Zrušit
          </button>
          <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            {editing ? "Uložit změny" : "Vytvořit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TestCasePreviewPanel({
  testCase,
  suiteName,
  onClose,
}: {
  testCase: TestCase;
  suiteName: string;
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
        {["General", "Properties", "Runs", "History", "Comments"].map((tab, index) => (
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="leading-6">{step.action}</span>
                    <span className={step.step_type === "information" ? "rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-700" : "rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"}>
                      {step.step_type === "information" ? "Netestovací" : "Testovací"}
                    </span>
                  </div>
                  {step.note && <div className="mt-1 text-slate-500">Poznámka: {step.note}</div>}
                  {step.step_type === "test" && step.expected_result && <div className="mt-1 text-slate-500">Expected: {step.expected_result}</div>}
                  {step.step_type === "test" && step.test_data && <div className="mt-1 text-slate-500">Data: {step.test_data}</div>}
                </div>
              </div>
            ))}
            {testCase.steps.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Test case zatím nemá kroky.</div>}
          </div>
        </section>
        <section className="grid gap-2 text-sm">
          <TagChips label="Business oblast" values={testCase.tags.filter((tag) => tag.category === "business_area").map((tag) => tag.name)} />
          <TagChips label="Aplikace/doména" values={testCase.tags.filter((tag) => tag.category === "application_domain").map((tag) => tag.name)} />
          <TagChips label="Objekt" values={testCase.tags.filter((tag) => tag.category === "object_type").map((tag) => tag.name)} />
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
  tags,
  onChange,
}: {
  form: TestCaseForm;
  suites: Array<{ id: number; name: string; level: number }>;
  tags: TestCaseTag[];
  onChange: (form: TestCaseForm) => void;
}) {
  const tagsFor = (category: TestCaseTag["category"]) => tags.filter((tag) => tag.category === category);
  function updateStep(localId: number, patch: Partial<TestCaseFormStep>) {
    onChange({
      ...form,
      steps: form.steps.map((step) => (step.localId === localId ? { ...step, ...patch } : step)),
    });
  }

  function addStep(stepType: TestStepType) {
    const nextId = Math.max(0, ...form.steps.map((step) => step.localId)) + 1;
    onChange({
      ...form,
      steps: [...form.steps, { localId: nextId, stepType, action: "", expectedResult: "", testData: "", note: "" }],
    });
  }

  function removeStep(localId: number) {
    const nextSteps = form.steps.filter((step) => step.localId !== localId);
    onChange({
      ...form,
      steps: nextSteps.length ? nextSteps : [{ localId: 1, stepType: "test", action: "", expectedResult: "", testData: "", note: "" }],
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
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">Test Case Steps</div>
          <div>
            {form.steps.map((step, index) => (
              <div key={step.localId} className="border-b border-slate-100 px-4 py-4">
                {step.stepType === "test" ? (
                  <>
                    <div className="grid items-center gap-3 md:grid-cols-[28px_minmax(0,1fr)_minmax(0,0.96fr)_minmax(0,0.96fr)_36px_36px]">
                      <div className="text-center text-sm text-slate-700">{index + 1}</div>
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.action} onChange={(event) => updateStep(step.localId, { action: event.target.value })} placeholder="Step action" />
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.testData} onChange={(event) => updateStep(step.localId, { testData: event.target.value })} placeholder="Data" />
                      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.expectedResult} onChange={(event) => updateStep(step.localId, { expectedResult: event.target.value })} placeholder="Expected result" />
                      <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" title="Přidat obrázek">
                        <ImageIcon size={15} />
                      </button>
                      <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" onClick={() => removeStep(step.localId)} title="Odstranit krok">
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                    <input className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm md:ml-10 md:w-[calc(100%_-_2.5rem)]" value={step.note} onChange={(event) => updateStep(step.localId, { note: event.target.value })} placeholder="Poznámka ke kroku" />
                  </>
                ) : (
                  <div className="grid items-center gap-3 md:grid-cols-[28px_150px_minmax(0,1fr)_minmax(0,0.8fr)_36px]">
                    <div className="text-center text-sm text-slate-700">{index + 1}</div>
                    <span className="rounded-md bg-sky-50 px-3 py-2 text-center text-xs font-medium text-sky-700">Netestovací krok</span>
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.action} onChange={(event) => updateStep(step.localId, { action: event.target.value })} placeholder="Informační instrukce" />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={step.note} onChange={(event) => updateStep(step.localId, { note: event.target.value })} placeholder="Poznámka" />
                    <button className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" type="button" onClick={() => removeStep(step.localId)} title="Odstranit krok">
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200" type="button" onClick={() => addStep("test")}>
              <Plus size={16} /> Nový krok
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100" type="button" onClick={() => addStep("information")}>
              <Plus size={16} /> Nový netestovací
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
              <option value="">{REPOSITORY_ROOT_LABEL}</option>
              {suites.map((suite) => <option key={suite.id} value={suite.id}>{" ".repeat(suite.level * 2)}{suite.name}</option>)}
            </select>
          </label>
          {([
            ["business_area", "Business oblast"],
            ["application_domain", "Aplikace/doména"],
            ["object_type", "Objekt"],
          ] as const).map(([category, label]) => {
            const categoryTags = tagsFor(category);
            const categoryIds = new Set(categoryTags.map((tag) => tag.id));
            return (
              <MultiTagSelect
                key={category}
                label={label}
                required
                values={form.tagIds.filter((id) => categoryIds.has(id))}
                tags={categoryTags}
                onChange={(values) => onChange({ ...form, tagIds: [...form.tagIds.filter((id) => !categoryIds.has(id)), ...values] })}
              />
            );
          })}
          <label className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-medium">Automated</span>
            <input checked={form.automated} type="checkbox" onChange={(event) => onChange({ ...form, automated: event.target.checked })} />
          </label>
        </div>
      </aside>
    </div>
  );
}
