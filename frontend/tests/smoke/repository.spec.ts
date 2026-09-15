import { expect, test, type Page } from "@playwright/test";
async function mockRepository(page: Page, failAdd = false) {
  const requests: string[] = [];
  const groups = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: `Skupina ${String(i + 1).padStart(4, "0")}`, description: null, sort_order: i, parent_ids: [] as number[], child_ids: [] as number[], child_relations: [] as { child_group_id: number; include_descendants: boolean }[], suite_count: 0, direct_case_count: 0, tags: [] }));
  groups[0].child_ids = [3]; groups[0].child_relations = [{ child_group_id: 3, include_descendants: false }];
  groups[1].child_ids = [3]; groups[1].child_relations = [{ child_group_id: 3, include_descendants: true }];
  groups[2].parent_ids = [1, 2]; groups[2].child_ids = [4]; groups[2].child_relations = [{ child_group_id: 4, include_descendants: true }]; groups[3].parent_ids = [3];
  const suites = [{ id: 1, name: "Přihlášení", description: "Přístupy uživatelů", is_active: true, group_ids: [1], test_case_count: 123, tags: [] }];
  const cases = Array.from({ length: 123 }, (_, i) => ({ id: i + 1, code: `RP-${String(i + 1).padStart(3, "0")}`, title: `Ověření uživatele ${i + 1}`, suite_id: 1, suite_name: "Přihlášení", status: "draft", automated: false, tags: [], origins: [{ group_id: 1, group_name: groups[0].name, suite_id: 1, suite_name: suites[0].name }] }));
  await page.addInitScript(() => localStorage.setItem("test-manager-token", "repository-test-token"));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    requests.push(path + url.search);
    if (path === "/api/auth/me") return route.fulfill({ json: { id: 1, name: "Tester", role: "admin", email: "tester@example.cz", is_active: true } });
    if (path === "/api/test-suites") return route.fulfill({ json: suites });
    if (path === "/api/repository/groups") return route.fulfill({ json: { groups, test_case_count: cases.length } });
    if (path === "/api/repository/cases") {
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 50), q = url.searchParams.get("q") ?? "";
      const items = cases.filter(item => `${item.code} ${item.title}`.includes(q));
      return route.fulfill({ json: { items: items.slice(offset, offset + limit), total: items.length, scope_total: cases.length, offset, limit } });
    }
    if (path === "/api/repository/search") return route.fulfill({ json: { items: [{ type: "test_suite", ...suites[0], label: suites[0].name }] } });
    const detail = path.match(/^\/api\/suite-groups\/(\d+)$/);
    if (detail) {
      const group = groups[Number(detail[1]) - 1];
      if (route.request().method() === "PUT") Object.assign(group, route.request().postDataJSON());
      return route.fulfill({ json: { ...group, members: [{ suite_id: 1 }], test_case_members: [] } });
    }
    const add = path.match(/^\/api\/suite-groups\/(\d+)\/children$/);
    if (add) {
      if (failAdd) { failAdd = false; return route.fulfill({ status: 409, json: { detail: "Vazbu se nepodařilo uložit." } }); }
      const group = groups[Number(add[1]) - 1], payload = route.request().postDataJSON();
      group.child_ids.push(payload.child_group_id); group.child_relations.push(payload); groups[payload.child_group_id - 1].parent_ids.push(group.id);
      return route.fulfill({ json: payload });
    }
    const caseDetail = path.match(/^\/api\/test-cases\/(\d+)$/);
    if (caseDetail) return route.fulfill({ json: { ...cases[Number(caseDetail[1]) - 1], steps: [{ id: 1, step_order: 1, action: "Otevřít přihlášení", expected_result: "Formulář", step_type: "test" }] } });
    return route.fulfill({ json: [] });
  });
  return { requests };
}

test("1000 groups stay virtual, searchable and compact on a notebook", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  const { requests } = await mockRepository(page);
  await page.goto("/test-cases");
  const nav = page.getByRole("complementary", { name: "Struktura skupin" });
  await expect(nav.getByText(/1000 skupin/)).toBeVisible();
  expect(await nav.getByRole("listitem").count()).toBeLessThan(40);
  await nav.getByRole("searchbox", { name: "Hledat skupinu", exact: true }).fill("1000");
  await nav.getByRole("button", { name: "Skupina 1000", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Skupina 1000", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Test suity/ }).click();
  await expect(page.getByRole("heading", { name: "Přihlášení", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Skupiny/ }).click();
  await expect(nav.getByRole("searchbox", { name: "Hledat skupinu", exact: true })).toHaveValue("1000");
  await nav.getByRole("button", { name: "Ukázat vybranou ve struktuře" }).click();
  await expect(nav.getByRole("button", { name: "Skupina 1000", exact: true })).toBeInViewport();
  expect(await nav.getByRole("listitem").count()).toBeLessThan(40);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(requests.some(path => /^\/api\/test-cases(?:\?|$)/.test(path))).toBeFalsy();
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("repository-notebook.png") });
});

