import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { FormEvent } from "react";

import type {
  TestCaseStatus,
  TestCaseTag,
  TestStepPayload,
  TestStepType,
  TestSuite,
} from "../../api/client";
import { MultiTagSelect } from "../TestCaseTags";

export type TestCaseStepDraft = {
  key: string;
  stepType: TestStepType;
  action: string;
  expectedResult: string;
  testData: string;
  note: string;
};

export type TestCaseDraft = {
  suiteId: string;
  code: string;
  title: string;
  description: string;
  status: TestCaseStatus;
  automated: boolean;
  tagIds: number[];
  steps: TestCaseStepDraft[];
};

let nextStepKey = 0;

export function createEmptyStepDraft(): TestCaseStepDraft {
  nextStepKey += 1;
  return {
    key: `new-step-${nextStepKey}`,
    stepType: "test",
    action: "",
    expectedResult: "",
    testData: "",
    note: "",
  };
}

export function createEmptyTestCaseDraft(suiteId: number | null): TestCaseDraft {
  return {
    suiteId: suiteId?.toString() ?? "",
    code: "",
    title: "",
    description: "",
    status: "draft",
    automated: false,
    tagIds: [],
    steps: [createEmptyStepDraft()],
  };
}

export function prepareTestCaseSteps(steps: TestCaseStepDraft[]): {
  error: string | null;
  steps: TestStepPayload[];
} {
  const filledSteps = steps.filter((step) => [
    step.action,
    step.expectedResult,
    step.testData,
    step.note,
  ].some((value) => value.trim().length > 0));

  const incompleteIndex = filledSteps.findIndex((step) => !step.action.trim());
  if (incompleteIndex >= 0) {
    const visibleIndex = steps.findIndex((step) => step.key === filledSteps[incompleteIndex].key);
    return {
      error: `Doplňte akci u kroku ${visibleIndex + 1}, nebo tento krok odeberte.`,
      steps: [],
    };
  }

  return {
    error: null,
    steps: filledSteps.map((step, index) => ({
      step_order: index + 1,
      action: step.action.trim(),
      step_type: step.stepType,
      note: step.note.trim() || null,
      expected_result: step.stepType === "test" ? step.expectedResult.trim() || null : null,
      test_data: step.stepType === "test" ? step.testData.trim() || null : null,
    })),
  };
}

