import { expect, test } from "@playwright/test";
import { mockReviews } from "./fixtures/approval-workspace";

test("large approval queue stays compact and uses lazy detail", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { requests } = await mockReviews(page, 1000);
  await page.goto("/test-case-approvals");
  await expect(page.getByRole("heading", { name: "RV-0001 · verze 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Schválit a publikovat", exact: true })).toBeInViewport();
  expect(await page.getByRole("complementary", { name: "Schvalovací fronta" }).getByRole("listitem").count()).toBeLessThan(20);
  expect(requests.some(url => url.startsWith("/api/test-case-draft-summaries"))).toBeFalsy();
  await page.getByRole("searchbox", { name: "Kód nebo název" }).fill("RV-1000");
  await page.getByRole("complementary", { name: "Schvalovací fronta" }).getByRole("button", { name: /RV-1000/ }).click();
  await expect(page.getByRole("heading", { name: "RV-1000 · verze 2" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("approval-notebook.png") });
});

test("approve and next preserves filtered queue and prevents duplicate decisions", async ({ page }) => {
  const { writes } = await mockReviews(page);
  await page.goto("/test-case-approvals?limit=25");
  await page.getByRole("button", { name: "Schválit a další", exact: true }).dblclick();
  await expect(page.getByRole("heading", { name: "RV-0002 · verze 2" })).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(page).toHaveURL(/limit=25/);
  await expect(page.getByText("122 položek", { exact: true })).toBeVisible();
});

test("failed decision retains reason and does not leave the selected review", async ({ page }) => {
  const { writes } = await mockReviews(page, 10, true);
  await page.goto("/test-case-approvals/1");
  await page.getByRole("button", { name: "Vrátit k dopracování", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Vrátit k dopracování" });
  await dialog.getByLabel("Důvod rozhodnutí").fill("Doplňte očekávání.");
  await dialog.getByRole("button", { name: "Potvrdit rozhodnutí" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Žádost byla změněna");
  await expect(dialog.getByLabel("Důvod rozhodnutí")).toHaveValue("Doplňte očekávání.");
  await expect(page).toHaveURL(/approvals\/1/);
  expect(writes).toHaveLength(1);
});

test("comments attach to readable step changes and survive switching reviews", async ({ page }) => {
  await mockReviews(page, 2);
  await page.goto("/test-case-approvals/1");
  await expect(page.getByText("Staré očekávání", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Připomínkovat" }).click();
  await page.getByLabel("Připomínka", { exact: true }).fill("Rozepsaná poznámka");
  await page.getByRole("complementary", { name: "Schvalovací fronta" }).getByRole("button", { name: /RV-0002/ }).click();
  await expect(page.getByRole("heading", { name: "RV-0002 · verze 2" })).toBeVisible();
  await page.getByRole("tab", { name: /Připomínky/ }).click();
  await expect(page.getByLabel("Připomínka", { exact: true })).toHaveValue("");
  await page.getByRole("complementary", { name: "Schvalovací fronta" }).getByRole("button", { name: /RV-0001/ }).click();
  await expect(page.getByRole("heading", { name: "RV-0001 · verze 2" })).toBeVisible();
  await expect(page.getByLabel("Připomínka", { exact: true })).toHaveValue("Rozepsaná poznámka");
  await page.getByRole("button", { name: "Přidat připomínku", exact: true }).click();
  await expect(page.getByLabel("Připomínka", { exact: true })).toHaveValue("");
  await expect(page.getByText("Rozepsaná poznámka", { exact: true })).toBeVisible();
});

test("mobile switches between list and review without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await mockReviews(page, 10);
  await page.goto("/test-case-approvals");
  await page.getByRole("complementary", { name: "Schvalovací fronta" }).getByRole("button", { name: /RV-0001/ }).click();
  await expect(page.getByRole("heading", { name: "RV-0001 · verze 2" })).toBeVisible();
  await page.getByRole("button", { name: "Zpět na seznam" }).click();
  await expect(page.getByRole("complementary", { name: "Schvalovací fronta" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
