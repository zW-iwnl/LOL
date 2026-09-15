import { type Page } from "@playwright/test";
export async function mockReviews(page: Page, count = 123, failFirst = false) {
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

