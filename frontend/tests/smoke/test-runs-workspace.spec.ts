import { expect, test, type Page } from "@playwright/test";
import { mockApi as mockExecution } from "./fixtures/execution";
import { resultSummary } from "../../src/components/test-runs/model";
import type { TestRun, TestRunCaseListItem } from "../../src/api/testRuns";

async function mockWorkspace(page: Page) {
  await mockExecution(page);
  const cases: TestRunCaseListItem[] = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, test_run_id: 99, test_case_id: i + 1, code: `TC-${i + 1}`, title: i === 0 ? "Přihlášení uživatele" : `Historický test ${i + 1}`, assigned_to: 1, result: i === 0 ? "passed" : "not_run", has_history: i === 1 }));
  const run = { id: 99, name: "Regrese plateb", task_number: "QA-123", environment: "CUSTOM", version: "2.4", status: "in_progress", description: "Kontrola plateb a storna.", planned_start: null, planned_end: null, started_at: null, finished_at: null } as TestRun;
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === "/api/test-runs/page") {
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 50);
      const items = Array.from({ length: 60 }, (_, i) => ({ ...run, id: i === 50 ? 99 : i + 1, name: i === 50 ? run.name : `Běh ${i + 1}`, test_run_cases: [], summary: resultSummary(i === 50 ? cases : []) }));
      const filtered = items.filter(item => (!url.searchParams.get("q") || item.name.includes(url.searchParams.get("q")!)) && (!url.searchParams.get("environment") || item.environment === url.searchParams.get("environment")));
      return route.fulfill({ json: { items: filtered.slice(offset, offset + limit), total: filtered.length, stats: { total: 60, active: 60, completed: 0, averagePassRate: 100 } } });
    }
    if (path === "/api/test-runs/99") {
      if (method === "PUT") { mutations.push("edit"); Object.assign(run, route.request().postDataJSON()); }
      if (method === "DELETE") { mutations.push("archive"); run.status = "archived"; return route.fulfill({ status: 204 }); }
      return route.fulfill({ json: { ...run, test_run_cases: [], summary: resultSummary(cases) } });
    }
    if (path === "/api/test-runs/999") return route.fulfill({ status: 404, json: { detail: "Test run neexistuje." } });
    if (path === "/api/test-runs/99/cases/page") {
      const q = url.searchParams.get("q") || "";
      const result = url.searchParams.get("result");
      const tester = url.searchParams.get("tester");
      const filtered = cases.filter(item => `${item.code} ${item.title}`.includes(q) && (!result || item.result === result) && (!tester || (tester === "unassigned" ? item.assigned_to === null : item.assigned_to === Number(tester))));
      const offset = Number(url.searchParams.get("offset") || 0);
      return route.fulfill({ json: { items: filtered.slice(offset, offset + 25), total: filtered.length } });
    }
    if (/\/api\/test-run-cases\/\d+$/.test(path)) {
      const index = cases.findIndex(item => item.id === Number(path.split("/").pop()));
      if (method === "DELETE") { mutations.push("remove"); cases.splice(index, 1); return route.fulfill({ status: 204 }); }
      mutations.push("assign"); Object.assign(cases[index], route.request().postDataJSON()); return route.fulfill({ json: cases[index] });
    }
    if (path === "/api/repository/cases") return route.fulfill({ json: { items: cases.some(item => item.id === 101) ? [] : [{ id: 101, code: "TC-101", title: "Nový test", status: "ready", published_version: 1, suite_name: "Platby" }], total: cases.some(item => item.id === 101) ? 0 : 1 } });
    if (path === "/api/test-runs/99/cases" && method === "POST") {
      mutations.push("add"); cases.push({ id: 101, test_run_id: 99, test_case_id: 101, code: "TC-101", title: "Nový test", result: "not_run", assigned_to: null }); return route.fulfill({ json: run });
    }
    return route.fallback();
  });
  return { run, cases, mutations };
}

