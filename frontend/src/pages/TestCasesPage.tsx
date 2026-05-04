import { Plus, SlidersHorizontal } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTestCase,
  getTestCases,
  getTestSuites,
  type Priority,
  type TestCaseCreate,
  type TestCaseStatus,
} from "../api/client";
import { ErrorState, LoadingState, useApiResource, useCurrentProject } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";

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
  firstStepOrder: string;
  firstStepAction: string;
  firstStepExpected: string;
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
  firstStepOrder: "1",
  firstStepAction: "",
  firstStepExpected: "",
};

export function TestCasesPage() {
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<Filters>({ suiteId: "", priority: "", status: "", type: "" });
  const [form, setForm] = useState<TestCaseForm>(emptyForm);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const suitesState = useApiResource(() => (project ? getTestSuites(project.id) : Promise.resolve([])), [project?.id]);
  const casesState = useApiResource(() => (project ? getTestCases(project.id) : Promise.resolve([])), [project?.id, refreshKey]);
  const suiteName = (suiteId: number | null) => suitesState.data?.find((suite) => suite.id === suiteId)?.name ?? "Bez suity";

  const availableTypes = useMemo(() => {
    const fromData = new Set((casesState.data ?? []).map((testCase) => testCase.type));
    return Array.from(new Set([...defaultTypes, ...fromData]));
  }, [casesState.data]);

  const filteredCases = useMemo(() => {
    return (casesState.data ?? []).filter((testCase) => {
      if (filters.suiteId && testCase.suite_id !== Number(filters.suiteId)) return false;
      if (filters.priority && testCase.priority !== filters.priority) return false;
      if (filters.status && testCase.status !== filters.status) return false;
      if (filters.type && testCase.type !== filters.type) return false;
      return true;
    });
  }, [casesState.data, filters]);

  function validateForm(): string | null {
    if (!form.title.trim()) return "Název test case je povinný.";
    if (!priorities.includes(form.priority)) return "Priorita musí být low, medium, high nebo critical.";
    if (!statuses.includes(form.status)) return "Status musí být draft, ready nebo deprecated.";
    if (form.firstStepOrder && Number.isNaN(Number(form.firstStepOrder))) return "Step order musí být číslo.";
    if (form.firstStepAction.trim() && !form.firstStepOrder.trim()) return "Step order musí být číslo.";
    return null;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!project) return;

    const error = validateForm();
    setValidationError(error);
    setMessage(null);
    if (error) return;

    const steps: TestCaseCreate["steps"] = form.firstStepAction.trim()
      ? [
          {
            step_order: Number(form.firstStepOrder),
            action: form.firstStepAction.trim(),
            expected_result: form.firstStepExpected.trim() || null,
            test_data: null,
          },
        ]
      : [];

    try {
      await createTestCase(project.id, {
        suite_id: form.suiteId ? Number(form.suiteId) : null,
        code: form.code.trim() || `TC-${Date.now().toString().slice(-6)}`,
        title: form.title.trim(),
        description: form.description.trim() || null,
        preconditions: form.preconditions.trim() || null,
        expected_summary: form.expectedSummary.trim() || null,
        priority: form.priority,
        type: form.type.trim() || "manual",
        status: form.status,
        automated: form.automated,
        steps,
      });
      setForm(emptyForm);
      setRefreshKey((value) => value + 1);
      setMessage("Test case byl vytvořen.");
    } catch (createError) {
      setValidationError(createError instanceof Error ? createError.message : "Test case se nepodařilo vytvořit.");
    }
  }

  if (projectLoading || suitesState.loading || casesState.loading) {
    return <LoadingState />;
  }

  if (projectError || suitesState.error || casesState.error) {
    return <ErrorState message={projectError ?? suitesState.error ?? casesState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Test Cases" description="Správa test cases, filtry, vytvoření a detail s kroky." />
      {validationError && <ErrorState message={validationError} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-sm">
            <span className="font-medium">Suite</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.suiteId} onChange={(event) => setFilters({ ...filters, suiteId: event.target.value })}>
              <option value="">Všechny suity</option>
              {(suitesState.data ?? []).map((suite) => (
                <option key={suite.id} value={suite.id}>{suite.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Priorita</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
              <option value="">Všechny priority</option>
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Status</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Všechny stavy</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Typ</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
              <option value="">Všechny typy</option>
              {availableTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50" type="button">
            <SlidersHorizontal size={16} /> Filtrováno
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">Test cases</h2>
            <p className="mt-1 text-sm text-slate-500">Zobrazeno {filteredCases.length} z {(casesState.data ?? []).length}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Suite</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Automated</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((testCase) => (
                  <tr key={testCase.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-cyan-700">
                      <Link to={`/test-cases/${testCase.id}`}>{testCase.code}</Link>
                    </td>
                    <td className="px-5 py-3">{testCase.title}</td>
                    <td className="px-5 py-3">{suiteName(testCase.suite_id)}</td>
                    <td className="px-5 py-3">{testCase.priority}</td>
                    <td className="px-5 py-3">{testCase.type}</td>
                    <td className="px-5 py-3">{testCase.status}</td>
                    <td className="px-5 py-3">{testCase.automated ? "Ano" : "Ne"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreate(event)}>
          <h2 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Nový test case</h2>
          <TestCaseFormFields form={form} suites={suitesState.data ?? []} availableTypes={availableTypes} onChange={setForm} />
          <button className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
            <Plus size={16} /> Vytvořit test case
          </button>
        </form>
      </section>
    </div>
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
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Code</span>
          <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="Automaticky, pokud necháš prázdné" />
        </label>
        <label className="text-sm">
          <span className="font-medium">Suite</span>
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.suiteId} onChange={(event) => onChange({ ...form, suiteId: event.target.value })}>
            <option value="">Bez suity</option>
            {suites.map((suite) => <option key={suite.id} value={suite.id}>{" ".repeat(suite.level * 2)}{suite.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Title *</span>
        <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Description</span>
        <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Preconditions</span>
        <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={form.preconditions} onChange={(event) => onChange({ ...form, preconditions: event.target.value })} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Expected summary</span>
        <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={form.expectedSummary} onChange={(event) => onChange({ ...form, expectedSummary: event.target.value })} />
      </label>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          <span className="font-medium">Priority</span>
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as Priority })}>
            {priorities.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Type</span>
          <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" list="test-case-types" value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value })} />
          <datalist id="test-case-types">{availableTypes.map((type) => <option key={type} value={type} />)}</datalist>
        </label>
        <label className="text-sm">
          <span className="font-medium">Status</span>
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as TestCaseStatus })}>
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="mt-7 flex items-center gap-2 text-sm">
          <input checked={form.automated} type="checkbox" onChange={(event) => onChange({ ...form, automated: event.target.checked })} />
          Automated
        </label>
      </div>
      <div className="rounded-md bg-slate-50 p-4">
        <h3 className="text-sm font-semibold">První krok</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[110px_1fr]">
          <label className="text-sm">
            <span className="font-medium">Step order</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="number" value={form.firstStepOrder} onChange={(event) => onChange({ ...form, firstStepOrder: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Action</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.firstStepAction} onChange={(event) => onChange({ ...form, firstStepAction: event.target.value })} />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="font-medium">Expected result</span>
          <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.firstStepExpected} onChange={(event) => onChange({ ...form, firstStepExpected: event.target.value })} />
        </label>
      </div>
    </div>
  );
}
