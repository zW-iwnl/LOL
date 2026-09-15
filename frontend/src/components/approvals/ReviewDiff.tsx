import type { ReviewDetail } from "../../api/testCaseWorkflow";
export const fieldLabels: Record<string, string> = { title: "Název", description: "Popis", preconditions: "Předpoklady", expected_summary: "Celkové očekávání", automated: "Automatizace", tags: "Tagy", step_order: "Pořadí", action: "Akce", expected_result: "Očekávaný výsledek", test_data: "Testovací data", note: "Poznámka", step_type: "Typ kroku" };
export function changeLabel(field: string, before?: unknown, after?: unknown) {
  if (!field.startsWith("steps.")) return fieldLabels[field] ?? "Změna scénáře";
  const step = (after ?? before) as { step_order?: number } | null;
  return `Krok ${step?.step_order ?? ""}`;
}
function display(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  if (Array.isArray(value)) return value.map(item => typeof item === "object" && item ? item.name ?? "" : String(item)).join(", ") || "—";
  return String(value);
}
export function ReviewDiff({ changes, firstVersion, onComment }: { changes: ReviewDetail["changes"]; firstVersion: boolean; onComment?: (field: string) => void }) {
  return <div className="space-y-2">{firstVersion && <p className="text-xs text-cyan-800">Nový scénář – první publikovaná verze.</p>}{!changes.length && <p className="text-sm text-slate-500">Obsah se neliší.</p>}{changes.map(change => {
    const step = change.field.startsWith("steps.");
    const before = change.before as Record<string, unknown> | null, after = change.after as Record<string, unknown> | null;
    const kind = change.before == null ? "Přidáno" : change.after == null ? "Odebráno" : step && before?.step_order !== after?.step_order ? "Přesunuto / upraveno" : "Upraveno";
    const fields = step ? ["step_order", "step_type", "action", "test_data", "expected_result", "note"].filter(field => !before || !after || before[field] !== after[field]) : [change.field];
    return <section key={change.field} className="rounded border border-slate-200" id={`change-${change.field}`}><header className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-xs"><h3 className="font-semibold">{changeLabel(change.field, before, after)} · {kind}</h3>{onComment && <button type="button" className="text-cyan-800" onClick={() => onComment(change.field)}>Připomínkovat</button>}</header>
      <div className="grid grid-cols-2 gap-2 px-3 pt-2 text-[11px] text-slate-500"><span>Před změnou</span><span>Navržená verze</span></div>
      {fields.map(field => <div key={field} className="px-3 py-2">{step && <p className="mb-1 text-[11px] text-slate-500">{fieldLabels[field]}</p>}<div className="grid grid-cols-2 gap-2 text-xs"><p className="min-w-0 whitespace-pre-wrap break-words rounded bg-rose-50 p-2">{display(step ? before?.[field] : change.before)}</p><p className="min-w-0 whitespace-pre-wrap break-words rounded bg-emerald-50 p-2">{display(step ? after?.[field] : change.after)}</p></div></div>)}
    </section>;
  })}</div>;
}
