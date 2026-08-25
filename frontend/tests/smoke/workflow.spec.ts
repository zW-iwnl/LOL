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


test("main QA workflow is navigable", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);

  await page.getByRole("link", { name: /repository/i }).click();
  await expect(page.getByRole("heading", { name: "Repository", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /nový test case/i })).toBeVisible();

  await page.getByRole("link", { name: /test runs/i }).click();
  await expect(page.getByRole("heading", { name: /test runs/i })).toBeVisible();
  await page.getByRole("button", { name: /nový test run/i }).click();
  await expect(page.getByRole("heading", { name: /nový test run/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /1\. nastavení/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /2\. test cases/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /3\. přiřazení/i })).toBeVisible();
  await page.getByRole("button", { name: /zavřít/i }).click();

  assertClean();
});

test("test run wizard validates required workflow steps", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);
  await page.getByRole("link", { name: /test runs/i }).click();

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


test("repository search finds a test case and suite", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);
  const headerSearch = page.getByPlaceholder("Hledat test case nebo suite");
  await headerSearch.fill("ESHOP-TC-001");
  await headerSearch.press("Enter");
  await expect(page).toHaveURL(/\/test-cases\?q=ESHOP-TC-001/);

  const repositorySearch = page.getByLabel("Hledat v repository");
  await expect(repositorySearch).toHaveValue("ESHOP-TC-001");
  const testCaseResult = page.getByRole("button", { name: /ESHOP-TC-001.*Přihlášení platného uživatele/i });
  await expect(testCaseResult).toBeVisible();
  await testCaseResult.click();
  await expect(page).toHaveURL(/\/test-cases\?.*suite=\d+/);
  await expect(page).not.toHaveURL(/\/test-cases\/\d+/);
  await expect(page.getByRole("heading", { name: "Přihlášení platného uživatele", exact: true })).toBeVisible();

  await page.getByRole("link", { name: /repository/i }).click();
  await page.getByLabel("Hledat v repository").fill("Checkout");
  const suiteResult = page.getByRole("button", { name: /^Checkout\b/i });
  await expect(suiteResult).toBeVisible();
  await suiteResult.click();
  await expect(page).toHaveURL(/\/test-cases\?.*suite=\d+/);

  assertClean();
});

test("repository workspace combines folders, tree and mind map", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);

  await page.getByRole("link", { name: /repository/i }).click();
  await page.getByRole("button", { name: "Složky", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test cases", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test suity", exact: true })).toBeVisible();
  await expect(page.getByLabel("Řadit test cases podle")).toBeVisible();
  await expect(page.getByRole("group", { name: "Hustota řádků" })).toBeVisible();

  await page.getByRole("button", { name: "Myšlenková mapa", exact: true }).click();
  await expect(page).toHaveURL(/view=mind-map/);
  await expect(page.getByLabel("Myšlenková mapa Repository")).toBeVisible();

  await page.getByRole("button", { name: "Strom", exact: true }).click();
  await expect(page).toHaveURL(/view=tree/);
  await expect(page.getByRole("tree", { name: "Strom test suit" })).toBeVisible();
  await expect(page.getByTestId("repository-outline")).toBeVisible();
  await expect(page.getByTestId("repository-tree-content")).toBeVisible();

  await page.goto("/test-suites");
  await page.getByRole("button", { name: "Složky", exact: true }).click();
  await expect(page).toHaveURL(/view=folders/);
  await expect(page.getByRole("navigation", { name: "Cesta test suity" })).toBeVisible();

  assertClean();
});
