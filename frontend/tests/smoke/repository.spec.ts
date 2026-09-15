import { expect, test } from "@playwright/test";
import { mockRepository } from "./fixtures/repository";

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
