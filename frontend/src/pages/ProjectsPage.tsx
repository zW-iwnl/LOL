import { Archive, Eye, FolderKanban, Pencil, Plus, Search, X } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  archiveProject,
  createProject,
  getProjects,
  updateProject,
  type Project,
  type ProjectCreatePayload,
  type ProjectStatus,
} from "../api/projects";
import { ErrorState, LoadingState, useApiResource } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";

const statusLabels: Record<ProjectStatus, string> = {
  active: "Aktivní",
  paused: "Pozastavený",
  archived: "Archivovaný",
};

const statusClasses: Record<ProjectStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
};

type ModalMode = "create" | "edit" | "detail";

type ProjectFormState = {
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
};

const emptyForm: ProjectFormState = {
  name: "",
  code: "",
  description: "",
  status: "active",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusBadge(status: ProjectStatus) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function toForm(project: Project): ProjectFormState {
  return {
    name: project.name,
    code: project.code,
    description: project.description ?? "",
    status: project.status,
  };
}

export function ProjectsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectsState = useApiResource(
    () => getProjects({ q: query, status: statusFilter, limit: 100, offset: 0 }),
    [query, statusFilter, refreshKey],
  );
  const allProjectsState = useApiResource(() => getProjects({ limit: 100, offset: 0 }), [refreshKey]);

  const projects = projectsState.data ?? [];
  const allProjects = allProjectsState.data ?? [];
  const kpis = {
    total: allProjects.length,
    active: allProjects.filter((project) => project.status === "active").length,
    archived: allProjects.filter((project) => project.status === "archived").length,
    paused: allProjects.filter((project) => project.status === "paused").length,
  };

  function openCreate() {
    setSelectedProject(null);
    setForm(emptyForm);
    setFormError(null);
    setModalMode("create");
  }

  function openEdit(project: Project) {
    setSelectedProject(project);
    setForm(toForm(project));
    setFormError(null);
    setModalMode("edit");
  }

  function openDetail(project: Project) {
    setSelectedProject(project);
    setForm(toForm(project));
    setFormError(null);
    setModalMode("detail");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedProject(null);
    setFormError(null);
  }

  function validateForm() {
    if (!form.name.trim()) {
      return "Název projektu je povinný.";
    }
    if (!form.code.trim()) {
      return "Kód projektu je povinný.";
    }
    if (!/^[A-Z0-9_-]+$/.test(form.code.trim())) {
      return "Kód projektu použij uppercase bez mezer. Povolené jsou písmena, čísla, _ a -.";
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const payload: ProjectCreatePayload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      status: form.status,
    };

    setSaving(true);
    setFormError(null);
    setPageError(null);
    try {
      if (modalMode === "edit" && selectedProject) {
        await updateProject(selectedProject.id, payload);
      } else {
        await createProject(payload);
      }
      closeModal();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Projekt se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(project: Project) {
    const confirmed = window.confirm(`Archivovat projekt ${project.code} - ${project.name}?`);
    if (!confirmed) {
      return;
    }

    setPageError(null);
    try {
      await archiveProject(project.id);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Projekt se nepodařilo archivovat.");
    }
  }

  if (projectsState.loading || allProjectsState.loading) {
    return <LoadingState />;
  }

  if (projectsState.error || allProjectsState.error) {
    return <ErrorState message={projectsState.error ?? allProjectsState.error ?? "Projekty nejsou dostupné."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeader title="Projekty" description="Správa projektů, ve kterých se evidují test suity, test cases a test runy." />
        <button className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={openCreate} type="button">
          <Plus size={16} /> Nový projekt
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">Celkem projektů</div>
            <FolderKanban size={18} className="text-cyan-700" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{kpis.total}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Aktivní projekty</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.active}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Archivované projekty</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.archived}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Pozastavené projekty</div>
          <div className="mt-3 text-2xl font-semibold">{kpis.paused}</div>
        </article>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none ring-cyan-500 transition focus:border-cyan-500 focus:ring-2"
              placeholder="Hledat projekt..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm lg:w-56"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProjectStatus | "")}
          >
            <option value="">Vše</option>
            <option value="active">Aktivní</option>
            <option value="paused">Pozastavené</option>
            <option value="archived">Archivované</option>
          </select>
        </div>

        {pageError && <div className="m-5 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{pageError}</div>}

        {projects.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-slate-100 text-slate-500">
              <FolderKanban size={22} />
            </div>
            <h2 className="mt-4 font-semibold">Žádné projekty</h2>
            <p className="mt-1 text-sm text-slate-500">Změň filtr nebo založ první projekt.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Kód</th>
                  <th className="px-5 py-3 font-medium">Název</th>
                  <th className="px-5 py-3 font-medium">Popis</th>
                  <th className="px-5 py-3 font-medium">Stav</th>
                  <th className="px-5 py-3 font-medium">Vytvořeno</th>
                  <th className="px-5 py-3 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-semibold text-cyan-700">{project.code}</td>
                    <td className="px-5 py-4 font-medium">{project.name}</td>
                    <td className="max-w-sm truncate px-5 py-4 text-slate-600">{project.description ?? "-"}</td>
                    <td className="px-5 py-4">{statusBadge(project.status)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(project.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openDetail(project)} type="button">
                          <Eye size={14} /> Detail
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium" onClick={() => openEdit(project)} type="button">
                          <Pencil size={14} /> Upravit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={project.status === "archived"}
                          onClick={() => void handleArchive(project)}
                          type="button"
                        >
                          <Archive size={14} /> Archivovat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-xl rounded-md bg-white p-5 shadow-xl" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {modalMode === "create" ? "Nový projekt" : modalMode === "edit" ? "Upravit projekt" : "Detail projektu"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Základní údaje projektu pro testovací agendu.</p>
              </div>
              <button className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Název projektu</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                  disabled={modalMode === "detail"}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Kód projektu</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 uppercase disabled:bg-slate-50"
                  disabled={modalMode === "detail"}
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Status</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                  disabled={modalMode === "detail"}
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))}
                >
                  <option value="active">Aktivní</option>
                  <option value="paused">Pozastavený</option>
                  <option value="archived">Archivovaný</option>
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium">Popis</span>
                <textarea
                  className="mt-1 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                  disabled={modalMode === "detail"}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>

            {selectedProject && modalMode === "detail" && (
              <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 text-sm md:grid-cols-2">
                <div><span className="text-slate-500">ID:</span> {selectedProject.id}</div>
                <div><span className="text-slate-500">Vytvořil:</span> {selectedProject.created_by}</div>
                <div><span className="text-slate-500">Vytvořeno:</span> {formatDate(selectedProject.created_at)}</div>
                <div><span className="text-slate-500">Upraveno:</span> {formatDate(selectedProject.updated_at)}</div>
              </div>
            )}

            {formError && <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium" onClick={closeModal} type="button">
                {modalMode === "detail" ? "Zavřít" : "Zrušit"}
              </button>
              {modalMode !== "detail" && (
                <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Ukládám..." : "Uložit"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
