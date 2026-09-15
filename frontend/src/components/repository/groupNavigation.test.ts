import { describe, expect, it } from "vitest";
import type { RepositoryGroup } from "../../api/repositoryWorkspace";
import { createGroupIndex, matchingGroups, relatedGroupIds, revealGroup, validatePlacement, visibleGroupRows } from "./groupNavigation";
function group(id: number): RepositoryGroup { return { id, name: `Skupina ${id}`, description: null, sort_order: id, parent_ids: [], child_ids: [], child_relations: [], suite_count: 0, direct_case_count: 0, tags: [] }; }
function edge(groups: RepositoryGroup[], parent: number, child: number, include = true) {
  groups[parent - 1].child_ids.push(child); groups[parent - 1].child_relations.push({ parent_group_id: parent, child_group_id: child, include_descendants: include, sort_order: 0, created_at: "", updated_at: "" }); groups[child - 1].parent_ids.push(parent);
}
describe("repository navigation", () => {
  it("does not enumerate exponential paths through a closed diamond DAG", () => {
    const groups = Array.from({ length: 1000 }, (_, i) => group(i + 1));
    for (let i = 1; i < 999; i += 2) for (const parent of [i, i + 1]) for (const child of [i + 2, i + 3]) edge(groups, parent, child);
    const index = createGroupIndex(groups);
    expect(visibleGroupRows(index, new Set())).toHaveLength(2);
    expect(visibleGroupRows(index, new Set(["1"]))).toHaveLength(4);
    expect(revealGroup(index, 1000).path).toHaveLength(500);
    expect(matchingGroups(groups, "1000").map(g => g.id)).toEqual([1000]);
  });
  it("retains edge scope and reveals descendants through an expanding alternate path", () => {
    const groups = [1, 2, 3, 4].map(group);
    edge(groups, 1, 3, false); edge(groups, 2, 3); edge(groups, 3, 4);
    const index = createGroupIndex(groups);
    expect(validatePlacement(index, 3, [1, 3]).includeDescendants).toBe(false);
    expect(validatePlacement(index, 4, [1, 3, 4]).path).toEqual([4]);
    expect(revealGroup(index, 4).path).toEqual([2, 3, 4]);
    expect(visibleGroupRows(index, new Set(["1", "1.3"])).some(row => row.groupId === 4)).toBe(false);
    expect(relatedGroupIds(index, 4, "parents")).toEqual(new Set([1, 2, 3, 4]));
  });
  it("finds shared groups once by Czech name, id and inherited tags", () => {
    const groups = [1, 2, 3].map(group); edge(groups, 1, 3); edge(groups, 2, 3);
    groups[2].name = "PŘÍLIŠ žluťoučký";
    groups[2].tags = [{ id: 1, name: "Převody", category: "business_area", test_case_count: 2 }];
    expect(matchingGroups(groups, "prilis prevody").map(g => g.id)).toEqual([3]);
  });
});
