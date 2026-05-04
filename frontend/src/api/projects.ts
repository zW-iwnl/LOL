import { request } from "./client";

export type ProjectStatus = "active" | "paused" | "archived";

export type Project = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type ProjectCreatePayload = {
  name: string;
  code: string;
  description?: string | null;
  status: ProjectStatus;
};

export type ProjectUpdatePayload = Partial<ProjectCreatePayload>;

export type GetProjectsParams = {
  q?: string;
  status?: ProjectStatus | "";
  limit?: number;
  offset?: number;
};

function buildQuery(params: GetProjectsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getProjects(params: GetProjectsParams = {}) {
  return request<Project[]>(`/projects${buildQuery(params)}`);
}

export function getProject(projectId: number) {
  return request<Project>(`/projects/${projectId}`);
}

export function createProject(payload: ProjectCreatePayload) {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProject(projectId: number, payload: ProjectUpdatePayload) {
  return request<Project>(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function archiveProject(projectId: number) {
  return request<void>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}
