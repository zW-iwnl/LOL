import { expect, test, type Page } from "@playwright/test";
async function mockReviews(page: Page, count = 123, failFirst = false) {
  const requests: string[] = []; const writes: unknown[] = [];
  const user = { id: 2, name: "Reviewer", role: "reviewer", is_active: true };
  const reviews = Array.from({ length: count }, (_, i) => ({ id: i + 1, test_case_id: i + 1, code: `RV-${String(i + 1).padStart(4, "0")}`, title: `Scénář ${i + 1}`, version_number: 2, test_case_version_id: i + 2000, base_approved_version_id: 1, status: "pending", submitted_by: 1, author_name: "Autor", reviewer_id: 2, reviewer_name: "Reviewer", lock_version: 1, created_at: "2026-09-15T08:00:00Z", decision_reason: "", origin_run_id: null,
    comments: [] as { id: number; body: string; field_path: string | null; author_id: number; author_name: string; is_blocking: boolean; resolved_at: string | null }[] }));
  await page.addInitScript(() => localStorage.setItem("test-manager-token", "review-test"));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname; if (!path.startsWith("/api/")) return route.continue();
    requests.push(path + url.search);
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/users") return route.fulfill({ json: [user, { id: 1, name: "Autor", role: "admin" }] });
    if (path === "/api/test-case-reviews") {
      const q = url.searchParams.get("q") ?? "", offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 50);
      const filtered = reviews.filter(r => (!url.searchParams.get("status") || r.status === url.searchParams.get("status")) && `${r.code} ${r.title}`.includes(q));
      return route.fulfill({ json: { total: filtered.length, items: filtered.slice(offset, offset + limit), limit, offset } });
    }
    if (path === "/api/test-case-draft-summaries") return route.fulfill({ json: { items: [], total: 0 } });
    if (path === "/api/repository/groups") return route.fulfill({ json: { groups: [], test_case_count: 0 } });
    const match = path.match(/^\/api\/test-case-reviews\/(\d+)(?:\/(.*))?$/);
    if (match) {
      const review = reviews[Number(match[1]) - 1];
      if (route.request().method() !== "GET") {
        const payload = route.request().postDataJSON(); writes.push(payload);
        if (failFirst) { failFirst = false; return route.fulfill({ status: 412, json: { detail: "Žádost byla změněna. Obnovte detail." } }); }
        if (match[2] === "decisions") { review.status = payload.status; review.decision_reason = payload.reason; }
        if (match[2] === "comments") review.comments.push({ ...payload, id: 1, author_id: 2, author_name: "Reviewer", resolved_at: null });
        if (match[2] === "assignment") review.reviewer_id = 2;
        review.lock_version++;
      }
      const pending = review.status === "pending";
      return route.fulfill({ json: { ...review, base_version_number: 1, version: { change_summary: "Upřesnění kroku", content_snapshot: { title: review.title, steps: [{ step_key: "stable-key", step_order: 1, action: "Otevřít formulář", expected_result: "Nové očekávání", step_type: "test" }], tags: [] } },
        changes: [{ field: "steps.stable-key", before: { step_order: 1, action: "Otevřít formulář", expected_result: "Staré očekávání" }, after: { step_order: 1, action: "Otevřít formulář", expected_result: "Nové očekávání" } }],
        capabilities: { can_approve: pending && !review.comments.some(c => c.is_blocking && !c.resolved_at), can_decide: pending, can_claim: false, can_assign: false, can_comment: pending, can_block: true, can_withdraw: false, eligible_reviewers: [], resolvable_comment_ids: review.comments.map(c => c.id), approval_reason: null, decision_reason: null }, history: [] } });
    }
    return route.fulfill({ json: [] });
  });
  return { requests, writes };
}

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
