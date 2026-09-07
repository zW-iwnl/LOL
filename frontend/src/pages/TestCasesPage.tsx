import { Check } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  createTestCase,
  createTestSuite,
  deleteTestCase,
  deleteTestSuite,
  getSuiteGroups,
  getTestCases,
  getTestCaseTags,
  getTestSuites,
  updateTestCase,
  updateTestSuite,
  type SuiteGroup,
  type TestCase,
  type TestSuite,
} from "../api/client";
import type { RepositorySearchType } from "../api/repositorySearch";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { AccessibleDialog } from "../components/AccessibleDialog";
import { PageHeader } from "../components/PageHeader";
import { RepositorySearch } from "../components/RepositorySearch";
import {
  RepositoryWorkspace,
  type RepositoryTab,
} from "../components/repository/RepositoryWorkspace";
import {
  createEmptyTestCaseDraft,
  prepareTestCaseSteps,
  TestCaseCreatePanel,
  type TestCaseDraft,
} from "../components/repository/TestCaseCreatePanel";

type SuiteForm = {
  name: string;
  description: string;
  isActive: boolean;
  groupIds: number[];
};

const emptySuiteForm: SuiteForm = {
  name: "",
  description: "",
  isActive: true,
  groupIds: [],
};

export function TestCasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [suiteForm, setSuiteForm] = useState<SuiteForm>(emptySuiteForm);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [showSuiteForm, setShowSuiteForm] = useState(false);
  const [caseForm, setCaseForm] = useState<TestCaseDraft>(createEmptyTestCaseDraft(null));
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [continueToCaseAfterSuite, setContinueToCaseAfterSuite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movingCaseId, setMovingCaseId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const suitesState = useApiResource(getTestSuites, [refreshKey]);
  const groupsState = useApiResource(getSuiteGroups, [refreshKey]);
  const casesState = useApiResource(() => getTestCases(), [refreshKey]);
  const tagsState = useApiResource(getTestCaseTags, [refreshKey]);

  const activeTab = parseTab(searchParams.get("tab"));
  const searchType = parseSearchType(searchParams.get("searchType"));
  const selectedGroupId = parsePositiveId(searchParams.get("group"));
  const selectedSuiteId = parsePositiveId(searchParams.get("suite"));
  const urlSearchQuery = searchParams.get("q") ?? "";
  const shouldOpenCaseForm = searchParams.get("new") === "1";
  const suites = suitesState.data ?? [];
  const groups = groupsState.data ?? [];
  const testCases = casesState.data ?? [];
  useEffect(() => {
    setSearchQuery(urlSearchQuery);
  }, [urlSearchQuery]);
  useEffect(() => {
    if (!showCaseForm) return;
    requestAnimationFrame(() => {
      document.getElementById("test-case-create-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [showCaseForm]);
  useEffect(() => {
    if (!shouldOpenCaseForm || suitesState.loading) return;
    openCreateCase(selectedSuiteId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("new");
      next.set("tab", "cases");
      return next;
    }, { replace: true });
  }, [shouldOpenCaseForm, suitesState.loading]);
  const tags = tagsState.data ?? [];
  const loading = [suitesState, groupsState, casesState, tagsState]
    .some((state) => state.loading && state.data === null);
  const loadError = [
    suitesState.error,
    groupsState.error,
    casesState.error,
    tagsState.error,
  ].find(Boolean);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function setActiveTab(tab: RepositoryTab) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }


  function setRepositorySearchQuery(query: string) {
    setSearchQuery(query);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (query) next.set("q", query);
      else next.delete("q");
      return next;
    }, { replace: true });
  }

  function setRepositorySearchType(type: RepositorySearchType) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (type === "all") next.delete("searchType");
      else next.set("searchType", type);
      return next;
    }, { replace: true });
  }

  function setSelectedGroupId(groupId: number | null) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "groups");
      next.delete("q");
      if (groupId === null) next.delete("group");
      else next.set("group", String(groupId));
      return next;
    }, { replace: true });
  }


  function showSuiteInList(suiteId: number) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "suites");
      next.delete("q");
      next.set("suite", String(suiteId));
      return next;
    }, { replace: true });
  }

  function openCreateSuite() {
    setContinueToCaseAfterSuite(false);
    setEditingSuite(null);
    setSuiteForm(emptySuiteForm);
    setFeedback(null);
    setFormError(null);
    setShowSuiteForm(true);
  }

  function openEditSuite(suite: TestSuite) {
    setEditingSuite(suite);
    setSuiteForm({
      name: suite.name,
      description: suite.description ?? "",
      isActive: suite.is_active,
      groupIds: suite.group_ids,
    });
    setFeedback(null);
    setFormError(null);
    setShowSuiteForm(true);
  }

  async function saveSuite(event: FormEvent) {
    event.preventDefault();
    if (!suiteForm.name.trim()) {
      setFormError("Vyplňte název test suity.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    setFormError(null);
    try {
      const payload = {
        name: suiteForm.name.trim(),
        description: suiteForm.description.trim() || null,
        is_active: suiteForm.isActive,
        group_ids: suiteForm.groupIds,
      };
      const savedSuite = editingSuite
        ? await updateTestSuite(editingSuite.id, payload)
        : await createTestSuite(payload);
      const shouldContinueToCase = continueToCaseAfterSuite && !editingSuite;
      setShowSuiteForm(false);
      setEditingSuite(null);
      setSuiteForm(emptySuiteForm);
      setContinueToCaseAfterSuite(false);
      refresh();
      setFeedback({
        kind: "success",
        message: editingSuite ? "Test suite byla upravena." : "Test suite byla vytvořena.",
      });
      if (shouldContinueToCase) {
        setCaseForm(createEmptyTestCaseDraft(savedSuite.id));
        setShowCaseForm(true);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Test suitu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSuite(suite: TestSuite) {
    if (!window.confirm(`Smazat prázdnou test suitu „${suite.name}“?`)) return;
    setFeedback(null);
    try {
      await deleteTestSuite(suite.id);
      refresh();
      setFeedback({ kind: "success", message: "Test suite byla smazána." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Test suitu se nepodařilo smazat.",
      });
    }
  }

  function openCreateCase(suiteId: number | null) {
    if (suites.length === 0) {
      setContinueToCaseAfterSuite(true);
      setEditingSuite(null);
      setSuiteForm(emptySuiteForm);
      setFeedback(null);
      setFormError(null);
      setShowSuiteForm(true);
      return;
    }
    const fallbackSuiteId = suiteId ?? suites[0]?.id ?? null;
    setCaseForm(createEmptyTestCaseDraft(fallbackSuiteId));
    setFeedback(null);
    setFormError(null);
    setShowCaseForm(true);
  }

  async function saveCase(event: FormEvent) {
    event.preventDefault();
    if (!caseForm.suiteId) {
      setFormError("Vyberte test suitu.");
      return;
    }
    if (!caseForm.code.trim() || !caseForm.title.trim()) {
      setFormError("Vyplňte kód a název test case.");
      return;
    }
    const preparedSteps = prepareTestCaseSteps(caseForm.steps);
    if (preparedSteps.error) {
      setFormError(preparedSteps.error);
      return;
    }
    setSaving(true);
    setFeedback(null);
    setFormError(null);
    try {
      await createTestCase({
        suite_id: Number(caseForm.suiteId),
        code: caseForm.code.trim(),
        title: caseForm.title.trim(),
        description: caseForm.description.trim() || null,
        preconditions: null,
        expected_summary: null,
        status: caseForm.status,
        automated: caseForm.automated,
        tag_ids: caseForm.tagIds,
        steps: preparedSteps.steps,
      });
      setShowCaseForm(false);
      refresh();
      setFeedback({ kind: "success", message: "Test case byl vytvořen." });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Test case se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCase(testCase: TestCase) {
    if (!window.confirm(
      `Vyřadit test case ${testCase.code}? Nepoužitý koncept bude odstraněn, ostatní test cases se označí jako Vyřazeno.`,
    )) return;
    setFeedback(null);
    try {
      await deleteTestCase(testCase.id);
      refresh();
      setFeedback({ kind: "success", message: "Test case byl vyřazen." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Test case se nepodařilo vyřadit.",
      });
    }
  }

  async function moveCase(testCase: TestCase, suiteId: number) {
    if (suiteId === testCase.suite_id) return;
    const suite = suites.find((item) => item.id === suiteId);
    if (!window.confirm(
      `Přesunout ${testCase.code} do test suity „${suite?.name ?? `#${suiteId}`}“?`,
    )) return;
    setMovingCaseId(testCase.id);
    setFeedback(null);
    try {
      await updateTestCase(testCase.id, { suite_id: suiteId });
      refresh();
      setFeedback({ kind: "success", message: `Test case ${testCase.code} byl přesunut do jiné suity.` });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Test case se nepodařilo přesunout.",
      });
    } finally {
      setMovingCaseId(null);
    }
  }

  if (loading) return <LoadingState />;
  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Repository"
          description="Skupiny, ploché test suity, test cases a tagy na jednom místě."
        />
        <ErrorState message={loadError} />
        <button
          className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white"
          type="button"
          onClick={refresh}
        >
          Zkusit načíst znovu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repository"
        description="Skupiny, ploché test suity, test cases a tagy na jednom místě."
      />
      {feedback && (
        <div
          aria-live="polite"
          className={feedback.kind === "error"
            ? "rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}

      <section className="rounded-md border border-slate-200 bg-white">
        <RepositorySearch
          query={searchQuery}
          type={searchType}
          onQueryChange={setRepositorySearchQuery}
          onTypeChange={setRepositorySearchType}
          onSelectGroup={(groupId) => {
            setSearchQuery("");
            setSelectedGroupId(groupId);
          }}
          onSelectSuite={(suiteId) => {
            setSearchQuery("");
            showSuiteInList(suiteId);
          }}
          onSelectTestCase={(testCaseId) => navigate(`/test-cases/${testCaseId}`)}
        />
      </section>

      {showCaseForm && (
        <TestCaseCreatePanel
          error={formError}
          form={caseForm}
          saving={saving}
          suites={suites}
          tags={tags}
          onChange={(nextForm) => {
            setCaseForm(nextForm);
            setFormError(null);
          }}
          onClose={() => {
            setShowCaseForm(false);
            setFormError(null);
          }}
          onSubmit={saveCase}
        />
      )}

      <RepositoryWorkspace
        activeTab={activeTab}
        onTabChange={setActiveTab}
        groups={groups}
        suites={suites}
        testCases={testCases}
        tags={tags}
        selectedGroupId={selectedGroupId}
        onSelectedGroupChange={setSelectedGroupId}
        selectedSuiteId={selectedSuiteId}
        onChanged={refresh}
        onCreateSuite={openCreateSuite}
        onEditSuite={openEditSuite}
        onDeleteSuite={(suite) => void removeSuite(suite)}
        onCreateCase={openCreateCase}
        onOpenCase={(testCase) => navigate(`/test-cases/${testCase.id}`)}
        onDeleteCase={(testCase) => void removeCase(testCase)}
        onMoveCase={(testCase, suiteId) => void moveCase(testCase, suiteId)}
        movingCaseId={movingCaseId}
      />

      {showSuiteForm && (
        <SuiteModal
          form={suiteForm}
          groups={groups}
          editing={editingSuite !== null}
          continuingToCase={continueToCaseAfterSuite}
          saving={saving}
          error={formError}
          onChange={setSuiteForm}
          onClose={() => {
            setShowSuiteForm(false);
            setContinueToCaseAfterSuite(false);
            setFormError(null);
          }}
          onSubmit={saveSuite}
        />
      )}
    </div>
  );
}

function parseTab(value: string | null): RepositoryTab {
  return value === "suites" || value === "cases" || value === "tags"
    ? value
    : "groups";
}


function parseSearchType(value: string | null): RepositorySearchType {
  return value === "suites" || value === "groups" || value === "cases"
    ? value
    : "all";
}

function SuiteModal({
  form,
  groups,
  editing,
  continuingToCase,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  form: SuiteForm;
  groups: SuiteGroup[];
  editing: boolean;
  continuingToCase: boolean;
  saving: boolean;
  error: string | null;
  onChange: (form: SuiteForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <AccessibleDialog
      title={editing ? "Upravit test suitu" : continuingToCase ? "Nejprve vytvořte test suitu" : "Nová test suite"}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        {continuingToCase && (
          <p className="rounded-md bg-cyan-50 p-3 text-sm text-cyan-900">
            Každý test case musí patřit do test suity. Po jejím uložení se automaticky otevře formulář test case.
          </p>
        )}
        <FormError message={error} />
        <label className="block text-sm">
          <span className="font-medium">Název *</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            required
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Popis</span>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </label>
        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Skupiny</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((group) => (
              <label className="flex items-center gap-2 text-sm" key={group.id}>
                <input
                  checked={form.groupIds.includes(group.id)}
                  type="checkbox"
                  onChange={(event) => onChange({
                    ...form,
                    groupIds: event.target.checked
                      ? [...form.groupIds, group.id]
                      : form.groupIds.filter((id) => id !== group.id),
                  })}
                />
                #{group.id} {group.name}
              </label>
            ))}
            {groups.length === 0 && <span className="text-sm text-slate-500">Zatím bez skupin.</span>}
          </div>
        </fieldset>
        <label className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm">
          <span className="font-medium">Aktivní</span>
          <input
            checked={form.isActive}
            type="checkbox"
            onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          />
        </label>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </AccessibleDialog>
  );
}

function ModalActions({ saving, onClose }: { saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
      <button className="rounded-md border border-slate-200 px-4 py-2 text-sm disabled:opacity-50" disabled={saving} type="button" onClick={onClose}>
        Zrušit
      </button>
      <button className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit">
        <Check size={16} /> {saving ? "Ukládám…" : "Uložit"}
      </button>

    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function parsePositiveId(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
