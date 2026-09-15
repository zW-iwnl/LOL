import { expect, test, type Page } from "@playwright/test";
import { mockRepository } from "./fixtures/repository";
import { mockApi as mockExecution } from "./fixtures/execution";
import { mockReviews } from "./fixtures/approval-workspace";
import { mockApi as mockCreateRun } from "./fixtures/test-run-create";
import { textContrastIssues } from "./fixtures/contrast";

const key = "fet:appearance:v1";
test.use({ colorScheme: "light" });
const theme = (mode: string, hex = "#0E7490") => ({ version: 1, mode, accent: { kind: "custom", hex } });
async function setInitialTheme(page: Page, mode: string, hex?: string) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: theme(mode, hex) });
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
  const issues = await textContrastIssues(page);
  expect(issues, `${name}: rendered text contrast`).toEqual([]);
}

test("appearance draft, validation, save, reload, reset and all users", async ({ page }) => {
  await mockRepository(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { id: 4, name: "Tester", role: "tester", is_active: true } }));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Vzhled aplikace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Role pro schvalování" })).toHaveCount(0);
  await page.getByRole("radio", { name: "Tmavý", exact: true }).check();
  await page.getByRole("radio", { name: "Vlastní", exact: true }).check();
  await page.getByLabel("HEX barva", { exact: true }).fill("#FFFF00");
  // Preview is scoped: editing a dark draft does not change the light app yet.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("HEX barva", { exact: true }).fill("#nope");
  await expect(page.getByRole("button", { name: "Uložit vzhled" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("#RRGGBB");
  await page.getByLabel("HEX barva", { exact: true }).fill("#FFFF00");
  await page.getByRole("button", { name: "Uložit vzhled" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("status")).toContainText("Vzhled byl uložen");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("HEX barva", { exact: true })).toHaveValue("#FFFF00");
  await page.getByRole("button", { name: "Obnovit výchozí" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Zrušit změny" }).click();
  await expect(page.getByLabel("HEX barva", { exact: true })).toHaveValue("#FFFF00");
  await page.getByRole("button", { name: "Obnovit výchozí" }).click();
  await page.getByRole("button", { name: "Uložit vzhled" }).click();
  await expect(page.getByRole("combobox", { name: "Režim vzhledu" })).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("system changes, explicit mode and a conflicting edit in another tab", async ({ page, context }) => {
  await mockRepository(page);
  await page.goto("/settings");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("combobox", { name: "Režim vzhledu" }).selectOption("light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Fialová", exact: true }).check();
  const other = await context.newPage();
  await mockRepository(other);
  await other.goto("/settings");
  await other.getByRole("combobox", { name: "Režim vzhledu" }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("alert")).toContainText("Váš návrh zůstal zachovaný");
  await expect(page.getByRole("radio", { name: "Fialová", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Načíst uložený vzhled" }).click();
  await expect(page.getByRole("radio", { name: "Tmavý", exact: true })).toBeChecked();
  await other.close();
});

test("theme is applied before deferred React modules load and survives logout", async ({ page }) => {
  await setInitialTheme(page, "dark", "#FF0000");
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/(?:src\/main\.tsx|assets\/index-[^/]+\.js)(?:\?|$)/, async route => { await blocked; await route.continue(); });
  try {
    await page.goto("/login", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.locator("html").evaluate(element => getComputedStyle(element).colorScheme)).toBe("dark");
    expect(await page.locator("#root").textContent()).toBe("");
  } finally { release(); }
  await expect(page.getByRole("heading", { name: "Přihlášení" })).toBeVisible();
  await mockRepository(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Odhlásit", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("storage failure still allows switching on login with an honest message", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("Storage disabled"); };
    Storage.prototype.getItem = () => { throw new Error("Storage disabled"); };
  });
  await page.goto("/login");
  await page.getByRole("combobox", { name: "Režim vzhledu" }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("status")).toContainText("uložení není dostupné");
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: dashboard, published case, draft, versions, reports, login and error states`, async ({ page }) => {
    await setInitialTheme(page, mode);
    await mockRepository(page);
    const snapshot = { id: 1, code: "TC-1", title: "Kontrola platby", suite_id: 1, version: 1, status: "ready", current_approved_version_id: 10,
      automated: false, description: "Kontrola zadání platby.", preconditions: "Aktivní účet.", expected_summary: "Platba je potvrzena.", tags: [], tag_ids: [],
      steps: [{ id: 1, step_key: "step-1", step_order: 1, action: "Zadat platbu", expected_result: "Zobrazí se potvrzení", step_type: "test", note: null, test_data: "100 Kč" }] };
    await page.route("**/api/dashboard", route => route.fulfill({ json: { stats: { test_cases_count: 123, active_test_runs_count: 4, pass_rate: 75 }, recent_test_runs: [{ id: 99, name: "Regrese plateb", status: "in_progress", environment: "TEST", total: 30, executed: 12, pass_rate: 75 }], results: ["passed", "failed", "blocked", "skipped", "not_run"].map((result, i) => ({ result, count: 5 - i })) } }));
    await page.route("**/api/test-cases/1", route => route.fulfill({ json: snapshot }));
    await page.route("**/api/test-case-drafts?*", route => route.fulfill({ json: { total: 1, items: [{ id: 1, test_case_id: 1, code: "TC-1", suite_id: 1, status: "open", editor_id: 1, lock_version: 1, contributors: [1], change_summary: "Upřesnění kontroly", content: snapshot }] } }));
    await page.route("**/api/test-case-reviews?*", route => route.fulfill({ json: { items: [], total: 0 } }));
    await page.route("**/api/test-cases/1/versions?*", route => route.fulfill({ json: { items: [{ id: 10, version_number: 1, approval_state: "approved", created_at: "2026-09-15T09:00:00Z", content_snapshot: snapshot }], total: 1 } }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Poslední test runy" })).toBeVisible();
    await screenshot(page, `dashboard-${mode}`);
    await page.goto("/test-cases/1");
    await expect(page.getByText("Platba je potvrzena.")).toBeVisible();
    await screenshot(page, `case-published-${mode}`);
    await page.getByRole("button", { name: "Návrh změny", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Název scénáře", exact: true })).toHaveValue("Kontrola platby");
    await screenshot(page, `case-draft-${mode}`);
    await page.getByRole("button", { name: "Historie verzí", exact: true }).click();
    await page.getByRole("button", { name: "Verze 1", exact: true }).click();
    await screenshot(page, `case-versions-${mode}`);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reporty" })).toBeVisible();
    await screenshot(page, `reports-${mode}`);
    await page.goto("/missing-page");
    await screenshot(page, `not-found-${mode}`);
    await page.route("**/api/repository/groups", route => route.fulfill({ status: 500, json: { detail: "Testovací chyba načtení" } }));
    await page.goto("/test-cases");
    await expect(page.getByText("Testovací chyba načtení")).toBeVisible();
    await screenshot(page, `error-${mode}`);
    await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { detail: "Přihlaste se" } }));
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Přihlášení", exact: true })).toBeVisible();
    await screenshot(page, `login-${mode}`);
  });

  test(`${mode}: settings, mobile navigation and custom palette previews`, async ({ page }) => {
    await setInitialTheme(page, mode);
    await mockRepository(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/settings");
    await expect(page.getByRole("region", { name: "Tmavý náhled" })).toBeVisible();
    await screenshot(page, `settings-${mode}`);
    await page.getByRole("radio", { name: "Vlastní", exact: true }).check();
    for (const hex of ["#FFFFFF", "#000000", "#FFFF00", "#FF0000"]) {
      await page.getByLabel("HEX barva", { exact: true }).fill(hex);
      await page.getByRole("button", { name: "Uložit vzhled" }).click();
      await expect(page.getByRole("status")).toContainText("uložen");
    }
    await screenshot(page, `settings-${mode}-red`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Otevřít hlavní navigaci" }).click();
    await expect(page.getByRole("dialog", { name: "Navigace" })).toBeVisible();
    await screenshot(page, `mobile-navigation-${mode}`);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${mode}: repository groups, suite, cases, preview and properties`, async ({ page }) => {
    await setInitialTheme(page, mode);
    await mockRepository(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/test-cases?group=1");
    await expect(page.getByRole("heading", { name: "Skupina 0001", exact: true })).toBeVisible();
    await screenshot(page, `repository-groups-${mode}`);
    await page.goto("/test-suites");
    await expect(page.getByRole("heading", { name: "Přihlášení", exact: true })).toBeVisible();
    await screenshot(page, `repository-suites-${mode}`);
    await page.getByRole("tab", { name: /Test cases/ }).click();
    await page.getByRole("button", { name: /^RP-001/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await screenshot(page, `repository-dialog-${mode}`);
    await page.keyboard.press("Escape");
    await page.goto("/test-case-properties");
    await expect(page.getByRole("heading", { name: "Vlastnosti test case", exact: true })).toBeVisible();
    await screenshot(page, `properties-${mode}`);
  });

  test(`${mode}: execution current, historical and archived states`, async ({ page }) => {
    await setInitialTheme(page, mode);
    const { run } = await mockExecution(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/test-runs/99/execution");
    await expect(page.getByRole("heading", { name: "Přihlášení uživatele", exact: true })).toBeVisible();
    await screenshot(page, `execution-${mode}`);
    await page.goto("/execution/99?caseAttempt=1000");
    await expect(page.getByText("Historické provedení", { exact: false }).first()).toBeVisible();
    await screenshot(page, `execution-history-${mode}`);
    run.status = "archived";
    await page.goto("/execution/99");
    await expect(page.getByText("Archivovaný běh", { exact: false })).toBeVisible();
    await screenshot(page, `execution-archived-${mode}`);
  });

  test(`${mode}: approvals, diff and decision dialog`, async ({ page }) => {
    await setInitialTheme(page, mode);
    await mockReviews(page, 4);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/test-case-approvals");
    await expect(page.getByRole("heading", { name: "RV-0001 · verze 2" })).toBeVisible();
    await screenshot(page, `approvals-${mode}`);
    await page.goto("/test-case-approvals/1");
    await page.getByRole("button", { name: "Vrátit k dopracování", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Vrátit k dopracování" })).toBeVisible();
    await screenshot(page, `approval-dialog-${mode}`);
  });

  test(`${mode}: run list, detail, edit and inline creation`, async ({ page }) => {
    await setInitialTheme(page, mode);
    await mockCreateRun(page);
    const run = { id: 99, name: "Regrese plateb", task_number: "QA-123", description: "Kontrola plateb a storna", environment: "TEST", version: "2.4", status: "in_progress", planned_start: null, planned_end: null,
      test_run_cases: ["passed", "failed", "blocked", "skipped", "not_run"].map((result, i) => ({ id: i + 1, test_case_id: i + 1, test_run_id: 99, code: `TC-${i + 1}`, title: "Ověření platby", result, assigned_to: 1 })) };
    await page.route("**/api/test-runs/99?*", route => route.fulfill({ json: run }));
    await page.route("**/api/test-runs/99/cases/page*", route => route.fulfill({ json: { items: run.test_run_cases, total: run.test_run_cases.length } }));
    await page.route("**/api/test-runs/page*", route => route.fulfill({ json: { items: [run], total: 1, stats: { total: 1, active: 1, completed: 0, averagePassRate: 25 } } }));
    await page.route("**/api/repository/cases*", route => route.fulfill({ json: { items: [], total: 0 } }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/test-runs");
    await expect(page.getByText("Regrese plateb", { exact: true })).toBeVisible();
    await screenshot(page, `runs-${mode}`);
    await page.getByRole("button", { name: /Regrese plateb.*Vyhodnoceno/ }).click();
    await expect(page.getByRole("heading", { name: "Regrese plateb" })).toBeVisible();
    await screenshot(page, `run-detail-${mode}`);
    await page.getByText("Akce běhu", { exact: true }).click();
    await page.getByRole("button", { name: "Upravit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Upravit test run" })).toBeVisible();
    await screenshot(page, `run-edit-${mode}`);
    await page.goto("/test-runs?new=1");
    await expect(page.getByRole("region", { name: "Nový test run", exact: true })).toBeVisible();
    await screenshot(page, `run-create-${mode}`);
  });
}
