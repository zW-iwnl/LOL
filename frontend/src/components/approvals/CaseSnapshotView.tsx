import type { CaseVersion } from "../../api/testCaseWorkflow";

export function CaseSnapshotView({ content }: { content: CaseVersion["content_snapshot"] }) {
  return <div className="space-y-4 text-sm leading-6">
    <h3 className="text-lg font-semibold">{content.code} · {content.title}</h3>
    {([ ["description", "Popis"], ["preconditions", "Předpoklady"], ["expected_summary", "Očekávaný souhrn"] ] as const).map(([key, label]) => content[key] && <div key={key}><h4 className="text-sm font-medium text-slate-500">{label}</h4><p className="whitespace-pre-wrap">{content[key]}</p></div>)}
    <p className="text-sm">{content.automated ? "Automatizovaný" : "Manuální"} scénář</p>
    <div className="flex flex-wrap gap-2">{content.tags?.map(t => <span className="rounded-md bg-slate-100 px-2 py-1 text-xs" key={t.id}>{t.name}</span>)}</div>
    {content.steps.map(s => <section key={s.step_key ?? s.step_order} className="rounded-md border border-slate-200 bg-slate-50 p-4"><h4 className="font-medium">Krok {s.step_order} {s.step_type === "information" ? "· Informace" : ""}</h4><p className="whitespace-pre-wrap">{s.action}</p>{s.expected_result && <p className="mt-2 whitespace-pre-wrap text-emerald-800">Očekáváno: {s.expected_result}</p>}{s.test_data && <p className="text-sm">Data: {s.test_data}</p>}{s.note && <p className="text-sm text-slate-500">{s.note}</p>}</section>)}
  </div>;
}
