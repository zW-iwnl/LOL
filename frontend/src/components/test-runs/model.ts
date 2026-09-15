import type { TestRun, TestRunCaseListItem, TestRunCreatePayload, TestRunStatus } from "../../api/testRuns";

export const statusLabels: Record<TestRunStatus, string> = { open: "Otevřený", in_progress: "Probíhá", completed: "Dokončený", archived: "Archivovaný" };
export const statusClasses: Record<TestRunStatus, string> = { open: "bg-info-bg text-info", in_progress: "bg-warning-bg text-warning", completed: "bg-success-bg text-success", archived: "bg-surface-muted text-muted" };
export const runResultLabels: Record<TestRunCaseListItem["result"], string> = { not_run: "Neproveden", passed: "Prošel", failed: "Neprošel", blocked: "Blokovaný", skipped: "Přeskočený" };
export function resultSummary(cases: Pick<TestRunCaseListItem, "result">[]) {
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, not_run: 0 };
  for (const item of cases) counts[item.result]++;
  const total = cases.length;
  const executed = total - counts.not_run;
  return { counts, total, executed, progress: total ? Math.round(executed / total * 100) : 0, passRate: executed ? Math.round(counts.passed / executed * 100) : null };
}
export type RunForm = { name: string; task_number: string; description: string; version: string; environment: string; status: TestRunStatus; planned_start: string; planned_end: string };
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function toForm(run: TestRun): RunForm {
  return { name: run.name, task_number: run.task_number ?? "", description: run.description ?? "", version: run.version ?? "", environment: run.environment ?? "", status: run.status, planned_start: localDate(run.planned_start), planned_end: localDate(run.planned_end) };
}
export function validateRunForm(form: Omit<RunForm, "status">) {
  if (!form.name.trim()) return "Název úkolu je povinný.";
  if (form.name.trim().length > 255 || form.task_number.trim().length > 100) return "Název může mít nejvýše 255 znaků a číslo úkolu 100 znaků.";
  if (form.environment.trim().length > 100 || form.version.trim().length > 100) return "Prostředí a verze mohou mít nejvýše 100 znaků.";
  if ([form.planned_start, form.planned_end].some(value => value && !Number.isFinite(Date.parse(value)))) return "Zadejte platné datum a čas.";
  if (form.planned_start && form.planned_end && new Date(form.planned_start) > new Date(form.planned_end)) return "Termín nesmí být před plánovaným začátkem.";
  return null;
}
export function runPayload(form: RunForm): TestRunCreatePayload {
  return { name: form.name.trim(), task_number: form.task_number.trim() || null, description: form.description.trim() || null, version: form.version.trim() || null, environment: form.environment.trim() || null, status: form.status, planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null, planned_end: form.planned_end ? new Date(form.planned_end).toISOString() : null };
}
export function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
