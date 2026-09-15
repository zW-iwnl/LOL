import { type Page } from "@playwright/test";

const user = { id: 1, name: "Testovací uživatel", email: "tester@example.cz", role: "admin", is_active: true };
const cases = [
  { id: 1, code: "TC-1", title: "Přihlášení", suite_id: 1, version_id: 10, tags: ["Účty"], exclusion_reason: null },
  { id: 2, code: "TC-2", title: "Návrh", suite_id: 1, version_id: null, tags: ["Účty"], exclusion_reason: "Chybí schválená verze" },
];
const catalog = {
  cases, suites: [{ id: 1, name: "Přístupy", case_ids: [1, 2] }],
  groups: [{ id: 1, name: "Regrese", case_ids: [1, 2], own_case_ids: [1, 2], suite_ids: [1], children: [] }],
};

export async function mockApi(page: Page, rejectFirstCreate = false) {
  const requests: Record<string, unknown>[] = [];
  const runs: Record<string, unknown>[] = [];
  await page.addInitScript(() => localStorage.setItem("test-manager-token", "test-token"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let json: unknown = [];
    if (path === "/api/auth/me") json = user;
    if (path === "/api/users") json = [user];
    if (path === "/api/test-runs/selection-catalog") json = catalog;
    if (path === "/api/test-runs/selection-preview") {
      const selection = route.request().postDataJSON();
      const nonempty = selection.groups.length || selection.suite_ids.length || selection.test_case_ids.length;
      json = { cases: nonempty ? [cases[0]] : [], excluded_cases: nonempty ? [cases[1]] : [], fingerprint: "a".repeat(64) };
    }
    if (path === "/api/test-runs" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      if (rejectFirstCreate && requests.length === 1) {
        await route.fulfill({ status: 409, json: { detail: "Výběr nebo schválené verze se změnily. Obnovte náhled a zkontrolujte výběr." } });
        return;
      }
      const run = { id: 99, name: payload.name, task_number: payload.task_number, description: payload.description,
        planned_end: payload.planned_end, planned_start: payload.planned_start, status: "open", environment: payload.environment,
        version: payload.version, test_run_cases: [{ id: 1, test_run_id: 99, test_case_id: 1, assigned_to: payload.assigned_to, result: "not_run" }] };
      runs.push(run);
      await route.fulfill({ status: 201, json: run });
      return;
    }
    if (path === "/api/test-runs") json = runs;
    const detail = path.match(/^\/api\/test-runs\/(\d+)$/);
    if (detail) json = runs.find(run => run.id === Number(detail[1]));
    const casesPage = path.match(/^\/api\/test-runs\/(\d+)\/cases\/page$/);
    if (casesPage) { const run = runs.find(run => run.id === Number(casesPage[1])); const items = run?.test_run_cases ?? []; json = { items, total: (items as unknown[]).length }; }

    if (path === "/api/test-runs/page") json = { items: runs, total: runs.length, stats: { total: runs.length, active: runs.length, completed: 0, averagePassRate: 0 } };
    await route.fulfill({ json });
  });
  return requests;
}

