import { describe, expect, it } from "vitest";

import type { SuiteGroup, TestSuite } from "../../api/client";
import {
  buildSuiteGroupIndex,
  getSuiteGroupDescendantIds,
  getSuitesForGroup,
  getUngroupedSuites,
} from "./suiteGroups";

const member = (groupId: number, suiteId: number, sortOrder: number) => ({
  group_id: groupId,
  suite_id: suiteId,
  sort_order: sortOrder,
  created_at: "",
  updated_at: "",
});

const group = (id: number, name: string, parentGroupId: number | null, members: SuiteGroup["members"] = []): SuiteGroup => ({
  id,
  parent_group_id: parentGroupId,
  name,
  description: null,
  sort_order: id,
  created_at: "",
  updated_at: "",
  members,
  test_case_members: [],
});

const suite = (id: number): TestSuite => ({
  id,
  parent_suite_id: null,
  name: `Suite ${id}`,
  description: null,
  path: `/Suite ${id}`,
  level: 0,
  sort_order: 0,
  is_active: true,
  created_by: 1,
  created_at: "",
  updated_at: "",
  direct_test_case_count: 0,
  total_test_case_count: 0,
  group_ids: [],
});

describe("suite groups", () => {
  it("builds a multi-level group index and finds descendants", () => {
    const index = buildSuiteGroupIndex([
      group(3, "Grandchild", 2),
      group(1, "Root", null),
      group(2, "Child", 1),
    ]);
    expect(index.roots.map((item) => item.id)).toEqual([1]);
    expect(index.childrenByParentId.get(1)?.map((item) => item.id)).toEqual([2]);
    expect([...getSuiteGroupDescendantIds(index, 1)]).toEqual(expect.arrayContaining([2, 3]));
  });

  it("keeps membership order and finds suites without any group", () => {
    const suites = [suite(1), suite(2), suite(3)];
    const groups = [group(10, "Smoke", null, [member(10, 2, 0), member(10, 1, 2)])];
    expect(getSuitesForGroup(groups[0], suites).map((item) => item.id)).toEqual([2, 1]);
    expect(getUngroupedSuites(groups, suites).map((item) => item.id)).toEqual([3]);
  });
});
