import { FormEvent, useEffect, useRef, useState } from "react";
import {
  createTestRun, getRunSelectionCatalog, previewRunSelection,
  type RunSelection, type SelectionCatalog, type SelectionPreview, type TestRun,
} from "../../api/testRuns";
import { RunRepositoryPicker } from "./RunRepositoryPicker";
import { RunSelectionSummary } from "./RunSelectionSummary";

type Props = {
  users: { id: number; name: string; is_active: boolean }[];
  onCancel: () => void;
  onCreated: (run: TestRun) => void;
};
const inputClass = "mt-1 w-full rounded-md border border-border px-3 py-2 text-sm";
const emptySelection: RunSelection = { groups: [], suite_ids: [], test_case_ids: [] };

export function TestRunCreatePanel({ users, onCancel, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", task_number: "", planned_end: "", description: "",
    version: "", environment: "TEST", planned_start: "", assigned_to: "", status: "open" as "open" | "in_progress" });
  const [selection, setSelection] = useState<RunSelection>(emptySelection);
  const [catalog, setCatalog] = useState<SelectionCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<{ key: string; data: SelectionPreview } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const selectionKey = JSON.stringify(selection);
  const previewKey = `${reload}:${selectionKey}`;
  const currentPreview = preview?.key === previewKey ? preview.data : null;

  useEffect(() => { panel.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);
  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    setCatalogError(null);
    getRunSelectionCatalog().then((data) => { if (active) setCatalog(data); })
      .catch((reason) => { if (active) setCatalogError(reason instanceof Error ? reason.message : "Nabídku nelze načíst."); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    let active = true;
    setPreviewError(null);
    const timer = window.setTimeout(() => {
      previewRunSelection(JSON.parse(selectionKey) as RunSelection)
        .then((data) => { if (active) setPreview({ key: previewKey, data }); })
        .catch((reason) => { if (active) setPreviewError(reason instanceof Error ? reason.message : "Náhled nelze načíst."); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectionKey, previewKey]);

  function refreshPreview() {
    setPreview(null);
    setError(null);
    setReload((value) => value + 1);
  }
  function changeField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.name.trim()) { setError("Název úkolu je povinný."); return; }
    if (form.name.trim().length > 255 || form.task_number.trim().length > 100) { setError("Název může mít nejvýše 255 znaků a číslo úkolu 100 znaků."); return; }
    if ((form.planned_start && !Number.isFinite(Date.parse(form.planned_start))) || (form.planned_end && !Number.isFinite(Date.parse(form.planned_end)))) {
      setError("Zadejte platné datum a čas."); return;
    }
    if (form.planned_start && form.planned_end && new Date(form.planned_start) > new Date(form.planned_end)) {
      setError("Termín nesmí být před plánovaným začátkem."); return;
    }
    if (!currentPreview || catalogLoading || catalogError) { setError("Nejprve načtěte aktuální náhled výběru."); return; }
    if (!currentPreview.cases.length) { setError("Vyberte alespoň jeden schválený test case."); return; }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const run = await createTestRun({
        name: form.name.trim(), task_number: form.task_number.trim() || null,
        description: form.description.trim() || null, version: form.version.trim() || null,
        environment: form.environment.trim() || null, status: form.status,
        planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
        planned_end: form.planned_end ? new Date(form.planned_end).toISOString() : null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        selection, selection_fingerprint: currentPreview.fingerprint,
      });
      onCreated(run);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Test run se nepodařilo vytvořit.");
      setPreview(null);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return <section ref={panel} id="test-run-create" aria-labelledby="test-run-create-title" className="scroll-mt-4 rounded-lg border border-focus bg-surface p-5 shadow-sm shadow-shadow">
    <h2 id="test-run-create-title" className="text-lg font-semibold">Nový test run</h2>
    <form className="mt-4 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Název úkolu *<input autoFocus required maxLength={255} className={inputClass} value={form.name} onChange={(event) => changeField("name", event.target.value)} /></label>
          <label className="text-sm font-medium">Číslo úkolu<input maxLength={100} placeholder="Např. QA-123" className={inputClass} value={form.task_number} onChange={(event) => changeField("task_number", event.target.value)} /></label>
          <label className="text-sm font-medium">Termín<input type="datetime-local" className={inputClass} value={form.planned_end} onChange={(event) => changeField("planned_end", event.target.value)} /></label>
          <label className="text-sm font-medium md:col-span-2">Popis<textarea rows={3} className={inputClass} value={form.description} onChange={(event) => changeField("description", event.target.value)} /></label>
        </div>
        {catalogLoading && <p role="status" className="text-sm text-muted">Načítám nabídku skupin a suit…</p>}
        {catalogError && <p role="alert" className="text-sm text-danger">{catalogError}</p>}
        {catalog && <>
          <RunRepositoryPicker catalog={catalog} selection={selection} onChange={setSelection} />
          <RunSelectionSummary catalog={catalog} selection={selection} preview={currentPreview} onChange={setSelection} />
        </>}
        {previewError && <p role="alert" className="text-sm text-danger">{previewError}</p>}
        <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={refreshPreview}>Obnovit nabídku a náhled</button>
        <details className="rounded-md border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Další nastavení</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="text-sm">Tester<select aria-label="Tester" className={inputClass} value={form.assigned_to} onChange={(event) => changeField("assigned_to", event.target.value)}>
              <option value="">Nepřiřazeno</option>{users.filter((user) => user.is_active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select></label>
            <label className="text-sm">Prostředí<input className={inputClass} maxLength={100} value={form.environment} onChange={(event) => changeField("environment", event.target.value)} /></label>
            <label className="text-sm">Verze<input className={inputClass} maxLength={100} value={form.version} onChange={(event) => changeField("version", event.target.value)} /></label>
            <label className="text-sm">Plánovaný začátek<input className={inputClass} type="datetime-local" value={form.planned_start} onChange={(event) => changeField("planned_start", event.target.value)} /></label>
            <label className="text-sm">Stav<select className={inputClass} value={form.status} onChange={(event) => changeField("status", event.target.value)}>
              <option value="open">Otevřený</option><option value="in_progress">Probíhá</option>
            </select></label>
          </div>
        </details>
      </fieldset>
      {error && <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {confirmCancel && <div className="flex flex-wrap items-center gap-3 rounded-md bg-warning-bg p-3 text-sm">
        Zahodit rozepsaný formulář?
        <button type="button" disabled={saving} onClick={onCancel} className="underline">Zahodit změny</button>
        <button type="button" disabled={saving} onClick={() => setConfirmCancel(false)} className="underline">Pokračovat v úpravách</button>
      </div>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => {
          const dirty = form.name || form.task_number || form.description || form.planned_end || form.planned_start || form.version || form.assigned_to
            || form.environment !== "TEST" || form.status !== "open" || selectionKey !== JSON.stringify(emptySelection);
          if (dirty) setConfirmCancel(true); else onCancel();
        }} className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50">Zrušit</button>
        <button type="submit" disabled={saving} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent disabled:opacity-50">
          {saving ? "Vytvářím…" : "Vytvořit test run"}
        </button>
      </div>
    </form>
  </section>;
}
