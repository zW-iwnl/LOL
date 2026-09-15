import { Activity, CheckCircle2, ClipboardCheck, PlayCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { getDashboard } from "../api/client";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { resultLabel } from "../data/mockData";

import { resultChartClasses as resultColors } from "../data/resultStyles";

export function DashboardPage() {
  const dashboard = useApiResource(() => getDashboard(), []);

  if (dashboard.loading) {
    return <LoadingState />;
  }

  if (dashboard.error || !dashboard.data) {
    return <ErrorState message={dashboard.error ?? "Dashboard data nejsou dostupná."} />;
  }

  const kpis = [
    { label: "Počet test cases", value: dashboard.data.stats.test_cases_count.toString(), icon: ClipboardCheck },
    { label: "Aktivní test runy", value: dashboard.data.stats.active_test_runs_count.toString(), icon: PlayCircle },
    { label: "Pass rate", value: `${dashboard.data.stats.pass_rate} %`, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-md border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted">{kpi.label}</div>
                <Icon className="text-link" size={20} />
              </div>
              <div className="mt-3 text-3xl font-semibold">{kpi.value}</div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Poslední test runy</h2>
            <a
              className="relative z-20 inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
              href="/test-runs?new=1"
            >
              <Plus size={16} /> Nový run
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Název</th>
                  <th className="px-5 py-3 font-medium">Stav</th>
                  <th className="px-5 py-3 font-medium">Prostředí</th>
                  <th className="px-5 py-3 font-medium">Průběh</th>
                  <th className="px-5 py-3 font-medium">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.data.recent_test_runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium"><Link className="text-link hover:underline" to={`/test-runs/${run.id}/execution`}>{run.name}</Link></td>
                    <td className="px-5 py-3">{({ open: "Otevřený", in_progress: "Probíhá", completed: "Dokončený", archived: "Archivovaný" } as Record<string, string>)[run.status] ?? run.status}</td>
                    <td className="px-5 py-3">{run.environment ?? "-"}</td>
                    <td className="px-5 py-3">{run.executed ?? 0}/{run.total ?? 0}</td>
                    <td className="px-5 py-3">{run.executed ? `${run.pass_rate}%` : "Dosud nehodnoceno"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-md border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">Výsledky testů</h2><p className="mt-1 text-xs text-muted">Pass rate: úspěšné ze všech vyhodnocených testů, včetně blokovaných a přeskočených.</p>
            <div className="mt-5 space-y-4">
              {dashboard.data.results.map((item) => (
                <div key={item.result}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{resultLabel(item.result)}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-muted">
                    <div className={`h-2 rounded-full ${resultColors[item.result]}`} style={{ width: `${item.count / Math.max(1, dashboard.data!.results.reduce((total, row) => total + row.count, 0)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-5">
            <h2 className="text-base font-semibold">Rychlé akce</h2>
            <div className="mt-4 grid gap-2">
              {[
                { label: "Moje review", to: "/test-case-approvals?assigned_to_me=true" },
                { label: "Vrácené k dopracování", to: "/test-case-approvals?tab=mine&status=changes_requested" },
                { label: "Moje rozpracované návrhy", to: "/test-case-approvals?tab=drafts&mine=true" },
                { label: "Nový test case", to: "/test-cases?new=1" },
                { label: "Založit test run", to: "/test-runs?new=1" },
                { label: "Pokračovat v testování", to: "/test-runs" },
              ].map((action) => (
                <Link key={action.label} to={action.to} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-surface-muted">
                  <Activity size={16} className="text-link" /> {action.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
