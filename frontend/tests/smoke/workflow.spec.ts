import { expect, test, type Page } from "@playwright/test";

const email = process.env.TEST_MANAGER_EMAIL ?? "admin@testmanager.cz";
const password = process.env.TEST_MANAGER_PASSWORD ?? "admin123";

async function assertNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("response", response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${message.text()} ${message.location().url}`);
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
  await expect(page.getByRole("link", { name: /repository/i })).toBeVisible();
}


test("main QA workflow is navigable", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);

  await page.getByRole("link", { name: /repository/i }).click();
  await expect(page.getByRole("heading", { name: "Repository", exact: true }).first()).toBeVisible();
  const businessAreaFilter = page.getByRole("group", { name: "Business oblast" });
  await expect(businessAreaFilter).toBeVisible();
  await expect(page.getByRole("group", { name: "Aplikace/doména" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Objekt" })).toBeVisible();
  await businessAreaFilter.getByRole("button", { name: "Vyhledat business oblast" }).click();
  await expect(businessAreaFilter.getByRole("searchbox", { name: "Hledat v business oblast" })).toBeVisible();
  await page.getByRole("tab", { name: /Test cases/ }).click();
  await expect(page.getByRole("button", { name: /nový test case/i })).toBeVisible();

  await page.getByRole("link", { name: /test runs/i }).click();
  await expect(page.getByRole("heading", { name: /test runs/i })).toBeVisible();
  await page.getByRole("button", { name: /nový test run/i }).click();
  await expect(page.getByRole("heading", { name: /nový test run/i })).toBeVisible();
  await expect(page.getByLabel("Název úkolu", { exact: false })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Skupiny", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Test suity", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zrušit", exact: true }).click();

  assertClean();
});

test("inline test run form validates required fields and selection", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);
  await page.getByRole("link", { name: /test runs/i }).click();

  await page.getByRole("button", { name: /nový test run/i }).click();
  await page.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(page.getByText("Název úkolu je povinný.")).toBeVisible();

  await page.getByLabel(/název úkolu/i).fill(`Smoke run ${Date.now()}`);
  await expect(page.getByText(/Unikátní schválené testy: 0/)).toBeVisible();

  await page.getByRole("button", { name: "Vytvořit test run", exact: true }).click();
  await expect(page.getByText("Vyberte alespoň jeden schválený test case.")).toBeVisible();

  assertClean();
});


test("repository search opens the matching case and reveals the matching suite", async ({ page }) => {
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
  await expect(page).toHaveURL(/\/test-cases\/\d+/);
  await expect(page.getByRole("heading", { name: /Přihlášení platného uživatele/ })).toBeVisible();

  await page.getByRole("link", { name: "Repository", exact: true }).click();
  await page.getByLabel("Hledat v repository").fill("Checkout");
  await page.getByRole("button", { name: "Suity", exact: true }).click();
  const suiteResult = page.getByRole("button", { name: /^Checkout\b/i });
  await expect(suiteResult).toBeVisible();
  await suiteResult.click();
  await expect(page).toHaveURL(/tab=suites/);
  await expect(page).toHaveURL(/suite=\d+/);
  await expect(page.getByLabel("Hledat test suitu")).toHaveValue(/\d+/);

  assertClean();
});

test("repository group workspace, dialog and mobile navigation are operable", async ({ page }) => {
  const assertClean = await assertNoConsoleErrors(page);
  await login(page);
  await page.getByRole("link", { name: /repository/i }).click();

  await expect(page.getByRole("tab", { name: /Skupiny/ })).toHaveAttribute("aria-selected", "true");
  const groupNavigation = page.getByRole("navigation", { name: "Hierarchie skupin" });
  await expect(groupNavigation).toBeVisible();
  await groupNavigation.getByRole("button").first().click();
  await expect(
    page.getByRole("checkbox", { name: "Zahrnout podskupiny přidávané skupiny" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Test suity/ }).click();
  await expect(page.getByRole("heading", { name: "Ploché test suity" })).toBeVisible();
  await page.getByRole("button", { name: "Nová test suite" }).click();
  await expect(page.getByRole("dialog", { name: "Nová test suite" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: /Test cases/ }).click();
  await page.getByRole("button", { name: "Nový test case" }).click();
  const caseEditor = page.locator("#test-case-create-editor");
  await expect(caseEditor).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Nový test case" })).toHaveCount(0);
  await expect(caseEditor.getByLabel(/Akce kroku 1/)).toBeVisible();
  await caseEditor.getByRole("button", { name: "Přidat krok" }).click();
  await expect(caseEditor.getByLabel(/Akce kroku 2/)).toBeVisible();
  await caseEditor.getByRole("button", { name: "Zrušit" }).click();
  await expect(caseEditor).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Otevřít hlavní navigaci" })).toBeVisible();
  await page.getByRole("button", { name: "Otevřít hlavní navigaci" }).click();
  await expect(page.getByRole("dialog", { name: "Navigace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odhlásit se" })).toBeVisible();

  assertClean();
});
