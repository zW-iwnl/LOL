import { type Page } from "@playwright/test";
export async function mockRepository(page: Page, failAdd = false) {
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

