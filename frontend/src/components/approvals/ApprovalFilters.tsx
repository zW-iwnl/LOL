import { useState } from "react";
import { getTestCaseTags, getTestSuites, getUsers } from "../../api/client";
import { getRepositoryStructure } from "../../api/repositoryWorkspace";
import { getTestRuns } from "../../api/testRuns";
import { useApiResource } from "../../api/hooks";
import { MultiTagSelect } from "../TestCaseTags";
import { SearchSelect } from "../workspace/SearchSelect";
import { useDebounced } from "../workspace/useDebounced";
export function ApprovalFilters({ params, tab, onChange }: { params: URLSearchParams; tab: string; onChange: (key: string, values: string[]) => void }) {
  const [open, setOpen] = useState(false); const [runQuery, setRunQuery] = useState(""); const runSearch = useDebounced(runQuery);
  const options = useApiResource(() => open ? Promise.all([getTestSuites(), getRepositoryStructure(), getTestCaseTags(), getUsers()]) : Promise.resolve(null), [open]);
  const runs = useApiResource(() => open && runSearch.trim().length >= 2 ? getTestRuns({ q: runSearch, limit: 25 }) : Promise.resolve([]), [open, runSearch]);
  const active = [...params.entries()].filter(([key, value]) => !["q", "tab", "offset", "limit", "review", "returnTo"].includes(key) && value !== "");
  const names: Record<string, string> = { status: "Stav", assigned_to_me: "Přiřazené mně", unassigned: "Nepřiřazené", mine: "Moje návrhy", suite_id: "Suita", group_id: "Skupina", author_id: "Autor", reviewer_id: "Reviewer", origin_run_id: "Zdrojový běh", include_descendants: "Potomci", business_area_id: "Business oblast", application_domain_id: "Aplikace/doména", object_type_id: "Objekt" };
  function label(key: string, value: string) {
    const data = options.data;
    if (key === "status") return ({ pending: "Ke schválení", approved: "Schváleno", changes_requested: "K dopracování", rejected: "Zamítnuto", withdrawn: "Staženo" } as Record<string, string>)[value] ?? value;
    if (value === "true") return names[key];
    if (key === "include_descendants") return "Bez dalších potomků";
    const items = key === "suite_id" ? data?.[0] : key === "group_id" ? data?.[1].groups : key === "author_id" || key === "reviewer_id" ? data?.[3] : key.endsWith("_id") && key !== "origin_run_id" ? data?.[2] : runs.data;
    return `${names[key] ?? key}: ${items?.find(item => String(item.id) === value)?.name ?? `#${value}`}`;
  }
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><input aria-label="Kód nebo název" type="search" maxLength={200} className="workspace-input min-w-40 flex-1" placeholder="Kód nebo název scénáře…" value={params.get("q") ?? ""} onChange={e => onChange("q", [e.target.value])} />
    {tab === "queue" && <select className="workspace-input" aria-label="Přiřazení žádostí" value={params.get("assigned_to_me") === "true" ? "assigned_to_me" : params.get("unassigned") === "true" ? "unassigned" : "all"} onChange={e => onChange("assignment", [e.target.value])}><option value="all">Všechny čekající</option><option value="assigned_to_me">Přiřazené mně</option><option value="unassigned">Nepřiřazené</option></select>}
    {tab === "drafts" && <label className="text-xs"><input type="checkbox" checked={params.get("mine") === "true"} onChange={e => onChange("mine", e.target.checked ? ["true"] : [])} /> Moje návrhy</label>}
    <button type="button" className="workspace-button" aria-expanded={open} onClick={() => setOpen(!open)}>Filtry{active.length ? ` (${active.length})` : ""}</button></div>
    {!!active.length && <div className="flex flex-wrap gap-1">{active.map(([key, value], i) => <button key={`${key}:${value}:${i}`} type="button" className="rounded bg-cyan-50 px-2 py-1 text-[11px] text-cyan-800" onClick={() => onChange(key, params.getAll(key).filter(item => item !== value))}>{label(key, value)} ×</button>)}</div>}
    {open && <div className="grid gap-2 rounded border border-slate-200 bg-white p-2 md:grid-cols-3 xl:grid-cols-4">{options.loading && <p role="status" className="text-xs">Načítám filtry…</p>}{options.error && <p role="alert" className="text-xs text-rose-700">{options.error}</p>}
      {tab !== "drafts" && tab !== "queue" && <select aria-label="Stav žádosti" className="workspace-input" value={params.get("status") ?? ""} onChange={e => onChange("status", [e.target.value])}><option value="">Všechny stavy</option>{[["pending", "Ke schválení"], ["approved", "Schváleno"], ["changes_requested", "K dopracování"], ["rejected", "Zamítnuto"], ["withdrawn", "Staženo"]].filter(([v]) => tab !== "history" || v !== "pending").map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
      <SearchSelect label="Suita" value={params.get("suite_id") ?? ""} options={options.data?.[0] ?? []} onChange={v => onChange("suite_id", [v])} />
      <SearchSelect label="Skupina (aktuální zařazení)" value={params.get("group_id") ?? ""} options={options.data?.[1].groups ?? []} onChange={v => onChange("group_id", [v])} />
      {params.has("group_id") && <label className="text-xs"><input type="checkbox" checked={params.get("include_descendants") !== "false"} onChange={e => onChange("include_descendants", e.target.checked ? [] : ["false"])} />Včetně dalších potomků skupiny</label>}
      <SearchSelect label={tab === "drafts" ? "Editor" : "Autor"} value={params.get("author_id") ?? ""} options={options.data?.[3] ?? []} onChange={v => onChange("author_id", [v])} />
      {tab !== "drafts" && <SearchSelect label="Reviewer" value={params.get("reviewer_id") ?? ""} options={options.data?.[3] ?? []} onChange={v => onChange("reviewer_id", [v])} />}
      {([["business_area", "Business oblast"], ["application_domain", "Aplikace/doména"], ["object_type", "Objekt"]] as const).map(([category, label]) => <MultiTagSelect key={category} label={label} tags={(options.data?.[2] ?? []).filter(tag => tag.category === category)} values={params.getAll(`${category}_id`).map(Number)} onChange={ids => onChange(`${category}_id`, ids.map(String))} />)}
      <div className="space-y-1"><input type="search" aria-label="Hledat zdrojový běh" className="workspace-input w-full" value={runQuery} onChange={e => setRunQuery(e.target.value)} placeholder="Název / číslo úkolu (min. 2 znaky)" /><select aria-label="Zdrojový běh" className="workspace-input w-full" value={params.get("origin_run_id") ?? ""} onChange={e => onChange("origin_run_id", [e.target.value])}><option value="">Všechny zdroje</option>{params.has("origin_run_id") && !runs.data?.some(run => String(run.id) === params.get("origin_run_id")) && <option value={params.get("origin_run_id")!}>Run #{params.get("origin_run_id")}</option>}{runs.data?.map(run => <option key={run.id} value={run.id}>{run.task_number ? `${run.task_number} · ` : ""}{run.name}</option>)}</select><p className="text-[10px] text-slate-500">Nejvýše 25 běhů; zpřesněte hledání.</p>{runs.error && <p role="alert" className="text-xs text-rose-700">{runs.error}</p>}</div>
    </div>}
  </div>;
}