type Props = {
  form: TestCaseDraft;
  suites: TestSuite[];
  tags: TestCaseTag[];
  saving: boolean;
  error: string | null;
  onChange: (form: TestCaseDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

const fieldClassName = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm";

export function TestCaseCreatePanel({
  form,
  suites,
  tags,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  function updateStep(key: string, patch: Partial<TestCaseStepDraft>) {
    onChange({
      ...form,
      steps: form.steps.map((step) => step.key === key ? { ...step, ...patch } : step),
    });
  }

  function addStep() {
    const step = createEmptyStepDraft();
    onChange({ ...form, steps: [...form.steps, step] });
    requestAnimationFrame(() => {
      document.getElementById(`${step.key}-action`)?.focus();
    });
  }

  function removeStep(key: string) {
    onChange({ ...form, steps: form.steps.filter((step) => step.key !== key) });
  }

  function moveStep(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= form.steps.length) return;
    const reordered = [...form.steps];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onChange({ ...form, steps: reordered });
  }

  return (
    <section
      aria-labelledby="test-case-create-title"
      className="scroll-mt-24 overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-sm"
      id="test-case-create-editor"
    >
      <div className="flex items-start justify-between gap-4 border-b border-cyan-100 bg-cyan-50/70 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Nový záznam</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900" id="test-case-create-title">
            Nový test case
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Vyplňte základní údaje a přidejte kroky v pořadí, ve kterém je tester provede.
          </p>
        </div>
        <button
          aria-label="Zavřít formulář nového test case"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-white"
          disabled={saving}
          type="button"
          onClick={onClose}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>

      <form onSubmit={(event) => void onSubmit(event)}>
        <div className="space-y-6 p-4 sm:p-6">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
              {error}
            </div>
          )}

          <section aria-labelledby="case-basic-information" className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900" id="case-basic-information">Základní údaje</h3>
              <p className="mt-1 text-sm text-slate-500">Povinná pole jsou označená hvězdičkou.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(160px,0.45fr)_minmax(280px,1.4fr)]">
              <label className="block text-sm">
                <span className="font-medium">Test suite *</span>
                <select
                  className={fieldClassName}
                  required
                  value={form.suiteId}
                  onChange={(event) => onChange({ ...form, suiteId: event.target.value })}
                >
                  <option value="">Vyberte test suitu</option>
                  {suites.map((suite) => (
                    <option key={suite.id} value={suite.id}>#{suite.id} {suite.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Kód *</span>
                <input
                  autoFocus
                  className={fieldClassName}
                  maxLength={50}
                  placeholder="např. LOGIN-001"
                  required
                  value={form.code}
                  onChange={(event) => onChange({ ...form, code: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Název *</span>
                <input
                  className={fieldClassName}
                  maxLength={255}
                  placeholder="Co se má ověřit"
                  required
                  value={form.title}
                  onChange={(event) => onChange({ ...form, title: event.target.value })}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Popis</span>
              <textarea
                className={`${fieldClassName} min-h-20 resize-y`}
                placeholder="Stručný kontext a účel testu"
                value={form.description}
                onChange={(event) => onChange({ ...form, description: event.target.value })}
              />
            </label>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <MultiTagSelect
                label="Tagy"
                tags={tags}
                values={form.tagIds}
                onChange={(tagIds) => onChange({ ...form, tagIds })}
              />
              <label className="block text-sm">
                <span className="font-medium">Stav</span>
                <select
                  className={fieldClassName}
                  value={form.status}
                  onChange={(event) => onChange({ ...form, status: event.target.value as TestCaseStatus })}
                >
                  <option value="draft">Koncept</option>
                  <option value="ready">Připraveno</option>
                  <option value="deprecated">Vyřazeno</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm lg:mt-6">
                <span className="font-medium">Automatizovaný</span>
                <input
                  checked={form.automated}
                  className="h-4 w-4"
                  type="checkbox"
                  onChange={(event) => onChange({ ...form, automated: event.target.checked })}
                />
              </label>
            </div>
          </section>

          <section aria-labelledby="case-steps-title" className="space-y-4 border-t border-slate-200 pt-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h3 className="font-semibold text-slate-900" id="case-steps-title">Testovací kroky</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Pořadí se ukládá automaticky. Prázdný krok se při uložení přeskočí.
                </p>
              </div>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50"
                disabled={saving}
                type="button"
                onClick={addStep}
              >
                <Plus aria-hidden="true" size={17} /> Přidat krok
              </button>
            </div>

            <div className="space-y-3">
              {form.steps.map((step, index) => (
                <article className="rounded-lg border border-slate-200 bg-slate-50/60 p-4" key={step.key}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 min-w-8 place-items-center rounded-full bg-cyan-700 px-2 text-sm font-semibold text-white" aria-hidden="true">
                        {index + 1}
                      </span>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Typ kroku</span>
                        <select
                          aria-label={`Typ kroku ${index + 1}`}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2"
                          value={step.stepType}
                          onChange={(event) => updateStep(step.key, {
                            stepType: event.target.value as TestStepType,
                            ...(event.target.value === "information" ? { expectedResult: "", testData: "" } : {}),
                          })}
                        >
                          <option value="test">Testovací</option>
                          <option value="information">Informační</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Posunout krok ${index + 1} nahoru`}
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-white disabled:opacity-30"
                        disabled={saving || index === 0}
                        title="Posunout nahoru"
                        type="button"
                        onClick={() => moveStep(index, -1)}
                      >
                        <ArrowUp aria-hidden="true" size={18} />
                      </button>
                      <button
                        aria-label={`Posunout krok ${index + 1} dolů`}
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-white disabled:opacity-30"
                        disabled={saving || index === form.steps.length - 1}
                        title="Posunout dolů"
                        type="button"
                        onClick={() => moveStep(index, 1)}
                      >
                        <ArrowDown aria-hidden="true" size={18} />
                      </button>
                      <button
                        aria-label={`Odebrat krok ${index + 1}`}
                        className="grid h-11 w-11 place-items-center rounded-md text-rose-700 hover:bg-rose-50 disabled:opacity-30"
                        disabled={saving}
                        title="Odebrat krok"
                        type="button"
                        onClick={() => removeStep(step.key)}
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-4 ${step.stepType === "test" ? "lg:grid-cols-2" : ""}`}>
                    <label className="block text-sm">
                      <span className="font-medium">Akce kroku {index + 1}</span>
                      <textarea
                        className={`${fieldClassName} min-h-24 resize-y`}
                        id={`${step.key}-action`}
                        placeholder={step.stepType === "test" ? "Co má tester udělat" : "Informace nebo podmínka pro testera"}
                        value={step.action}
                        onChange={(event) => updateStep(step.key, { action: event.target.value })}
                      />
                    </label>
                    {step.stepType === "test" && (
                      <label className="block text-sm">
                        <span className="font-medium">Očekávaný výsledek kroku {index + 1}</span>
                        <textarea
                          className={`${fieldClassName} min-h-24 resize-y`}
                          placeholder="Jak poznáme, že krok proběhl správně"
                          value={step.expectedResult}
                          onChange={(event) => updateStep(step.key, { expectedResult: event.target.value })}
                        />
                      </label>
                    )}
                  </div>
                  <div className={`mt-4 grid gap-4 ${step.stepType === "test" ? "lg:grid-cols-2" : ""}`}>
                    {step.stepType === "test" && (
                      <label className="block text-sm">
                        <span className="font-medium">Testovací data</span>
                        <input
                          className={fieldClassName}
                          placeholder="Např. účet, role nebo vstupní hodnoty"
                          value={step.testData}
                          onChange={(event) => updateStep(step.key, { testData: event.target.value })}
                        />
                      </label>
                    )}
                    <label className="block text-sm">
                      <span className="font-medium">Poznámka</span>
                      <input
                        className={fieldClassName}
                        placeholder="Volitelné upřesnění"
                        value={step.note}
                        onChange={(event) => updateStep(step.key, { note: event.target.value })}
                      />
                    </label>
                  </div>
                </article>
              ))}
              {form.steps.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-600">Test case zatím nemá žádný krok.</p>
                  <button
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-200 px-4 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50"
                    type="button"
                    onClick={addStep}
                  >
                    <Plus aria-hidden="true" size={17} /> Přidat první krok
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            className="min-h-11 rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            Zrušit
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-700 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            <Check aria-hidden="true" size={17} /> {saving ? "Ukládám…" : "Uložit test case"}
          </button>
        </div>
      </form>
    </section>
  );
}
