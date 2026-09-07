import { describe, expect, it } from "vitest";

import type { SuiteGroup } from "../../api/client";
import { groupPathRows, reachableGroupIds, wouldCreateGroupCycle } from "./groupGraph";

function group(id: number, childIds: number[] = []): SuiteGroup {
  return {
    id,
    name: `Group ${id}`,
    description: null,
    sort_order: 0,
    parent_ids: [],
    child_ids: childIds,
    created_at: "",
    updated_at: "",
    members: [],
    test_case_members: [],
    tags: [],
  };
}

describe("groupGraph", () => {
  it("deduplicates nodes reachable through a diamond", () => {
    const groups = [
      group(1, [2, 3]),
      group(2, [4]),
      group(3, [4]),
      group(4),
    ];

    expect([...reachableGroupIds(groups, 1)].sort()).toEqual([2, 3, 4]);
  });

  it("rejects self edges and indirect cycles", () => {
    const groups = [
      group(1, [2]),
      group(2, [3]),
      group(3),
    ];

    expect(wouldCreateGroupCycle(groups, 1, 1)).toBe(true);
    expect(wouldCreateGroupCycle(groups, 3, 1)).toBe(true);
    expect(wouldCreateGroupCycle(groups, 1, 3)).toBe(false);
  });

  it("terminates defensively even when supplied graph already contains a cycle", () => {
    const groups = [
      group(1, [2]),
      group(2, [1]),
    ];

    expect([...reachableGroupIds(groups, 1)].sort()).toEqual([1, 2]);
  });


  it("renders a group once for every parent path in a DAG", () => {
    const groups = [
      { ...group(1, [3]), name: "A" },
      { ...group(2, [3]), name: "B" },
      { ...group(3), name: "C", parent_ids: [1, 2] },
    ];

    expect(groupPathRows(groups).map((row) => row.pathLabel)).toEqual([
      "A",
      "A › C",
      "B",
      "B › C",
    ]);
  });
});