test("a stopped placement keeps its scope and case content is paginated and lazy", async ({ page }) => {
  const { requests } = await mockRepository(page);
  await page.goto("/test-cases?group=3&groupPath=1.3");
  await expect(page.getByText("Toto umístění je bez dalších potomků.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Všechny testy v rozsahu", exact: true }).click();
  await expect.poll(() => requests.some(path => path.includes("include_descendants=false") && !path.includes("direct_only=true"))).toBeTruthy();
  await page.getByRole("button", { name: "Otevřít celou skupinu" }).click();
  await expect(page.getByText("Toto umístění je bez dalších potomků.", { exact: false })).toHaveCount(0);
  await page.getByRole("tab", { name: /Test cases/ }).click();
  await expect(page.getByRole("button", { name: /^RP-001/ })).toBeVisible();
  expect(requests.some(path => path === "/api/test-cases/1")).toBeFalsy();
  await page.getByRole("button", { name: /^RP-001/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Otevřít přihlášení", { exact: true })).toBeVisible();
  expect(requests).toContain("/api/test-cases/1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Další stránka testů" }).click();
  await expect(page.getByRole("button", { name: /^RP-051/ })).toBeVisible();
  await page.getByRole("button", { name: "Další stránka testů" }).click();
  await expect(page.getByRole("button", { name: /^RP-101/ })).toBeVisible();
  await expect(page.getByText("Zobrazeno 101–123 z 123", { exact: false })).toBeVisible();
});

test("relation picker retains failed selection and metadata survives tab switching", async ({ page }) => {
  const { requests } = await mockRepository(page, true);
  await page.goto("/test-cases?group=1");
  await page.getByRole("button", { name: "Vazby", exact: true }).click();
  await page.getByRole("button", { name: "+ Přidat vazbu", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Přidat vazbu" });
  await dialog.getByRole("searchbox").fill("1000");
  await dialog.getByRole("button", { name: "#1000 Skupina 1000" }).click();
  await dialog.getByRole("button", { name: "Přidat vazbu", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Vazbu se nepodařilo uložit.");
  await expect(dialog.getByRole("button", { name: "#1000 Skupina 1000" })).toHaveAttribute("aria-pressed", "true");
  const suitesBefore = requests.filter(path => path === "/api/test-suites").length;
  await dialog.getByRole("button", { name: "Přidat vazbu", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("table").first().getByRole("button", { name: "Skupina 1000" })).toBeVisible();
  expect(requests.filter(path => path === "/api/test-suites")).toHaveLength(suitesBefore);
  await page.getByRole("button", { name: "Podrobnosti", exact: true }).click();
  await page.getByRole("textbox", { name: "Název skupiny", exact: true }).fill("Rozepsaná skupina");
  await page.getByRole("button", { name: "Obsah", exact: true }).click();
  await page.getByRole("button", { name: "Podrobnosti", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Název skupiny", exact: true })).toHaveValue("Rozepsaná skupina");
});

test("mobile panels and inline case editor remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockRepository(page);
  await page.goto("/test-cases");
  await expect(page.getByRole("complementary", { name: "Struktura skupin" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole("tab", { name: /Test cases/ }).click();
  await page.getByRole("button", { name: /Nový test case/ }).click();
  const editor = page.locator("#test-case-create-editor");
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Zrušit", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Test cases/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("global finder keeps its query after opening a suite and closes results", async ({ page }) => {
  await mockRepository(page);
  await page.goto("/test-cases?q=prihlaseni");
  const results = page.locator(".repository-search-results");
  await expect(results.getByRole("button", { name: /^Přihlášení/ })).toBeVisible();
  await results.getByRole("button", { name: /^Přihlášení/ }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Přihlášení", exact: true })).toBeVisible();
  await expect(page.getByLabel("Hledat v repository", { exact: true })).toHaveValue("prihlaseni");
  await page.getByRole("button", { name: "Filtry", exact: true }).click();
  await expect(page.getByRole("group", { name: "Business oblast", exact: true })).toBeVisible();
});
