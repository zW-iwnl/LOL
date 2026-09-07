import { getTestCaseTags } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import type { DraftContent, DraftStep } from "../../api/testCaseWorkflow";
import { MultiTagSelect } from "../TestCaseTags";

const input = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50";
export function CaseContentEditor({ value, onChange, disabled = false }: { value: DraftContent; onChange: (v: DraftContent) => void; disabled?: boolean }) {
  const tags = useApiResource(getTestCaseTags, []);
  function set<K extends keyof DraftContent>(key: K, next: DraftContent[K]) { onChange({ ...value, [key]: next }); }
  function stepChange(index: number, patch: Partial<DraftStep>) { set("steps", value.steps.map((s, i) => i === index ? { ...s, ...patch } : s)); }
  function move(index: number, delta: number) {
    const next = [...value.steps];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    set("steps", next.map((s, i) => ({ ...s, step_order: i + 1 })));
  }
  return <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
    <label className="block text-sm">Název scénáře<input required maxLength={255} className={input} value={value.title} onChange={e => set("title", e.target.value)} /></label>
    {([ ["description", "Popis"], ["preconditions", "Předpoklady"], ["expected_summary", "Očekávaný souhrn"] ] as const).map(([key, label]) =>
      <label key={key} className="block text-sm">{label}<textarea className={input} value={value[key] ?? ""} onChange={e => set(key, e.target.value || null)} /></label>)}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.automated} onChange={e => set("automated", e.target.checked)} />Automatizovaný scénář</label>
    {tags.error && <p role="alert" className="text-rose-700">{tags.error}</p>}
    <div className="grid gap-3 md:grid-cols-3">{([ ["business_area", "Business oblast"], ["application_domain", "Aplikace/doména"], ["object_type", "Objekt"] ] as const).map(([category, label]) => {
      const categoryTags = (tags.data ?? []).filter(t => t.category === category);
      return <MultiTagSelect key={category} label={label} tags={categoryTags} values={value.tag_ids.filter(id => categoryTags.some(t => t.id === id))}
        onChange={ids => set("tag_ids", [...value.tag_ids.filter(id => !categoryTags.some(t => t.id === id)), ...ids])} />;
    })}</div>
    <h3 className="font-semibold">Kroky scénáře</h3>
    {value.steps.map((step, index) => <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4" key={step.step_key}>
      <div className="flex flex-wrap items-center gap-3"><strong>Krok {index + 1}</strong>
        <select aria-label={`Typ kroku ${index + 1}`} className="rounded-md border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" value={step.step_type} onChange={e => stepChange(index, { step_type: e.target.value as DraftStep["step_type"] })}><option value="test">Testovací</option><option value="information">Informační</option></select>
        <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">↑ Nahoru</button>
        <button type="button" disabled={index === value.steps.length - 1} onClick={() => move(index, 1)} className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">↓ Dolů</button>
        <button type="button" className="ml-auto text-rose-700" onClick={() => set("steps", value.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })))}>Odebrat krok</button>
      </div>
      <label className="block text-sm">Akce<textarea required className={input} value={step.action} onChange={e => stepChange(index, { action: e.target.value })} /></label>
      {step.step_type === "test" && <><label className="block text-sm">Očekávaný výsledek<textarea className={input} value={step.expected_result ?? ""} onChange={e => stepChange(index, { expected_result: e.target.value || null })} /></label>
        <label className="block text-sm">Testovací data<input className={input} value={step.test_data ?? ""} onChange={e => stepChange(index, { test_data: e.target.value || null })} /></label></>}
      <label className="block text-sm">Poznámka<input className={input} value={step.note ?? ""} onChange={e => stepChange(index, { note: e.target.value || null })} /></label>
    </section>)}
    <button type="button" className="rounded-md border border-cyan-700 px-3 py-2 text-cyan-800 text-sm min-h-11 font-medium transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" onClick={() => set("steps", [...value.steps, { step_key: crypto.randomUUID(), step_order: value.steps.length + 1, step_type: "test", action: "", expected_result: null, note: null, test_data: null }])}>Přidat krok</button>
    <p className="text-xs text-slate-500">Do scénáře nevkládejte skutečná hesla ani tokeny. Používejte odkazy na testovací data.</p>
  </fieldset>;
}
