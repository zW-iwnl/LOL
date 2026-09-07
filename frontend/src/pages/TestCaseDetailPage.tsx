import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createTestStep,
  deleteTestStep,
  getTestCase,
  getTestCaseTags,
  getTestSuites,
  updateTestCase,
  updateTestStep,
  type TestCase,
  type TestCaseStatus,
  type TestStep,
  type TestStepType,
} from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { MultiTagSelect, TagChips } from "../components/TestCaseTags";

const statuses: TestCaseStatus[] = ["draft", "ready", "deprecated"];

type EditForm = {
  suiteId: string;
  code: string;
  title: string;
  description: string;
  preconditions: string;
  expectedSummary: string;
  status: TestCaseStatus;
  tagIds: number[];
  automated: boolean;
};

type StepForm = {
  stepOrder: string;
  stepType: TestStepType;
  action: string;
  expectedResult: string;
  testData: string;
  note: string;
};

const emptyStepForm: StepForm = {
  stepOrder: "",
  stepType: "test",
  action: "",
  expectedResult: "",
  testData: "",
  note: "",
};

function formFromTestCase(testCase: TestCase): EditForm {
  return {
    suiteId: testCase.suite_id?.toString() ?? "",
    code: testCase.code,
    title: testCase.title,
    description: testCase.description ?? "",
    preconditions: testCase.preconditions ?? "",
    expectedSummary: testCase.expected_summary ?? "",
    status: testCase.status,
    tagIds: testCase.tag_ids,
    automated: testCase.automated,
  };
}

function stepFormFromStep(step: TestStep): StepForm {
  return {
    stepOrder: step.step_order.toString(),
    stepType: step.step_type,
    action: step.action,
    expectedResult: step.expected_result ?? "",
    testData: step.test_data ?? "",
    note: step.note ?? "",
  };
}

