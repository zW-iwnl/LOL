import { useEffect, useRef, useState } from "react";
import type { TestRun, TestRunCreatePayload } from "../../api/testRuns";
import { runPayload, statusLabels, toForm, validateRunForm, type RunForm } from "./model";
import { RunField } from "./RunField";

export function TestRunMetadataFields({ form, onChange }: { form: RunForm; onChange: (form: RunForm) => void }) {
  const field = (key: keyof RunForm, label: string, type = "text", maxLength?: number) => <RunField label={label} type={type} maxLength={maxLength} required={key === "name"} value={form[key]} onChange={e => onChange({ ...form, [key]: e.target.value })} />;
  return <div className="grid gap-4 md:grid-cols-2">
    {field("name", "Název úkolu", "text", 255)}{field("task_number", "Číslo úkolu", "text", 100)}
    <label className="grid gap-1 text-sm md:col-span-2">Popis<textarea className="workspace-input" rows={3} value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} /></label>
    {field("environment", "Prostředí", "text", 100)}{field("version", "Verze", "text", 100)}
    {field("planned_start", "Plánovaný začátek", "datetime-local")}{field("planned_end", "Plánovaný konec", "datetime-local")}
    <label className="grid gap-1 text-sm">Stav<select className="workspace-input" value={form.status} onChange={e => onChange({ ...form, status: e.target.value as RunForm["status"] })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  </div>;
}

export function TestRunMetadataForm({ run, saving, error, onSave, onCancel, onDirty }: { run: TestRun; saving: boolean; error: string | null; onSave: (payload: TestRunCreatePayload) => void; onCancel: () => void; onDirty: (dirty: boolean) => void }) {
  const [form, setForm] = useState(() => toForm(run));
  const [validation, setValidation] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <form className="space-y-4 p-4" noValidate onSubmit={e => { e.preventDefault(); const problem = validateRunForm(form); setValidation(problem); if (!problem) onSave(runPayload(form)); }}>
    <h3 ref={heading} className="font-semibold" tabIndex={-1}>Upravit test run</h3>
    <fieldset disabled={saving}><TestRunMetadataFields form={form} onChange={next => { setForm(next); onDirty(JSON.stringify(next) !== JSON.stringify(toForm(run))); }} /></fieldset>
    {(validation || error) && <p role="alert" className="text-sm text-danger">{validation || error}</p>}
    <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="workspace-button" onClick={onCancel}>Zrušit</button><button className="workspace-button workspace-primary" disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</button></div>
  </form>;
}
