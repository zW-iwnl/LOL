import { expect, test, type Page } from "@playwright/test";

const email = process.env.TEST_MANAGER_EMAIL ?? "admin@testmanager.cz";
const password = process.env.TEST_MANAGER_PASSWORD ?? "admin123";

async function assertNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, errors.join("\n")).toEqual([]);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/heslo|password/i).fill(password);
  await page.getByRole("button", { name: /přihlásit|login/i }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Test Manager")).toBeVisible();
}

async function selectFirstProjectIfAvailable(page: Page) {
  const projectSelect = page.getByLabel("Projekt").first();
  if (!(await projectSelect.isVisible().catch(() => false))) {
    return;
  }
  const optionCount = await projectSelect.locator("option").count();
  if (optionCount > 0) {
    await projectSelect.selectOption({ index: 0 });
  }
}

test("main QA workflow is navigable", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);

  await page.getByRole("link", { name: /projekty/i }).click();
  await expect(page.getByRole("heading", { name: /projekty/i })).toBeVisible();

  await page.getByRole("link", { name: /repository/i }).click();
  await expect(page.getByRole("heading", { name: "Repository", exact: true }).first()).toBeVisible();
  await selectFirstProjectIfAvailable(page);
  await expect(page.getByRole("button", { name: /nový test case/i })).toBeVisible();

  await page.getByRole("link", { name: /test runs/i }).click();
  await expect(page.getByRole("heading", { name: /test runs/i })).toBeVisible();
  await selectFirstProjectIfAvailable(page);
  await page.getByRole("button", { name: /nový test run/i }).click();
  await expect(page.getByRole("heading", { name: /nový test run/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /1\. nastavení/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /2\. test cases/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /3\. přiřazení/i })).toBeVisible();
  await page.getByRole("button", { name: /zavřít/i }).click();

  await page.getByRole("link", { name: /defecty/i }).click();
  await expect(page.getByRole("heading", { name: /defecty/i })).toBeVisible();
  await selectFirstProjectIfAvailable(page);
  await expect(page.getByRole("button", { name: /nový defect/i })).toBeVisible();

  assertClean();
});

test("test run wizard validates required workflow steps", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);
  await page.getByRole("link", { name: /test runs/i }).click();
  await selectFirstProjectIfAvailable(page);

  await page.getByRole("button", { name: /nový test run/i }).click();
  await page.getByRole("button", { name: /pokračovat/i }).click();
  await expect(page.getByText(/název test runu je povinný/i)).toBeVisible();

  await page.getByLabel(/název test runu/i).fill(`Smoke run ${Date.now()}`);
  await page.getByRole("button", { name: /pokračovat/i }).click();
  await expect(page.getByRole("button", { name: /2\. test cases/i })).toHaveClass(/text-cyan-700/);

  await page.getByRole("button", { name: /pokračovat/i }).click();
  await expect(page.getByText(/vyber alespoň jeden test case/i)).toBeVisible();

  assertClean();
});
