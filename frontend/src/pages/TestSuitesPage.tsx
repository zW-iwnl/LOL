import { Plus, RefreshCw, Save, Trash2, Unlink } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createTestSuite,
  deleteTestSuite,
  getTestSuites,
  getSuiteGroups,
  getTestSuiteTestCases,
  updateTestCase,
  updateTestSuite,
  type SuiteGroup,
  type TestCase,
  type TestSuite,
} from "../api/client";
import { ErrorState, LoadingState } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { SuiteNavigator } from "../components/test-suites/SuiteNavigator";
import { SuiteGroupManager } from "../components/test-suites/SuiteGroupManager";
import type { SuiteSelection } from "../components/test-suites/suiteTree";
import { useSuiteViewState } from "../components/test-suites/useSuiteViewState";

type SuiteForm = {
  name: string;
  description: string;
  placement: "root" | "child";
  parentSuiteId: string;
  sortOrder: string;
  isActive: boolean;
  groupIds: string[];
};

const emptyForm: SuiteForm = {
  name: "",
  description: "",
  placement: "root",
  parentSuiteId: "",
  sortOrder: "0",
  isActive: true,
  groupIds: [],
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
    groupIds: suite.group_ids.map(String),
  };
}

export function TestSuitesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allSuites, setAllSuites] = useState<TestSuite[]>([]);
  const [groups, setGroups] = useState<SuiteGroup[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState<SuiteForm>(emptyForm);
  const [editForm, setEditForm] = useState<SuiteForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suiteView, setSuiteView] = useSuiteViewState("suites", "tree");
  const selectedSuiteId = Number(searchParams.get("suite"));
  const selectedSuite = Number.isInteger(selectedSuiteId) && selectedSuiteId > 0
    ? allSuites.find((suite) => suite.id === selectedSuiteId) ?? null
    : null;

  const editParentOptions = useMemo(() => {
    if (!selectedSuite) {
      return allSuites;
    }
    return allSuites.filter((suite) => suite.id !== selectedSuite.id && !suite.path.startsWith(`${selectedSuite.path}/`));
  }, [allSuites, selectedSuite]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getTestSuites(), getSuiteGroups()])
      .then(([suites, loadedGroups]) => {
        setAllSuites(suites);
        setGroups(loadedGroups);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Suity se nepodařilo načíst."))
      .finally(() => setLoading(false));
  }, []);

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

  function selectSuite(selection: SuiteSelection) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (typeof selection === "number") {
        next.set("suite", selection.toString());
      } else {
        next.delete("suite");
      }
      return next;
    });
  }

  async function refreshSuites() {
    setLoading(true);
    setError(null);
    try {
      setAllSuites(await getTestSuites());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Suity se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!createForm.name.trim()) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const created = await createTestSuite({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        parent_suite_id: createForm.placement === "child" && createForm.parentSuiteId ? Number(createForm.parentSuiteId) : null,
        sort_order: Number(createForm.sortOrder) || 0,
        is_active: createForm.isActive,
        group_ids: createForm.groupIds.map(Number),
      });
      setMessage("Test suite byla vytvořena.");
      setCreateForm(emptyForm);
      await refreshSuites();
      selectSuite(created.id);
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
        group_ids: editForm.groupIds.map(Number),
      });
      setMessage("Test suite byla upravena.");
      await refreshSuites();
      selectSuite(updated.id);
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

    const parentSuiteId = selectedSuite.parent_suite_id;
    setError(null);
    setMessage(null);
    try {
      await deleteTestSuite(selectedSuite.id);
      setMessage("Test suite byla smazána.");
      setTestCases([]);
      selectSuite(parentSuiteId ?? "root");
      await refreshSuites();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Test suite se nepodařilo smazat.");
    }
  }

  async function handleRemoveTestCaseFromSuite(testCase: TestCase) {
    if (!selectedSuite) {
      return;
    }
    const confirmed = window.confirm(`Odebrat test case ${testCase.code} ze suity "${selectedSuite.name}"? Test case bude přesunut pod Počátek vesmíru.`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      await updateTestCase(testCase.id, { suite_id: null });
      setMessage("Test case byl odebrán ze suity.");
      setTestCases(await getTestSuiteTestCases(selectedSuite.id));
      await refreshSuites();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Test case se nepodařilo odebrat ze suity.");
    }
  }

  if (loading) {
    return <LoadingState />;
  }


  return (
    <div className="space-y-6">
      <PageHeader title="Test Suity" description="Správa testovacích sad ve stromu, složkách nebo myšlenkové mapě." />
      {error && <ErrorState message={error} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      <SuiteNavigator
        suites={allSuites}
        groups={groups}
        selected={selectedSuite?.id ?? "root"}
        view={suiteView}
        query={query}
        onQueryChange={setQuery}
        onSelect={selectSuite}
        onViewChange={setSuiteView}
        actions={(
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => void refreshSuites()}
          >
            <RefreshCw size={15} /> Obnovit
          </button>
        )}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
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
              <p className="mt-3 text-sm text-slate-500">Vyber test suite v navigaci.</p>
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
          <SuiteGroupManager groups={groups} suites={allSuites} onChanged={async () => {
            const [suites, loadedGroups] = await Promise.all([getTestSuites(), getSuiteGroups()]);
            setAllSuites(suites);
            setGroups(loadedGroups);
          }} />
          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreate(event)}>
            <h2 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Nová test suite</h2>
            <SuiteFormFields form={createForm} allSuites={allSuites} groups={groups} onChange={setCreateForm} submitLabel="Vytvořit suitu" />
          </form>

          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleUpdate(event)}>
            <h2 className="flex items-center gap-2 font-semibold"><Save size={18} /> Editace test suite</h2>
            <SuiteFormFields form={editForm} allSuites={editParentOptions} groups={groups} onChange={setEditForm} submitLabel="Uložit změny" disabled={!selectedSuite} />
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
  groups,
  onChange,
  submitLabel,
  disabled = false,
}: {
  form: SuiteForm;
  allSuites: TestSuite[];
  groups: SuiteGroup[];
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
      <fieldset className="space-y-2 rounded-md border border-slate-200 p-3" disabled={disabled}>
        <legend className="px-1 text-sm font-medium">Skupiny</legend>
        {groups.map((group) => {
          const value = String(group.id);
          const parent = group.parent_group_id ? groups.find((candidate) => candidate.id === group.parent_group_id) : null;
          return (
            <label className="flex items-center gap-2 text-sm" key={group.id}>
              <input
                checked={form.groupIds.includes(value)}
                type="checkbox"
                onChange={(event) => onChange({
                  ...form,
                  groupIds: event.target.checked
                    ? [...form.groupIds, value]
                    : form.groupIds.filter((groupId) => groupId !== value),
                })}
              />
              <span>{parent ? `${parent.name} / ` : ""}{group.name}</span>
            </label>
          );
        })}
        {groups.length === 0 && <p className="text-xs text-slate-500">Nejdřív vytvoř skupinu v panelu výše.</p>}
      </fieldset>
      <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={disabled || !form.name.trim()} type="submit">
        <Save size={16} /> {submitLabel}
      </button>
    </div>
  );
}