test("independent detail, progress, pagination and return from a specific execution case", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/test-runs?run=99&environment=CUSTOM&offset=50&limit=50");
  const detail = page.getByRole("region", { name: "Detail běhu", exact: true });
  await expect(detail.getByRole("heading", { name: "Regrese plateb" })).toBeFocused();
  await expect(detail.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await expect(detail.getByText("Úspěšnost 100 % z vyhodnocených")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Seznam běhů" })).toContainText("51–60 z 60");
  await detail.getByRole("link", { name: "TC-1 · Přihlášení uživatele", exact: true }).click();
  await expect(page).toHaveURL(/execution\?case=1/);
  await page.getByRole("link", { name: "← Zpět na předchozí práci" }).click();
  await expect(detail.getByRole("heading", { name: "Regrese plateb" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filtr prostředí" })).toHaveValue("CUSTOM");
  await expect(page.getByRole("complementary", { name: "Seznam běhů" })).toContainText("51–60 z 60");
  await page.getByRole("searchbox", { name: "Hledat běh nebo číslo úkolu" }).fill("nenalezeno");
  await expect(detail.getByText(/Vybraný běh je mimo/)).toBeVisible();
  await detail.getByRole("button", { name: "Další", exact: true }).click();
  await expect(detail.getByRole("link", { name: /TC-26 ·/ })).toBeVisible();
});

test("mutations refresh detail and list, protect history and archive read-only", async ({ page }) => {
  const { mutations } = await mockWorkspace(page);
  await page.goto("/test-runs?run=99");
  const detail = page.getByRole("region", { name: "Detail běhu", exact: true });
  await detail.getByRole("combobox", { name: "Tester pro TC-3", exact: true }).selectOption("");
  await expect(detail.getByRole("combobox", { name: "Tester pro TC-3", exact: true })).toHaveValue("");
  await expect(detail.locator(".run-case-row").filter({ hasText: "Historický test 2" }).first().getByRole("button", { name: "Odebrat" })).toBeDisabled();
  page.on("dialog", dialog => dialog.accept());
  await detail.locator(".run-case-row").filter({ has: page.getByRole("link", { name: "TC-3 · Historický test 3", exact: true }) }).getByRole("button", { name: "Odebrat" }).click();
  await expect(detail.getByRole("tab", { name: "Testy (99)" })).toBeVisible();
  await detail.getByRole("button", { name: "Přidat testy", exact: true }).click();
  await detail.getByRole("checkbox", { name: /TC-101/ }).check();
  await detail.getByRole("button", { name: "Přidat do test runu (1)" }).click();
  await expect(detail.getByRole("tab", { name: "Testy (100)" })).toBeVisible();
  await detail.getByText("Akce běhu", { exact: true }).click();
  await detail.getByRole("button", { name: "Archivovat", exact: true }).click();
  await expect(detail.getByText("Archivovaný běh — pouze pro čtení.")).toBeVisible();
  await expect(detail.getByRole("link", { name: "Zobrazit výsledky" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Přidat testy", exact: true })).toHaveCount(0);
  expect(mutations).toEqual(["assign", "remove", "add", "archive"]);
});

test("editing preserves unsaved input on tab, run, browser back and app navigation", async ({ page }) => {
  const { mutations } = await mockWorkspace(page);
  await page.goto("/test-runs?offset=50&limit=50");
  await page.getByRole("button", { name: /Regrese plateb.*Vyhodnoceno/ }).click();
  await page.getByRole("tab", { name: "Údaje běhu" }).click();
  await page.getByRole("button", { name: "Upravit údaje" }).click();
  await page.getByRole("textbox", { name: "Název úkolu", exact: true }).fill("Upravený běh");
  const reject = (dialog: import("@playwright/test").Dialog) => dialog.dismiss();
  page.on("dialog", reject);
  await page.getByRole("tab", { name: /Testy/ }).click();
  await expect(page.getByRole("textbox", { name: "Název úkolu" })).toHaveValue("Upravený běh");
  await page.getByRole("button", { name: /^Běh 52 / }).click();
  await expect(page).toHaveURL(/run=99/);
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Název úkolu" })).toHaveValue("Upravený běh");
  await page.evaluate(() => history.back());
  await expect(page.getByRole("textbox", { name: "Název úkolu" })).toHaveValue("Upravený běh");
  page.off("dialog", reject);
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Upravený běh" })).toBeVisible();
  expect(mutations).toEqual(["edit"]);
});

test("missing run and failed user load keep navigation usable", async ({ page }) => {
  await mockWorkspace(page);
  await page.route("**/api/users", route => route.fulfill({ status: 500, json: { detail: "Testeři nedostupní" } }));
  await page.goto("/test-runs?run=999");
  await expect(page.getByRole("alert").filter({ hasText: "Test run neexistuje" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Běh 1 / })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Testery nelze načíst" })).toBeVisible();
});

for (const mode of ["light", "dark"] as const) {
  test(`${mode}: desktop, mobile and low window layout`, async ({ page }) => {
    await mockWorkspace(page);
    await page.emulateMedia({ colorScheme: mode });
    for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 1280, height: 500 }]) {
      await page.setViewportSize(size);
      await page.goto("/test-runs?run=99");
      await expect(page.getByRole("heading", { name: "Regrese plateb" })).toBeVisible();
      await expect(page.getByRole("link", { name: /TC-1 ·/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: test.info().outputPath(`runs-${mode}-${size.width}-${size.height}.png`), fullPage: true });
      if (size.width === 390) {
        await expect(page.getByRole("complementary", { name: "Seznam běhů" })).toBeHidden();
        await page.getByRole("button", { name: "Zpět na běhy" }).click();
        await expect(page.getByRole("complementary", { name: "Seznam běhů" })).toBeVisible();
        await expect(page.getByRole("region", { name: "Detail běhu", exact: true })).toBeHidden();
      }
    }
  });
}
