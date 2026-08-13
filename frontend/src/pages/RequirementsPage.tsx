import { AlertTriangle, CheckCircle2, Filter, Link2, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { getTestCases } from "../api/client";
import type { Priority, TestRunCaseResult } from "../api/client";
import {
  createRequirement,
  getRequirements,
  getTraceability,
  linkRequirementTestCases,
  unlinkRequirementTestCase,
  type Requirement,
  type RequirementStatus,
  type TraceabilityRow,
} from "../api/requirements";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { resultLabel } from "../data/mockData";
import { useActiveProject } from "../projects/ActiveProjectContext";

const priorities: Priority[] = ["low", "medium", "high", "critical"];
const statuses: RequirementStatus[] = ["draft", "approved", "deprecated"];

const statusLabels: Record<RequirementStatus, string> = {
  draft: "Draft",
  approved: "Schválený",
  deprecated: "Deprecated",
};

const priorityLabels: Record<Priority, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
  critical: "Kritická",
};

const riskLabels: Record<TraceabilityRow["risk_status"], string> = {
  missing_tests: "Chybí testy",
  defect_risk: "Otevřené defecty",
  failing: "Selhává",
  partial: "Částečně ověřeno",
  verified: "Ověřeno",
};

const resultOptions: Array<TestRunCaseResult | "none"> = ["none", "passed", "failed", "blocked", "skipped"];

