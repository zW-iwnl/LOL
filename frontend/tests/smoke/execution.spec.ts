import { expect, test, type Page } from "@playwright/test";

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
async function mockApi(page: Page, failFirstSave = false) {
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

test("compact notebook execution searches groups/suites and keeps controls visible", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await mockApi(page);
  await page.goto("/test-runs/99/execution");
  await expect(page.getByRole("heading", { name: "Přihlášení uživatele", exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Hledat skupinu, suitu nebo test v běhu" });
  await search.fill("prevody");
  const nav = page.getByRole("complementary", { name: "Testy v provedení" });
  await expect(nav.getByRole("button", { name: /TC-3/ })).toBeVisible();
  await expect(nav.getByRole("button", { name: /TC-1/ })).toHaveCount(0);
  await expect(page.getByText("Vybraný test je mimo aktuální filtr.", { exact: false })).toBeVisible();
  await search.fill("pristupy");
  await expect(nav.getByRole("button", { name: /TC-1/ })).toBeVisible();
  await expect(nav.getByRole("button", { name: /TC-2/ })).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Testy", exact: true }).click();
  await expect(nav.getByText("Zobrazeno 3 z 3 testů")).toBeVisible();
  const content = page.locator(".execution-content-scroll");
  await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("button", { name: "Uložit a další", exact: true })).toBeInViewport();
  await expect(search).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBeTruthy();
  await content.evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: test.info().outputPath("execution-notebook.png") });
});

test("draft survives switching and reload; save stays, save-and-next respects filter", async ({ page }) => {
  const { saves } = await mockApi(page);
  await page.goto("/test-runs/99/execution");
  await page.getByRole("button", { name: "Testy", exact: true }).click();
  await page.getByRole("group", { name: "Zvolit celkový výsledek" }).getByRole("button", { name: "Neúspěšné", exact: true }).click();
  await page.getByText("Komentář", { exact: true }).click();
  const comment = page.getByRole("textbox", { name: "Komentář k provedení" });
  await comment.pressSequentially("Podrobná poznámka bez ztráty fokusu.");
  const nav = page.getByRole("complementary", { name: "Testy v provedení" });
  await nav.getByRole("button", { name: /TC-2/ }).click();
  await nav.getByRole("button", { name: /TC-1/ }).click();
  await expect(comment).toHaveValue("Podrobná poznámka bez ztráty fokusu.");
  page.on("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(comment).toHaveValue("Podrobná poznámka bez ztráty fokusu.");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Přihlášení uživatele", exact: true })).toBeVisible();
  await expect(page.getByText("Celkový výsledek a komentář byly uloženy.")).toBeVisible();
  expect(saves[0]).toEqual({ result: "failed", comment: "Podrobná poznámka bez ztráty fokusu." });
  await page.getByRole("searchbox", { name: "Hledat skupinu, suitu nebo test v běhu" }).fill("platby");
  await page.getByRole("button", { name: "Uložit a další", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Platba kartou", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rychle úspěšné a další", exact: false }).click();
  await expect(page.getByText("Ve filtru už není další neprovedený test.")).toBeVisible();
  await page.getByRole("button", { name: "Pokračovat v celém běhu" }).click();
  await expect(page.getByRole("heading", { name: "Obnova hesla", exact: true })).toBeVisible();
});

test("step saves separately; historical attempt is read-only; failed save keeps comment", async ({ page }) => {
  const { saves } = await mockApi(page, true);
  await page.goto("/test-runs/99/execution");
  await page.getByRole("group", { name: "Vyhodnocení kroku 2", exact: true }).getByRole("button", { name: "Chyba", exact: true }).click();
  await expect(page.getByRole("group", { name: "Zvolit celkový výsledek" }).getByRole("button", { name: "Neúspěšné", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(saves).toHaveLength(0);
  await page.getByText("Komentář", { exact: true }).click();
  await page.getByRole("textbox", { name: "Komentář k provedení" }).fill("Zachovat při chybě");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Pokus se změnil");
  await expect(page.getByRole("textbox", { name: "Komentář k provedení" })).toHaveValue("Zachovat při chybě");
  await page.getByRole("combobox", { name: "Historie test case" }).selectOption("1000");
  await expect(page.getByRole("heading", { name: "Historicky: Přihlášení uživatele", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Komentář k provedení" })).toHaveValue("Historický komentář");
  await expect(page.getByRole("textbox", { name: "Komentář k provedení" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Uložit", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Historie test case" }).selectOption("1001");
  await expect(page.getByRole("textbox", { name: "Komentář k provedení" })).toHaveValue("Zachovat při chybě");
});

test("mobile execution has no horizontal overflow and can hide navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/test-runs/99/execution");
  await page.getByRole("button", { name: "Skrýt testy", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Testy v provedení" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Přihlášení uživatele", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("execution-mobile.png"), fullPage: true });
});

test("case rerun, run rerun and historical run remain accessible", async ({ page }) => {
  const { run } = await mockApi(page);
  await page.route("**/api/test-run-case-attempts/1001/reruns", async route => {
    const row = run.test_run_cases[0];
    row.case_attempts.push({ ...row.case_attempts[1], id: 1002, attempt_number: 3 });
    row.case_attempt_id = 1002;
    await route.fulfill({ json: run });
  });
  await page.route("**/api/test-runs/99/reruns", async route => {
    run.attempts.push({ ...run.attempts[0], id: 11, attempt_number: 2 });
    run.selected_attempt_id = 11;
    await route.fulfill({ json: run });
  });
  await page.route("**/api/test-runs/99/execution?attempt_id=10", async route => {
    await route.fulfill({ json: { ...run, selected_attempt_id: 10 } });
  });
  await page.goto("/test-runs/99/execution");
  await page.getByText("Akce testu", { exact: true }).click();
  await page.getByRole("button", { name: "Reset / rerun test case", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Historie test case" })).toHaveValue("1002");
  await page.getByText("Přehled a akce běhu", { exact: true }).click();
  await page.getByRole("button", { name: "Spustit rerun", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Provedení test runu" })).toHaveValue("11");
  await page.getByRole("combobox", { name: "Provedení test runu" }).selectOption("10");
  await expect(page.getByText("Historické provedení · pouze pro čtení.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rychle úspěšné a další", exact: false })).toBeDisabled();
  await page.getByText("Akce testu", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset / rerun test case", exact: true })).toBeDisabled();
});

for (const viewport of [{ width: 1024, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`large run remains searchable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { run } = await mockApi(page);
    const source = run.test_run_cases[0];
    for (let id = 4; id <= 1000; id++) {
      run.test_run_cases.push({ ...source, id, test_case_id: id, code: `TC-${id}`, title: `Rozsáhlý regresní scénář číslo ${id}` });
      run.navigation.suites[0].case_ids.push(id);
      run.navigation.groups[0].case_ids.push(id);
      run.navigation.groups[0].own_case_ids.push(id);
    }
    await page.goto("/test-runs/99/execution");
    await page.getByRole("searchbox", { name: "Hledat skupinu, suitu nebo test v běhu" }).fill("TC-1000");
    const nav = page.getByRole("complementary", { name: "Testy v provedení" });
    await expect(nav.getByRole("button", { name: /TC-1000/ })).toBeVisible();
    await expect(nav.getByText("Zobrazeno 1 z 1000 testů")).toBeVisible();
    await page.getByRole("button", { name: "Rozbalit hlavní menu" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await expect(page.getByRole("button", { name: "Uložit a další", exact: true })).toBeInViewport();
  });
}
