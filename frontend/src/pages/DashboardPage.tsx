import { Activity, Bug, CheckCircle2, ClipboardCheck, PlayCircle, Plus } from "lucide-react";
import { getDashboard, type TestRunCaseResult } from "../api/client";
import { ErrorState, LoadingState, useApiResource, useCurrentProject } from "../api/hooks";
import { resultLabel } from "../data/mockData";

const resultColors: Record<TestRunCaseResult, string> = {
  not_run: "bg-slate-300",
  passed: "bg-emerald-500",
  failed: "bg-rose-500",
  blocked: "bg-amber-500",
  skipped: "bg-slate-400",
};

export function DashboardPage() {
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const dashboard = useApiResource(
    () => (project ? getDashboard(project.id) : Promise.reject(new Error("Není dostupný žádný projekt."))),
    [project?.id],
  );

  if (projectLoading || dashboard.loading) {
    return <LoadingState />;
  }

  if (projectError || dashboard.error || !dashboard.data) {
    return <ErrorState message={projectError ?? dashboard.error ?? "Dashboard data nejsou dostupná."} />;
  }

  const kpis = [
    { label: "Počet test cases", value: dashboard.data.stats.test_cases_count.toString(), icon: ClipboardCheck },
    { label: "Aktivní test runy", value: dashboard.data.stats.active_test_runs_count.toString(), icon: PlayCircle },
    { label: "Pass rate", value: `${dashboard.data.stats.pass_rate} %`, icon: CheckCircle2 },
    { label: "Otevřené defecty", value: dashboard.data.stats.open_defects_count.toString(), icon: Bug },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-md border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-500">{kpi.label}</div>
                <Icon className="text-cyan-700" size={20} />
              </div>
              <div className="mt-3 text-3xl font-semibold">{kpi.value}</div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold">Poslední test runy</h2>
            <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              <Plus size={16} /> Nový run
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
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
                  <tr key={run.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium">{run.name}</td>
                    <td className="px-5 py-3">{run.status}</td>
                    <td className="px-5 py-3">{run.environment ?? "-"}</td>
                    <td className="px-5 py-3">-</td>
                    <td className="px-5 py-3">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold">Výsledky testů</h2>
            <div className="mt-5 space-y-4">
              {dashboard.data.results.map((item) => (
                <div key={item.result}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{resultLabel(item.result)}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${resultColors[item.result]}`} style={{ width: `${Math.min(item.count * 8, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold">Rychlé akce</h2>
            <div className="mt-4 grid gap-2">
              {["Nový test case", "Založit test run", "Nahlásit defect", "Otevřít execution"].map((action) => (
                <button key={action} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <Activity size={16} className="text-cyan-700" /> {action}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
