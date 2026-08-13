import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getProjects, type Project } from "../api/projects";

type ActiveProjectContextValue = {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: number | null;
  loading: boolean;
  error: string | null;
  setActiveProjectId: (projectId: number | null) => void;
  refreshProjects: () => void;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);
const ACTIVE_PROJECT_STORAGE_KEY = "test-manager.activeProjectId";

function readStoredProjectId() {
  const value = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  const projectId = value ? Number(value) : null;
  return projectId && Number.isInteger(projectId) ? projectId : null;
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<number | null>(() => readStoredProjectId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProjects({ limit: 100, offset: 0 })
      .then((loadedProjects) => {
        setProjects(loadedProjects);
        setActiveProjectIdState((current) => {
          if (current && loadedProjects.some((project) => project.id === current)) {
            return current;
          }
          const nextProjectId = loadedProjects[0]?.id ?? null;
          if (nextProjectId) {
            window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, String(nextProjectId));
          } else {
            window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
          }
          return nextProjectId;
        });
      })
      .catch((loadError: unknown) => {
        setProjects([]);
        setActiveProjectIdState(null);
        setError(loadError instanceof Error ? loadError.message : "Projekty nejsou dostupné.");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const setActiveProjectId = useCallback((projectId: number | null) => {
    setActiveProjectIdState(projectId);
    if (projectId) {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, String(projectId));
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    }
  }, []);

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      projects,
      activeProject,
      activeProjectId,
      loading,
      error,
      setActiveProjectId,
      refreshProjects: () => setRefreshKey((current) => current + 1),
    }),
    [activeProject, activeProjectId, error, loading, projects, setActiveProjectId],
  );

  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProject() {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error("useActiveProject must be used inside ActiveProjectProvider");
  }
  return context;
}
