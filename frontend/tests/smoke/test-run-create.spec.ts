import { expect, test, type Page } from "@playwright/test";

const user = { id: 1, name: "Testovací uživatel", email: "tester@example.cz", role: "admin", is_active: true };
const cases = [
  { id: 1, code: "TC-1", title: "Přihlášení", suite_id: 1, version_id: 10, tags: ["Účty"], exclusion_reason: null },
  { id: 2, code: "TC-2", title: "Návrh", suite_id: 1, version_id: null, tags: ["Účty"], exclusion_reason: "Chybí schválená verze" },
];
const catalog = {
  cases, suites: [{ id: 1, name: "Přístupy", case_ids: [1, 2] }],
  groups: [{ id: 1, name: "Regrese", case_ids: [1, 2], own_case_ids: [1, 2], suite_ids: [1], children: [] }],
};

async function mockApi(page: Page, rejectFirstCreate = false) {
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
    await route.fulfill({ json });
  });
  return requests;
}

test("creates from inline form using tag search and overlapping group and suite", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/test-runs");
  await page.getByRole("button", { name: "Nový test run", exact: true }).click();
  const panel = page.getByRole("region", { name: "Nový test run", exact: true });
  await expect(panel).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel).toHaveCSS("position", "static");
  await panel.getByLabel("Název úkolu", { exact: false }).fill("Regrese plateb");
  await panel.getByLabel("Číslo úkolu").fill("QA-123");
  await panel.getByLabel("Termín", { exact: true }).fill("2026-10-01T14:00");
  await panel.getByLabel("Popis", { exact: true }).fill("Ověření vydání");
  await panel.getByRole("searchbox").fill("ucty");
  await panel.getByRole("checkbox", { name: /Regrese.*Dostupné testy/ }).check();
  await panel.getByRole("tab", { name: "Test suity", exact: true }).click();
  await panel.getByRole("checkbox", { name: /Přístupy.*Dostupné testy/ }).check();
  await panel.getByRole("searchbox").fill("nenalezeno");
  await expect(panel.getByText("Žádná položka neodpovídá hledání.")).toBeVisible();
  await expect(panel.getByText(/Unikátní schválené testy: 1/)).toBeVisible();
  await panel.getByRole("button", { name: "Odebrat Skupina: Regrese", exact: true }).click();
  await expect(panel.getByText(/Unikátní schválené testy: 1/)).toBeVisible();
  await panel.getByRole("searchbox").fill("");
  await expect(panel.getByRole("checkbox", { name: /Přístupy.*Dostupné testy/ })).toBeChecked();
  await panel.getByText("Další nastavení", { exact: true }).click();
  await panel.getByLabel("Tester", { exact: true }).selectOption("1");
  await page.screenshot({ path: test.info().outputPath("test-run-form.png"), fullPage: true });
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByText("Test run „Regrese plateb“ byl vytvořen.", { exact: false })).toBeVisible();
  await expect(page.getByRole("row", { name: /Regrese plateb/ })).toHaveClass(/bg-cyan-50/);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ name: "Regrese plateb", task_number: "QA-123", assigned_to: 1,
    selection: { groups: [], suite_ids: [1], test_case_ids: [] }, selection_fingerprint: "a".repeat(64) });
});

test("deep link opens inline form and preserves input after stale preview", async ({ page }) => {
  const requests = await mockApi(page, true);
  await page.goto("/test-runs?new=1");
  const panel = page.getByRole("region", { name: "Nový test run", exact: true });
  await panel.getByLabel("Název úkolu", { exact: false }).fill("Zachovat údaje");
  await panel.getByRole("checkbox", { name: /Regrese.*Dostupné testy/ }).check();
  await expect(panel.getByText(/Unikátní schválené testy: 1/)).toBeVisible();
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Obnovte náhled");
  await expect(panel.getByLabel("Název úkolu", { exact: false })).toHaveValue("Zachovat údaje");
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  expect(requests).toHaveLength(1);
  await panel.getByRole("button", { name: "Obnovit nabídku a náhled", exact: true }).click();
  await expect(panel.getByText(/Unikátní schválené testy: 1/)).toBeVisible();
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

test("validates inline and confirms discarding entered data", async ({ page }) => {
  await mockApi(page);
  await page.goto("/test-runs?new=1");
  const panel = page.getByRole("region", { name: "Nový test run", exact: true });
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText("Název úkolu je povinný.");
  await panel.getByLabel("Název úkolu", { exact: false }).fill("Rozepsaný run");
  await expect(panel.getByText(/Unikátní schválené testy: 0/)).toBeVisible();
  await panel.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText("Vyberte alespoň jeden schválený test case.");
  await panel.getByRole("button", { name: "Zrušit", exact: true }).click();
  await panel.getByRole("button", { name: "Pokračovat v úpravách", exact: true }).click();
  await expect(panel.getByLabel("Název úkolu", { exact: false })).toHaveValue("Rozepsaný run");
  await panel.getByRole("button", { name: "Zrušit", exact: true }).click();
  await panel.getByRole("button", { name: "Zahodit změny", exact: true }).click();
  await expect(panel).toHaveCount(0);
});