export function TestCaseDetailPage() {
  const { testCaseId } = useParams();
  const numericTestCaseId = Number(testCaseId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [newStepForm, setNewStepForm] = useState<StepForm>({ ...emptyStepForm, stepOrder: "1" });
  const [editingSteps, setEditingSteps] = useState<Record<number, StepForm>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const testCaseState = useApiResource(
    () => (Number.isFinite(numericTestCaseId) ? getTestCase(numericTestCaseId) : Promise.reject(new Error("Neplatné ID test case."))),
    [numericTestCaseId, refreshKey],
  );
  const suitesState = useApiResource(() => getTestSuites(), []);
  const tagsState = useApiResource(() => getTestCaseTags(), []);
  const tagsFor = (category: "business_area" | "application_domain" | "object_type") =>
    (tagsState.data ?? []).filter((tag) => tag.category === category);

  useEffect(() => {
    if (testCaseState.data) {
      setEditForm(formFromTestCase(testCaseState.data));
      setEditingSteps(
        Object.fromEntries(testCaseState.data.steps.map((step) => [step.id, stepFormFromStep(step)])),
      );
      const nextOrder = Math.max(0, ...testCaseState.data.steps.map((step) => step.step_order)) + 1;
      setNewStepForm({ ...emptyStepForm, stepOrder: nextOrder.toString() });
    }
  }, [testCaseState.data]);

  const sortedSteps = useMemo(
    () => [...(testCaseState.data?.steps ?? [])].sort((a, b) => a.step_order - b.step_order),
    [testCaseState.data?.steps],
  );

  const suiteName = suitesState.data?.find((suite) => suite.id === testCaseState.data?.suite_id)?.name ?? "Neznámá test suite";

  function validateTestCaseForm(form: EditForm): string | null {
    if (!form.title.trim()) return "Title je povinný.";
    if (!form.suiteId) return "Test suite je povinná.";
    if (!statuses.includes(form.status)) return "Status musí být draft, ready nebo deprecated.";
    return null;
  }

  function validateStepForm(form: StepForm): string | null {
    if (!form.stepOrder.trim() || Number.isNaN(Number(form.stepOrder))) return "Step order musí být číslo.";
    if (!form.action.trim()) return "Akce kroku je povinná.";
    return null;
  }

  async function handleUpdateTestCase(event: FormEvent) {
    event.preventDefault();
    if (!editForm || !testCaseState.data) return;

    const error = validateTestCaseForm(editForm);
    setActionError(error);
    setMessage(null);
    if (error) return;

    try {
      await updateTestCase(testCaseState.data.id, {
        suite_id: Number(editForm.suiteId),
        code: editForm.code.trim(),
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        preconditions: editForm.preconditions.trim() || null,
        expected_summary: editForm.expectedSummary.trim() || null,
        status: editForm.status,
        tag_ids: editForm.tagIds,
        automated: editForm.automated,
      });
      setRefreshKey((value) => value + 1);
      setMessage("Test case byl upraven.");
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : "Test case se nepodařilo upravit.");
    }
  }

  async function handleCreateStep(event: FormEvent) {
    event.preventDefault();
    if (!testCaseState.data) return;

    const error = validateStepForm(newStepForm);
    setActionError(error);
    setMessage(null);
    if (error) return;

    try {
      await createTestStep(testCaseState.data.id, {
        step_order: Number(newStepForm.stepOrder),
        action: newStepForm.action.trim(),
        step_type: newStepForm.stepType,
        note: newStepForm.note.trim() || null,
        expected_result: newStepForm.stepType === "test" ? newStepForm.expectedResult.trim() || null : null,
        test_data: newStepForm.stepType === "test" ? newStepForm.testData.trim() || null : null,
      });
      setRefreshKey((value) => value + 1);
      setMessage("Krok byl přidán.");
    } catch (createError) {
      setActionError(createError instanceof Error ? createError.message : "Krok se nepodařilo přidat.");
    }
  }

  async function handleUpdateStep(stepId: number) {
    const form = editingSteps[stepId];
    if (!form) return;

    const error = validateStepForm(form);
    setActionError(error);
    setMessage(null);
    if (error) return;

    try {
      await updateTestStep(stepId, {
        step_order: Number(form.stepOrder),
        action: form.action.trim(),
        step_type: form.stepType,
        note: form.note.trim() || null,
        expected_result: form.stepType === "test" ? form.expectedResult.trim() || null : null,
        test_data: form.stepType === "test" ? form.testData.trim() || null : null,
      });
      setRefreshKey((value) => value + 1);
      setMessage("Krok byl upraven.");
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : "Krok se nepodařilo upravit.");
    }
  }

  async function handleDeleteStep(stepId: number) {
    setActionError(null);
    setMessage(null);
    try {
      await deleteTestStep(stepId);
      setRefreshKey((value) => value + 1);
      setMessage("Krok byl smazán.");
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Krok se nepodařilo smazat.");
    }
  }

  if (testCaseState.loading || suitesState.loading || tagsState.loading || !editForm) {
    return <LoadingState />;
  }

  if (testCaseState.error || suitesState.error || tagsState.error) {
    return <ErrorState message={testCaseState.error ?? suitesState.error ?? tagsState.error ?? "Data nejsou dostupná."} />;
  }

  const testCase = testCaseState.data;
  if (!testCase) {
    return <ErrorState message="Test case nebyl nalezen." />;
  }

  return (
    <div className="space-y-6">
      <Link to="/test-cases" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700">
        <ArrowLeft size={16} /> Zpět na test cases
      </Link>
      {actionError && <ErrorState message={actionError} />}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      <section>
        <div className="text-sm font-medium text-cyan-700">{testCase.code}</div>
        <h2 className="mt-1 text-2xl font-semibold">{testCase.title}</h2>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <main className="space-y-6">
          <article className="rounded-md border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Detail test case</h3>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Code</dt><dd className="mt-1 font-medium">{testCase.code}</dd></div>
              <div><dt className="text-slate-500">Suite</dt><dd className="mt-1 font-medium">{suiteName}</dd></div>
              <TagChips label="Business oblast" values={testCase.tags.filter((tag) => tag.category === "business_area").map((tag) => tag.name)} />
              <TagChips label="Aplikace/doména" values={testCase.tags.filter((tag) => tag.category === "application_domain").map((tag) => tag.name)} />
              <TagChips label="Objekt" values={testCase.tags.filter((tag) => tag.category === "object_type").map((tag) => tag.name)} />
              <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-medium">{testCase.status}</dd></div>
              <div><dt className="text-slate-500">Automated</dt><dd className="mt-1 font-medium">{testCase.automated ? "Ano" : "Ne"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Description</dt><dd className="mt-1">{testCase.description ?? "-"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Preconditions</dt><dd className="mt-1">{testCase.preconditions ?? "-"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Expected summary</dt><dd className="mt-1">{testCase.expected_summary ?? "-"}</dd></div>
            </dl>
          </article>

          <article className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold">Steps</h3>
              <p className="mt-1 text-sm text-slate-500">Kroky jsou řazené podle step_order.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {sortedSteps.map((step) => {
                const form = editingSteps[step.id] ?? stepFormFromStep(step);
                return (
                  <div key={step.id} className="p-5">
                    <div className="grid gap-3 md:grid-cols-[110px_170px_1fr_1fr]">
                      <label className="text-sm">
                        <span className="font-medium">Step order</span>
                        <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="number" value={form.stepOrder} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, stepOrder: event.target.value } })} />
                      </label>
                      <label className="text-sm">
                        <span className="font-medium">Typ kroku</span>
                        <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.stepType} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, stepType: event.target.value as TestStepType, expectedResult: event.target.value === "information" ? "" : form.expectedResult, testData: event.target.value === "information" ? "" : form.testData } })}>
                          <option value="test">Testovací</option>
                          <option value="information">Netestovací</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className="font-medium">Action</span>
                        <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={form.action} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, action: event.target.value } })} />
                      </label>
                      {form.stepType === "test" ? (
                      <label className="text-sm">
                        <span className="font-medium">Expected result</span>
                        <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={form.expectedResult} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, expectedResult: event.target.value } })} />
                      </label>
                      ) : null}
                    </div>
                    {form.stepType === "test" ? (
                    <label className="mt-3 block text-sm">
                      <span className="font-medium">Test data</span>
                      <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.testData} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, testData: event.target.value } })} />
                    </label>
                    ) : null}
                    <label className="mt-3 block text-sm">
                      <span className="font-medium">Poznámka</span>
                      <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 px-3 py-2" value={form.note} onChange={(event) => setEditingSteps({ ...editingSteps, [step.id]: { ...form, note: event.target.value } })} />
                    </label>
                    <div className="mt-3 flex gap-2">
                      <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" type="button" onClick={() => void handleUpdateStep(step.id)}>
                        <Save size={16} /> Uložit krok
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50" type="button" onClick={() => void handleDeleteStep(step.id)}>
                        <Trash2 size={16} /> Smazat
                      </button>
                    </div>
                  </div>
                );
              })}
              {sortedSteps.length === 0 && <div className="p-5 text-sm text-slate-500">Test case zatím nemá kroky.</div>}
            </div>
          </article>
        </main>

        <aside className="space-y-6">
          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleUpdateTestCase(event)}>
            <h3 className="flex items-center gap-2 font-semibold"><Save size={18} /> Editace test case</h3>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium">Code</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.code} onChange={(event) => setEditForm({ ...editForm, code: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Title *</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Suite</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.suiteId} onChange={(event) => setEditForm({ ...editForm, suiteId: event.target.value })}>
                  {(suitesState.data ?? []).map((suite) => <option key={suite.id} value={suite.id}>#{suite.id} {suite.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Description</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Preconditions</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.preconditions} onChange={(event) => setEditForm({ ...editForm, preconditions: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Expected summary</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.expectedSummary} onChange={(event) => setEditForm({ ...editForm, expectedSummary: event.target.value })} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium">Status</span>
                  <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as TestCaseStatus })}>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              </div>
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
                    values={editForm.tagIds.filter((id) => categoryIds.has(id))}
                    tags={categoryTags}
                    onChange={(values) => setEditForm({ ...editForm, tagIds: [...editForm.tagIds.filter((id) => !categoryIds.has(id)), ...values] })}
                  />
                );
              })}
              <label className="flex items-center gap-2 text-sm">
                <input checked={editForm.automated} type="checkbox" onChange={(event) => setEditForm({ ...editForm, automated: event.target.checked })} />
                Automated
              </label>
              <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
                <Save size={16} /> Uložit test case
              </button>
            </div>
          </form>

          <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreateStep(event)}>
            <h3 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Přidat krok</h3>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="font-medium">Step order</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="number" value={newStepForm.stepOrder} onChange={(event) => setNewStepForm({ ...newStepForm, stepOrder: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Typ kroku</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={newStepForm.stepType} onChange={(event) => setNewStepForm({ ...newStepForm, stepType: event.target.value as TestStepType, expectedResult: event.target.value === "information" ? "" : newStepForm.expectedResult, testData: event.target.value === "information" ? "" : newStepForm.testData })}>
                  <option value="test">Testovací</option>
                  <option value="information">Netestovací</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Action</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={newStepForm.action} onChange={(event) => setNewStepForm({ ...newStepForm, action: event.target.value })} />
              </label>
              {newStepForm.stepType === "test" ? (
                <>
              <label className="block text-sm">
                <span className="font-medium">Expected result</span>
                <textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2" value={newStepForm.expectedResult} onChange={(event) => setNewStepForm({ ...newStepForm, expectedResult: event.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Test data</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={newStepForm.testData} onChange={(event) => setNewStepForm({ ...newStepForm, testData: event.target.value })} />
              </label>
                </>
              ) : (
                <div className="rounded-md bg-sky-50 p-3 text-sm text-sky-700">Netestovací krok se v execution nevyhodnocuje.</div>
              )}
              <label className="block text-sm">
                <span className="font-medium">Poznámka</span>
                <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 px-3 py-2" value={newStepForm.note} onChange={(event) => setNewStepForm({ ...newStepForm, note: event.target.value })} />
              </label>
              <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
                <Plus size={16} /> Přidat krok
              </button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  );
}
