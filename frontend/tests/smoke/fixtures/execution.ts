import { type Page } from "@playwright/test";

const user = { id: 1, name: "Testovací uživatel", email: "tester@example.cz", role: "admin", is_active: true };
const timestamp = "2026-09-15T09:00:00Z";
function fixture() {
  const rows = ["Přihlášení uživatele", "Obnova hesla", "Platba kartou"].map((title, index) => {
    const id = index + 1;
    const snapshot = { code: `TC-${id}`, title, suite_name: id === 3 ? "Platby" : "Přístupy", preconditions: "Uživatel má aktivní účet.", expected_summary: "Operace proběhne úspěšně.",
      steps: [
        { id: id * 10, step_order: 1, action: "Připravit testovací účet", step_type: "information", note: "Použijte testovací prostředí.", expected_result: null, test_data: null },
        ...Array.from({ length: 12 }, (_, step) => ({ id: id * 100 + step, step_order: step + 2, action: `Ověřit krok ${step + 1} podle testovacího scénáře.`, expected_result: "Aplikace zobrazí odpovídající výsledek.", step_type: "test", note: null, test_data: "Testovací účet" })),
      ] };
    const history = { id: id * 1000, test_run_attempt_id: 10, test_run_attempt_number: 1, test_run_case_id: id, attempt_number: 1,
      result: "failed", comment: "Historický komentář", executed_by: 1, executed_at: timestamp, step_results: [], execution_snapshot: { ...snapshot, title: `Historicky: ${title}` },
      version_number: 1, test_case_version_id: id * 100, approval_state: "approved", approval_state_at_start: "approved", approval_state_at_binding: "approved", closure_reason: "definition_changed", created_at: timestamp, updated_at: timestamp };
    const current = { ...history, id: id * 1000 + 1, attempt_number: 2, result: "not_run", comment: null as string | null, execution_snapshot: snapshot, closure_reason: null, version_number: 2 };
    return { id, test_run_id: 99, test_case_id: id, code: `TC-${id}`, title, suite_name: snapshot.suite_name, assigned_to: id === 3 ? null : 1,
      result: "not_run", comment: null as string | null, case_attempt_id: current.id, case_attempts: [history, current], test_case_snapshot: snapshot, test_case_version: 2, test_case: { id, code: `TC-${id}`, title, suite_id: id === 3 ? 2 : 1 }, step_results: [] };
  });
  return { id: 99, name: "Regresní testování bankovnictví", task_number: "QA-123", environment: "TEST", version: "2026.09", status: "in_progress", selected_attempt_id: 10,
    attempts: [{ id: 10, attempt_number: 1, status: "in_progress", last_test_run_case_id: null, last_step_id: null }], definition_counts: { approved: 3 }, test_run_cases: rows,
    navigation: {
      suites: [{ id: 1, name: "Přístupy", case_ids: [1, 2] }, { id: 2, name: "Platby", case_ids: [3] }],
      groups: [
        { id: 1, name: "Internetové bankovnictví", case_ids: [1, 2, 3], own_case_ids: [1, 2], direct_case_ids: [], suite_ids: [1], children: [{ group_id: 2, include_descendants: true }] },
        { id: 2, name: "Převody", case_ids: [3], own_case_ids: [3], direct_case_ids: [3], suite_ids: [], children: [] },
      ],
    },
  };
}
export async function mockApi(page: Page, failFirstSave = false) {
  const run = fixture();
  const saves: { result: string; comment: string }[] = [];
  await page.addInitScript(() => localStorage.setItem("test-manager-token", "execution-test-token"));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/users") return route.fulfill({ json: [user] });
    if (path === "/api/test-runs/99/execution") return route.fulfill({ json: run });
    const resultMatch = path.match(/test-run-case-attempts\/(\d+)\/result$/);
    if (resultMatch) {
      const payload = route.request().postDataJSON();
      saves.push(payload);
      if (failFirstSave && saves.length === 1) return route.fulfill({ status: 409, json: { detail: "Pokus se změnil. Zkontrolujte provedení." } });
      const row = run.test_run_cases.find(item => item.case_attempt_id === Number(resultMatch[1]))!;
      Object.assign(row, payload); Object.assign(row.case_attempts[1], payload);
      return route.fulfill({ json: row });
    }
    const stepMatch = path.match(/test-run-case-attempts\/(\d+)\/steps\/(\d+)\/result$/);
    if (stepMatch) {
      const result = { id: 1, test_run_case_attempt_id: Number(stepMatch[1]), test_step_id: Number(stepMatch[2]), step_order: 2, ...route.request().postDataJSON(), executed_by: 1, executed_at: timestamp };
      return route.fulfill({ json: result });
    }
    return route.fulfill({ json: [] });
  });
  return { run, saves };
}

