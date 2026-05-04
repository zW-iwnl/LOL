import { Plus } from "lucide-react";
import { useState } from "react";
import { createDefect, getDefects } from "../api/client";
import { ErrorState, LoadingState, useApiResource, useCurrentProject } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";

export function DefectsPage() {
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const defectsState = useApiResource(() => (project ? getDefects(project.id) : Promise.resolve([])), [project?.id, refreshKey]);

  async function handleCreateDefect() {
    if (!project) {
      return;
    }
    setActionError(null);
    try {
      await createDefect(project.id, {
        title: `Nový defect ${new Date().toLocaleTimeString("cs-CZ")}`,
        description: "Založeno z frontend UI pro ověření API napojení.",
        severity: "medium",
        priority: "medium",
        status: "open",
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Defect se nepodařilo vytvořit.");
    }
  }

  if (projectLoading || defectsState.loading) {
    return <LoadingState />;
  }

  if (projectError || defectsState.error) {
    return <ErrorState message={projectError ?? defectsState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Defecty" description="Evidence nálezů navázaných na výsledky testování." />
        <button
          className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={handleCreateDefect}
        >
          <Plus size={16} /> Nový defect
        </button>
      </div>
      {actionError && <ErrorState message={actionError} />}
      <section className="rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Název</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Priorita</th>
              <th className="px-5 py-3 font-medium">Test run</th>
            </tr>
          </thead>
          <tbody>
            {(defectsState.data ?? []).map((defect) => (
              <tr key={defect.id} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium">{defect.title}</td>
                <td className="px-5 py-3">{defect.status}</td>
                <td className="px-5 py-3">{defect.priority}</td>
                <td className="px-5 py-3">{defect.test_run_case_id ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
