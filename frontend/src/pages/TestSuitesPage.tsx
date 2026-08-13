import { ChevronDown, ChevronRight, Plus, RefreshCw, Save, Search, Trash2, Unlink } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTestSuite,
  deleteTestSuite,
  getTestSuiteChildren,
  getTestSuites,
  getTestSuiteTestCases,
  searchTestSuites,
  updateTestCase,
  updateTestSuite,
  type TestCase,
  type TestSuite,
} from "../api/client";
import { ErrorState, LoadingState, useCurrentProject } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";

type SuiteForm = {
  name: string;
  description: string;
  placement: "root" | "child";
  parentSuiteId: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: SuiteForm = {
  name: "",
  description: "",
  placement: "root",
  parentSuiteId: "",
  sortOrder: "0",
  isActive: true,
};

function formFromSuite(suite: TestSuite | null): SuiteForm {
  if (!suite) {
    return emptyForm;
  }

  return {
    name: suite.name,
    description: suite.description ?? "",
    placement: suite.parent_suite_id ? "child" : "root",
    parentSuiteId: suite.parent_suite_id?.toString() ?? "",
    sortOrder: suite.sort_order.toString(),
    isActive: suite.is_active,
  };
}

export function TestSuitesPage() {
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const [rootSuites, setRootSuites] = useState<TestSuite[]>([]);
  const [allSuites, setAllSuites] = useState<TestSuite[]>([]);
  const [childrenBySuite, setChildrenBySuite] = useState<Record<number, TestSuite[]>>({});
  const [expandedSuiteIds, setExpandedSuiteIds] = useState<Set<number>>(new Set());
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TestSuite[] | null>(null);
  const [createForm, setCreateForm] = useState<SuiteForm>(emptyForm);
  const [editForm, setEditForm] = useState<SuiteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const editParentOptions = useMemo(() => {
    if (!selectedSuite) {
      return allSuites;
    }
    return allSuites.filter((suite) => suite.id !== selectedSuite.id && !suite.path.startsWith(`${selectedSuite.path}/`));
  }, [allSuites, selectedSuite]);

  useEffect(() => {
    if (!project) {
      return;
    }

    setLoading(true);
    setError(null);
    getTestSuites(project.id)
      .then((suites) => {
        const roots = suites.filter((suite) => suite.parent_suite_id === null);
        setAllSuites(suites);
        setRootSuites(roots);
        setChildrenBySuite({});
        setExpandedSuiteIds(new Set());
        setSelectedSuite((current) => current ?? roots[0] ?? null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Suity se nepodařilo načíst."))
      .finally(() => setLoading(false));
  }, [project]);

  useEffect(() => {
    if (!selectedSuite) {
      setTestCases([]);
      setEditForm(emptyForm);
      return;
    }

    setEditForm(formFromSuite(selectedSuite));
    setCasesLoading(true);
    getTestSuiteTestCases(selectedSuite.id)
      .then(setTestCases)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Test cases se nepodařilo načíst."))
      .finally(() => setCasesLoading(false));
  }, [selectedSuite]);

  useEffect(() => {
    if (!project || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = window.setTimeout(() => {
      searchTestSuites(project.id, query.trim())
        .then(setSearchResults)
        .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Vyhledávání selhalo."));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [project, query]);

  async function loadChildren(suite: TestSuite) {
    setError(null);
    try {
      const children = await getTestSuiteChildren(suite.id);
      setChildrenBySuite((current) => ({ ...current, [suite.id]: children }));
      setExpandedSuiteIds((current) => new Set(current).add(suite.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Children se nepodařilo načíst.");
    }
  }

  async function toggleSuite(suite: TestSuite) {
    if (expandedSuiteIds.has(suite.id)) {
      setExpandedSuiteIds((current) => {
        const next = new Set(current);
        next.delete(suite.id);
        return next;
      });
      return;
    }

    await loadChildren(suite);
  }

  async function selectSuite(suite: TestSuite) {
    setSelectedSuite(suite);
    if (!childrenBySuite[suite.id]) {
      await loadChildren(suite);
    }
  }

  async function refreshRoots() {
    if (!project) {
      return;
    }
    setLoading(true);
    const suites = await getTestSuites(project.id);
    setAllSuites(suites);
    setRootSuites(suites.filter((suite) => suite.parent_suite_id === null));
    setLoading(false);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!project || !createForm.name.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const created = await createTestSuite(project.id, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        parent_suite_id: createForm.placement === "child" && createForm.parentSuiteId ? Number(createForm.parentSuiteId) : null,
        sort_order: Number(createForm.sortOrder) || 0,
        is_active: createForm.isActive,
      });
      setMessage("Test suite byla vytvořena.");
      setCreateForm(emptyForm);
      if (created.parent_suite_id) {
        await loadChildren({ ...created, id: created.parent_suite_id });
      }
      await refreshRoots();
      setSelectedSuite(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Test suite se nepodařilo vytvořit.");
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    if (!selectedSuite || !editForm.name.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const updated = await updateTestSuite(selectedSuite.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        parent_suite_id: editForm.placement === "child" && editForm.parentSuiteId ? Number(editForm.parentSuiteId) : null,
        sort_order: Number(editForm.sortOrder) || 0,
        is_active: editForm.isActive,
      });
      setMessage("Test suite byla upravena.");
      await refreshRoots();
      if (updated.parent_suite_id) {
        await loadChildren({ ...updated, id: updated.parent_suite_id });
      }
      setSelectedSuite(updated);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Test suite se nepodařilo upravit.");
    }
  }

  async function handleDeleteSelectedSuite() {
    if (!selectedSuite) {
      return;
    }
    const confirmed = window.confirm(`Smazat test suite "${selectedSuite.name}"? Mazání je povolené jen pro prázdné suity bez podsuity a test cases.`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await deleteTestSuite(selectedSuite.id);
      setMessage("Test suite byla smazána.");
      setSelectedSuite(null);
      setTestCases([]);
      await refreshRoots();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Test suite se nepodařilo smazat.");
    }
  }

  async function handleRemoveTestCaseFromSuite(testCase: TestCase) {
    if (!selectedSuite) {
      return;
    }
    const confirmed = window.confirm(`Odebrat test case ${testCase.code} ze suity "${selectedSuite.name}"? Test case zůstane v projektu bez suity.`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await updateTestCase(testCase.id, { suite_id: null });
      setMessage("Test case byl odebrán ze suity.");
      const updatedCases = await getTestSuiteTestCases(selectedSuite.id);
      setTestCases(updatedCases);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Test case se nepodařilo odebrat ze suity.");
    }
  }

  function renderSuiteTree(suites: TestSuite[]) {
    return suites.map((suite) => {
      const children = childrenBySuite[suite.id] ?? [];
      const expanded = expandedSuiteIds.has(suite.id);
      const selected = selectedSuite?.id === suite.id;

      return (
        <div key={suite.id}>
          <div
            className={[
              "mb-1 grid grid-cols-[28px_1fr] items-center rounded-md text-sm",
              selected ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-50",
            ].join(" ")}
            style={{ marginLeft: `${suite.level * 16}px` }}
          >
            <button className="grid h-9 place-items-center" type="button" onClick={() => void toggleSuite(suite)}>
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <button className="min-w-0 py-2 pr-3 text-left" type="button" onClick={() => void selectSuite(suite)}>
              <span className="block truncate font-medium">{suite.name}</span>
            </button>
          </div>
          {expanded && children.length > 0 && renderSuiteTree(children)}
        </div>
      );
    });
  }

  if (projectLoading || loading) {
    return <LoadingState />;
  }

  if (projectError) {
    return <ErrorState message={projectError} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Test Suity" description="Strom testovacích sad, detail vybrané suity a správa parent vazeb." />
      {error && <ErrorState message={error} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      <section className="grid gap-6 xl:grid-cols-[340px_1fr_380px]">
        <aside className="rounded-md border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-200 p-4">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm"
                placeholder="Hledat podle názvu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700" type="button" onClick={() => void refreshRoots()}>
              <RefreshCw size={15} /> Obnovit root suity
            </button>
          </div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {searchResults ? (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-medium uppercase text-slate-500">Výsledky hledání</div>
                {searchResults.map((suite) => (
                  <button
                    key={suite.id}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                    type="button"
                    onClick={() => void selectSuite(suite)}
                  >
                    <span className="block font-medium">{suite.name}</span>
                    <span className="text-xs text-slate-500">{suite.path}</span>
                  </button>
                ))}
              </div>
            ) : (
              renderSuiteTree(rootSuites)
            )}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Detail test suite</h2>
            {selectedSuite ? (
              <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                <div><dt className="text-slate-500">Název</dt><dd className="mt-1 font-medium">{selectedSuite.name}</dd></div>
                <div><dt className="text-slate-500">Stav</dt><dd className="mt-1 font-medium">{selectedSuite.is_active ? "Aktivní" : "Neaktivní"}</dd></div>
                <div><dt className="text-slate-500">Parent suite ID</dt><dd className="mt-1 font-medium">{selectedSuite.parent_suite_id ?? "Root"}</dd></div>
                <div><dt className="text-slate-500">Sort order</dt><dd className="mt-1 font-medium">{selectedSuite.sort_order}</dd></div>
                <div className="md:col-span-2"><dt className="text-slate-500">Popis</dt><dd className="mt-1">{selectedSuite.description ?? "-"}</dd></div>
                <div className="md:col-span-2 rounded-md bg-slate-50 p-3">
                  <dt className="text-xs font-medium uppercase text-slate-500">Debug</dt>
                  <dd className="mt-2 text-xs text-slate-600">Path: {selectedSuite.path} | Level: {selectedSuite.level}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Vyber test suite ze stromu.</p>
            )}
          </section>

          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold">Test cases v dané suitě</h2>
            </div>
            {casesLoading ? (
              <div className="p-5 text-sm text-slate-500">Načítám test cases...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Kód</th>
                      <th className="px-5 py-3 font-medium">Název</th>
                      <th className="px-5 py-3 font-medium">Priorita</th>
                      <th className="px-5 py-3 font-medium">Stav</th>
                      <th className="px-5 py-3 font-medium">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((testCase) => (
                      <tr key={testCase.id} className="border-t border-slate-100">
                        <td className="px-5 py-3 font-medium text-cyan-700">
                          <Link to={`/test-cases/${testCase.id}`}>{testCase.code}</Link>
                        </td>
                        <td className="px-5 py-3">{testCase.title}</td>
                        <td className="px-5 py-3">{testCase.priority}</td>
                        <td className="px-5 py-3">{testCase.status}</td>
                        <td className="px-5 py-3">
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                            type="button"
                            onClick={() => void handleRemoveTestCaseFromSuite(testCase)}
                          >
                            <Unlink size={14} /> Odebrat ze suity
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {testCases.length === 0 && <div className="p-5 text-sm text-slate-500">Vybraná suite zatím nemá test cases.</div>}
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-6">
          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreate(event)}>
            <h2 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Nová test suite</h2>
            <SuiteFormFields form={createForm} allSuites={allSuites} onChange={setCreateForm} submitLabel="Vytvořit suitu" />
          </form>

          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleUpdate(event)}>
            <h2 className="flex items-center gap-2 font-semibold"><Save size={18} /> Editace test suite</h2>
            <SuiteFormFields form={editForm} allSuites={editParentOptions} onChange={setEditForm} submitLabel="Uložit změny" disabled={!selectedSuite} />
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedSuite}
              type="button"
              onClick={() => void handleDeleteSelectedSuite()}
            >
              <Trash2 size={16} /> Smazat suitu
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}

function SuiteFormFields({
  form,
  allSuites,
  onChange,
  submitLabel,
  disabled = false,
}: {
  form: SuiteForm;
  allSuites: TestSuite[];
  onChange: (form: SuiteForm) => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <label className="block text-sm">
        <span className="font-medium">Název</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
          disabled={disabled}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Umístění</span>
        <select
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
          disabled={disabled}
          value={form.placement}
          onChange={(event) => onChange({ ...form, placement: event.target.value as SuiteForm["placement"], parentSuiteId: "" })}
        >
          <option value="root">Root suite bez parenta</option>
          <option value="child">Podsuite pod existující suitou</option>
        </select>
      </label>
      {form.placement === "child" ? (
      <label className="block text-sm">
        <span className="font-medium">Parent suite</span>
        <select
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
          disabled={disabled}
          value={form.parentSuiteId}
          onChange={(event) => onChange({ ...form, parentSuiteId: event.target.value })}
          required
        >
          <option value="">Vyber parent suitu</option>
          {allSuites.map((suite) => (
            <option key={suite.id} value={suite.id}>
              {suite.path}
            </option>
          ))}
        </select>
      </label>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium">Popis</span>
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
          disabled={disabled}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block text-sm">
          <span className="font-medium">Řazení</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
            disabled={disabled}
            min={0}
            type="number"
            value={form.sortOrder}
            onChange={(event) => onChange({ ...form, sortOrder: event.target.value })}
          />
        </label>
        <label className="mt-7 flex items-center gap-2 text-sm">
          <input
            checked={form.isActive}
            disabled={disabled}
            type="checkbox"
            onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          />
          Aktivní
        </label>
      </div>
      <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={disabled || !form.name.trim()} type="submit">
        <Save size={16} /> {submitLabel}
      </button>
    </div>
  );
}