function riskBadgeClass(status: TraceabilityRow["risk_status"]) {
  return {
    missing_tests: "bg-amber-50 text-amber-700",
    defect_risk: "bg-rose-50 text-rose-700",
    failing: "bg-red-50 text-red-700",
    partial: "bg-sky-50 text-sky-700",
    verified: "bg-emerald-50 text-emerald-700",
  }[status];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RequirementsPage() {
  const { activeProjectId, activeProject, loading: projectsLoading, error: projectsError } = useActiveProject();
  const [refreshKey, setRefreshKey] = useState(0);
  const requirementsState = useApiResource(() => (activeProjectId ? getRequirements(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const traceabilityState = useApiResource(() => (activeProjectId ? getTraceability(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const casesState = useApiResource(() => (activeProjectId ? getTestCases(activeProjectId) : Promise.resolve([])), [activeProjectId, refreshKey]);
  const [form, setForm] = useState({ code: "", title: "", description: "", priority: "medium" as Priority, status: "draft" as RequirementStatus });
  const [selectedCaseIds, setSelectedCaseIds] = useState<number[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [linkCaseIds, setLinkCaseIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequirementStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<TraceabilityRow["risk_status"] | "all">("all");
  const [resultFilter, setResultFilter] = useState<TestRunCaseResult | "none" | "all">("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requirements = requirementsState.data ?? [];
  const rows = traceabilityState.data ?? [];
  const testCases = casesState.data ?? [];
  const selectedRequirement = requirements.find((requirement) => requirement.id === Number(selectedRequirementId)) ?? requirements[0] ?? null;
  const linkedCaseIds = new Set(selectedRequirement?.test_cases.map((testCase) => testCase.id) ?? []);
  const availableCases = testCases.filter((testCase) => !linkedCaseIds.has(testCase.id));
  const kpis = useMemo(() => {
    const covered = rows.filter((row) => row.coverage_status === "covered").length;
    const openDefects = rows.reduce((sum, row) => sum + row.open_defects.length, 0);
    const verified = rows.filter((row) => row.risk_status === "verified").length;
    return {
      requirements: rows.length,
      covered,
      missing: rows.length - covered,
      openDefects,
      verified,
    };
  }, [rows]);
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        row.requirement_code.toLowerCase().includes(normalizedQuery) ||
        row.requirement_title.toLowerCase().includes(normalizedQuery) ||
        row.test_cases.some((testCase) => `${testCase.code} ${testCase.title}`.toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === "all" || row.requirement_status === statusFilter;
      const matchesRisk = riskFilter === "all" || row.risk_status === riskFilter;
      const matchesResult =
        resultFilter === "all" ||
        (resultFilter === "none" ? row.latest_result === null : row.latest_result === resultFilter);
      return matchesQuery && matchesStatus && matchesRisk && matchesResult;
    });
  }, [query, resultFilter, riskFilter, rows, statusFilter]);
  const unlinkedTestCases = useMemo(() => {
    const linkedIds = new Set(rows.flatMap((row) => row.test_cases.map((testCase) => testCase.id)));
    return testCases.filter((testCase) => !linkedIds.has(testCase.id));
  }, [rows, testCases]);
  const blockedRows = rows.filter((row) => row.risk_status !== "verified");

  if (projectsLoading || requirementsState.loading || traceabilityState.loading || casesState.loading) {
    return <LoadingState />;
  }

  if (projectsError || requirementsState.error || traceabilityState.error || casesState.error) {
    return <ErrorState message={projectsError ?? requirementsState.error ?? traceabilityState.error ?? casesState.error ?? "Requirements nejsou dostupné."} />;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId || !form.code.trim() || !form.title.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const requirement = await createRequirement(activeProjectId, {
        code: form.code.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        test_case_ids: selectedCaseIds,
      });
      setForm({ code: "", title: "", description: "", priority: "medium", status: "draft" });
      setSelectedCaseIds([]);
      setSelectedRequirementId(String(requirement.id));
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Requirement se nepodařilo vytvořit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkCases() {
    if (!selectedRequirement || linkCaseIds.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await linkRequirementTestCases(selectedRequirement.id, linkCaseIds);
      setLinkCaseIds([]);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test cases se nepodařilo navázat.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlinkCase(requirementId: number, testCaseId: number) {
    setSaving(true);
    setError(null);
    try {
      await unlinkRequirementTestCase(requirementId, testCaseId);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vazbu se nepodařilo odebrat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Requirements" description={`Požadavky a traceability matrix${activeProject ? ` pro ${activeProject.name}` : ""}.`} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Požadavky" value={kpis.requirements} />
        <KpiCard label="Pokryté testy" value={kpis.covered} />
        <KpiCard label="Ověřené" value={kpis.verified} />
        <KpiCard label="Bez test case" value={kpis.missing} />
        <KpiCard label="Otevřené defecty" value={kpis.openDefects} />
      </section>

      {error && <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form className="rounded-md border border-slate-200 bg-white p-5" onSubmit={(event) => void handleCreate(event)}>
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Nový requirement</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Kód</span>
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="font-medium">Priorita</span>
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>
                {priorities.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Název</span>
            <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Status</span>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as RequirementStatus }))}>
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Popis</span>
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Navázat test cases</span>
            <CaseChecklist testCases={testCases} selectedIds={selectedCaseIds} onChange={setSelectedCaseIds} />
          </label>
          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
            <Plus size={16} /> Vytvořit requirement
          </button>
        </form>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="font-semibold">Traceability matrix</div>
                <div className="mt-1 text-sm text-slate-500">Požadavky, pokrytí testy, poslední výsledek a otevřené defecty.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-56 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <Search size={16} className="text-slate-400" />
                  <input
                    className="w-full outline-none"
                    placeholder="Hledat requirement nebo test case"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <Filter size={16} className="text-slate-400" />
                  <select className="bg-transparent outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RequirementStatus | "all")}>
                    <option value="all">Všechny statusy</option>
                    {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </label>
                <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as TraceabilityRow["risk_status"] | "all")}>
                  <option value="all">Všechna rizika</option>
                  {Object.entries(riskLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={resultFilter} onChange={(event) => setResultFilter(event.target.value as TestRunCaseResult | "none" | "all")}>
                  <option value="all">Všechny výsledky</option>
                  {resultOptions.map((result) => <option key={result} value={result}>{result === "none" ? "Bez výsledku" : resultLabel(result)}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Requirement</th>
                  <th className="px-5 py-3 font-medium">Riziko</th>
                  <th className="px-5 py-3 font-medium">Test cases</th>
                  <th className="px-5 py-3 font-medium">Poslední výsledek</th>
                  <th className="px-5 py-3 font-medium">Otevřené defecty</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.requirement_id} className="border-t border-slate-100 align-top">
                    <td className="px-5 py-4">
                      <button className="font-semibold text-cyan-700" onClick={() => setSelectedRequirementId(String(row.requirement_id))} type="button">
                        {row.requirement_code}
                      </button>
                      <div className="mt-1 text-slate-700">{row.requirement_title}</div>
                      <div className="mt-1 text-xs text-slate-500">{priorityLabels[row.requirement_priority as Priority] ?? row.requirement_priority} / {statusLabels[row.requirement_status as RequirementStatus] ?? row.requirement_status}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${riskBadgeClass(row.risk_status)}`}>
                        {row.risk_status === "verified" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {riskLabels[row.risk_status]}
                      </span>
                      <div className="mt-2 text-xs text-slate-500">{row.tested_case_count}/{row.test_cases.length} test cases ověřeno</div>
                      {(row.failed_case_count > 0 || row.blocked_case_count > 0) && (
                        <div className="mt-1 text-xs text-rose-600">{row.failed_case_count} failed, {row.blocked_case_count} blocked</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.test_cases.map((testCase) => <div key={testCase.id}>{testCase.code} - {testCase.title}</div>)}
                      {row.test_cases.length === 0 && <span className="text-slate-500">-</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div>{row.latest_result ? resultLabel(row.latest_result) : "-"}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(row.latest_executed_at)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{row.open_defect_count}</div>
                      {row.open_defects.map((defect) => <div key={defect.id} className="text-xs text-slate-500">{defect.title}</div>)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>Zatím nejsou evidované žádné requirements.</td></tr>}
                {rows.length > 0 && filteredRows.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>Filtry neodpovídají žádnému requirementu.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Položky k dořešení</div>
          <div className="mt-4 space-y-2">
            {blockedRows.slice(0, 6).map((row) => (
              <button
                key={row.requirement_id}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => setSelectedRequirementId(String(row.requirement_id))}
                type="button"
              >
                <span>
                  <span className="font-medium">{row.requirement_code}</span>
                  <span className="ml-2 text-slate-600">{row.requirement_title}</span>
                </span>
                <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${riskBadgeClass(row.risk_status)}`}>{riskLabels[row.risk_status]}</span>
              </button>
            ))}
            {blockedRows.length === 0 && <div className="text-sm text-slate-500">Všechny requirements jsou ověřené nebo zatím nejsou dostupná data.</div>}
          </div>
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="font-semibold">Test cases bez requirementu</div>
          <div className="mt-4 max-h-64 space-y-2 overflow-auto">
            {unlinkedTestCases.map((testCase) => (
              <div key={testCase.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="font-medium">{testCase.code} - {testCase.title}</div>
                <div className="text-xs text-slate-500">{priorityLabels[testCase.priority]} / {testCase.status}</div>
              </div>
            ))}
            {unlinkedTestCases.length === 0 && <div className="text-sm text-slate-500">Všechny test cases jsou navázané na requirement.</div>}
          </div>
        </article>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="font-semibold">Vazby vybraného requirementu</div>
        {selectedRequirement ? (
          <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              <div className="text-sm text-slate-500">{selectedRequirement.code} - {selectedRequirement.title}</div>
              {selectedRequirement.test_cases.map((testCase) => (
                <div key={testCase.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{testCase.code} - {testCase.title}</div>
                    <div className="text-xs text-slate-500">{testCase.priority} / {testCase.status}</div>
                  </div>
                  <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" disabled={saving} onClick={() => void handleUnlinkCase(selectedRequirement.id, testCase.id)} title="Odebrat vazbu" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {selectedRequirement.test_cases.length === 0 && <div className="text-sm text-slate-500">Requirement zatím nemá navázané test cases.</div>}
            </div>
            <div>
              <div className="text-sm font-medium">Přidat test cases</div>
              <CaseChecklist testCases={availableCases} selectedIds={linkCaseIds} onChange={setLinkCaseIds} emptyText="Všechny test cases už jsou navázané." />
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving || linkCaseIds.length === 0} onClick={() => void handleLinkCases()} type="button">
                <Link2 size={16} /> Navázat test cases
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-500">Vyber nebo vytvoř requirement.</div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </article>
  );
}

function CaseChecklist({
  testCases,
  selectedIds,
  onChange,
  emptyText = "Nejsou dostupné žádné test cases.",
}: {
  testCases: Array<{ id: number; code: string; title: string; priority: string; status: string }>;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  emptyText?: string;
}) {
  return (
    <div className="mt-1 max-h-44 overflow-auto rounded-md border border-slate-200">
      {testCases.map((testCase) => (
        <label key={testCase.id} className="flex items-start gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
          <input
            className="mt-1"
            checked={selectedIds.includes(testCase.id)}
            onChange={() => onChange(selectedIds.includes(testCase.id) ? selectedIds.filter((id) => id !== testCase.id) : [...selectedIds, testCase.id])}
            type="checkbox"
          />
          <span>
            <span className="font-medium">{testCase.code} - {testCase.title}</span>
            <span className="block text-xs text-slate-500">{testCase.priority} / {testCase.status}</span>
          </span>
        </label>
      ))}
      {testCases.length === 0 && <div className="px-3 py-4 text-sm text-slate-500">{emptyText}</div>}
    </div>
  );
}
