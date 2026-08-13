import { FormEvent, useEffect, useState } from "react";
import { Eye, Pencil, Plus, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import {
  createDefect,
  getAuditEvents,
  getDefects,
  getUsers,
  updateDefect,
  type Defect,
  type DefectStatus,
  type Priority,
} from "../api/client";
import { ErrorState, LoadingState, useApiResource, useCurrentProject } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { useActiveProject } from "../projects/ActiveProjectContext";

const priorities: Priority[] = ["low", "medium", "high", "critical"];
const statuses: DefectStatus[] = ["open", "in_progress", "fixed", "retest", "closed", "rejected"];
const allowedStatusTransitions: Record<DefectStatus, DefectStatus[]> = {
  open: ["open", "in_progress", "rejected"],
  in_progress: ["in_progress", "fixed", "rejected"],
  fixed: ["fixed", "retest", "closed"],
  retest: ["retest", "in_progress", "closed"],
  closed: ["closed", "open"],
  rejected: ["rejected", "open"],
};
const workflowActionLabels: Record<DefectStatus, string> = {
  open: "Znovu otevřít",
  in_progress: "Zahájit řešení",
  fixed: "Označit fixed",
  retest: "Poslat na retest",
  closed: "Zavřít",
  rejected: "Zamítnout",
};

type ModalMode = "create" | "edit" | "detail";

type DefectForm = {
  title: string;
  description: string;
  severity: Priority;
  priority: Priority;
  status: DefectStatus;
  testRunCaseId: string;
  assignedTo: string;
};

const emptyForm: DefectForm = {
  title: "",
  description: "",
  severity: "medium",
  priority: "medium",
  status: "open",
  testRunCaseId: "",
  assignedTo: "",
};

function toForm(defect: Defect): DefectForm {
  return {
    title: defect.title,
    description: defect.description ?? "",
    severity: defect.severity,
    priority: defect.priority,
    status: defect.status,
    testRunCaseId: defect.test_run_case_id?.toString() ?? "",
    assignedTo: defect.assigned_to?.toString() ?? "",
  };
}

function buildPayload(form: DefectForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    severity: form.severity,
    priority: form.priority,
    status: form.status,
    test_run_case_id: form.testRunCaseId ? Number(form.testRunCaseId) : null,
    assigned_to: form.assignedTo ? Number(form.assignedTo) : null,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function describeAuditChanges(changes: Record<string, unknown> | null) {
  if (!changes) {
    return "-";
  }
  return Object.entries(changes)
    .map(([field, value]) => {
      if (value && typeof value === "object" && "from" in value && "to" in value) {
        const change = value as { from: unknown; to: unknown };
        return `${field}: ${String(change.from ?? "-")} -> ${String(change.to ?? "-")}`;
      }
      return `${field}: ${JSON.stringify(value)}`;
    })
    .join(", ");
}

export function DefectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, loading: projectLoading, error: projectError } = useCurrentProject();
  const { projects, activeProjectId, setActiveProjectId } = useActiveProject();
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [form, setForm] = useState<DefectForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const defectsState = useApiResource(() => (project ? getDefects(project.id) : Promise.resolve([])), [project?.id, refreshKey]);
  const usersState = useApiResource(getUsers, []);
  const auditState = useApiResource(
    () => (selectedDefect ? getAuditEvents({ entityType: "Defect", entityId: selectedDefect.id, limit: 20 }) : Promise.resolve([])),
    [selectedDefect?.id, refreshKey],
  );
  const statusOptions =
    modalMode === "edit" && selectedDefect ? allowedStatusTransitions[selectedDefect.status] : statuses;

  useEffect(() => {
    if (searchParams.get("new") === "1" && !modalMode) {
      openCreate();
      setSearchParams({}, { replace: true });
    }
  }, [modalMode, searchParams, setSearchParams]);

  function openCreate() {
    setSelectedDefect(null);
    setForm(emptyForm);
    setFormError(null);
    setModalMode("create");
  }

  function openEdit(defect: Defect) {
    setSelectedDefect(defect);
    setForm(toForm(defect));
    setFormError(null);
    setModalMode("edit");
  }

  function openDetail(defect: Defect) {
    setSelectedDefect(defect);
    setForm(toForm(defect));
    setFormError(null);
    setModalMode("detail");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedDefect(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !form.title.trim()) {
      setFormError("Název defectu je povinný.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (modalMode === "edit" && selectedDefect) {
        await updateDefect(selectedDefect.id, buildPayload(form));
      } else {
        await createDefect(project.id, buildPayload(form));
      }
      setRefreshKey((value) => value + 1);
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Defect se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWorkflowAction(nextStatus: DefectStatus) {
    if (!selectedDefect) {
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateDefect(selectedDefect.id, { status: nextStatus });
      setSelectedDefect(updated);
      setForm(toForm(updated));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Status defectu se nepodařilo změnit.");
    } finally {
      setSaving(false);
    }
  }

  if (projectLoading || defectsState.loading || usersState.loading) {
    return <LoadingState />;
  }

  if (projectError || defectsState.error || usersState.error) {
    return <ErrorState message={projectError ?? defectsState.error ?? usersState.error ?? "Data nejsou dostupná."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Defecty" description="Evidence nálezů navázaných na výsledky testování." />
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 text-sm">
            <span className="font-medium">Projekt</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={activeProjectId ?? ""}
              onChange={(event) => {
                setActiveProjectId(event.target.value ? Number(event.target.value) : null);
                closeModal();
              }}
            >
              {projects.length === 0 ? <option value="">Žádný projekt</option> : null}
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
              ))}
            </select>
          </label>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">
            <Plus size={16} /> Nový defect
          </button>
        </div>
      </div>

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Název</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Priorita</th>
              <th className="px-5 py-3 font-medium">Severity</th>
              <th className="px-5 py-3 font-medium">Test run case</th>
              <th className="px-5 py-3 font-medium">Akce</th>
            </tr>
          </thead>
          <tbody>
            {(defectsState.data ?? []).map((defect) => (
              <tr key={defect.id} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium">{defect.title}</td>
                <td className="px-5 py-3">{defect.status}</td>
                <td className="px-5 py-3">{defect.priority}</td>
                <td className="px-5 py-3">{defect.severity}</td>
                <td className="px-5 py-3">{defect.test_run_case_id ?? "-"}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openDetail(defect)} type="button">
                      <Eye size={14} /> Detail
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openEdit(defect)} type="button">
                      <Pencil size={14} /> Upravit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(defectsState.data ?? []).length === 0 ? <div className="p-5 text-sm text-slate-500">Vybraný projekt zatím nemá defecty.</div> : null}
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-2xl rounded-md bg-white p-5 shadow-xl" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{modalMode === "create" ? "Nový defect" : modalMode === "edit" ? "Upravit defect" : "Detail defectu"}</h2>
                <p className="mt-1 text-sm text-slate-500">Projekt: {project?.name ?? "-"}</p>
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Název</span>
                <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Status</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DefectStatus }))}>
                  {statusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Priorita</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}>
                  {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Severity</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as Priority }))}>
                  {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Přiřazeno</span>
                <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} value={form.assignedTo} onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}>
                  <option value="">Nepřiřazeno</option>
                  {(usersState.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Popis</span>
                <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50" disabled={modalMode === "detail"} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
            </div>

            {selectedDefect?.test_run_case_id ? (
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                Vazba na test run case: {selectedDefect.test_run_case_id}
              </div>
            ) : null}

            {selectedDefect && modalMode !== "create" ? (
              <section className="mt-4 rounded-md border border-slate-200 p-4">
                <div className="font-semibold">Workflow akce</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowedStatusTransitions[selectedDefect.status]
                    .filter((status) => status !== selectedDefect.status)
                    .map((status) => (
                      <button
                        key={status}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                        disabled={saving || modalMode === "edit"}
                        onClick={() => void handleWorkflowAction(status)}
                        type="button"
                      >
                        {workflowActionLabels[status]}
                      </button>
                    ))}
                  {allowedStatusTransitions[selectedDefect.status].filter((status) => status !== selectedDefect.status).length === 0 ? (
                    <span className="text-sm text-slate-500">Pro aktuální status nejsou dostupné žádné akce.</span>
                  ) : null}
                </div>
              </section>
            ) : null}

            {selectedDefect ? (
              <section className="mt-4 rounded-md border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3 font-semibold">Audit historie</div>
                <div className="max-h-48 overflow-auto divide-y divide-slate-100">
                  {auditState.loading ? (
                    <div className="px-4 py-4 text-sm text-slate-500">Načítám historii...</div>
                  ) : (auditState.data ?? []).length > 0 ? (
                    (auditState.data ?? []).map((event) => (
                      <div key={event.id} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{event.action}</span>
                          <span className="text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Uživatel ID: {event.actor_id ?? "-"}</div>
                        <div className="mt-2 text-xs text-slate-600">{describeAuditChanges(event.changes)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-slate-500">Zatím není zapsaná žádná historie.</div>
                  )}
                </div>
              </section>
            ) : null}

            {formError ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{formError}</div> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={closeModal} type="button">
                {modalMode === "detail" ? "Zavřít" : "Zrušit"}
              </button>
              {modalMode !== "detail" ? (
                <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Ukládám..." : "Uložit"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
