import type { SuiteGroup, TestSuite } from "../../api/client";

export type SuiteGroupIndex = {
  byId: Map<number, SuiteGroup>;
  childrenByParentId: Map<number | null, SuiteGroup[]>;
  roots: SuiteGroup[];
};

const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });

export function compareSuiteGroups(left: SuiteGroup, right: SuiteGroup): number {
  return left.sort_order - right.sort_order || collator.compare(left.name, right.name) || left.id - right.id;
}

export function buildSuiteGroupIndex(groups: SuiteGroup[]): SuiteGroupIndex {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const childrenByParentId = new Map<number | null, SuiteGroup[]>();

  for (const group of groups) {
    const parentId = group.parent_group_id !== null && byId.has(group.parent_group_id)
      ? group.parent_group_id
      : null;
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(group);
    childrenByParentId.set(parentId, siblings);
  }
  for (const siblings of childrenByParentId.values()) siblings.sort(compareSuiteGroups);

  const roots = [...(childrenByParentId.get(null) ?? [])];
  const reachable = new Set<number>();
  function visit(group: SuiteGroup) {
    if (reachable.has(group.id)) return;
    reachable.add(group.id);
    for (const child of childrenByParentId.get(group.id) ?? []) visit(child);
  }
  roots.forEach(visit);
  for (const group of [...groups].sort(compareSuiteGroups)) {
    if (!reachable.has(group.id)) {
      roots.push(group);
      visit(group);
    }
  }
  return { byId, childrenByParentId, roots };
}

export function getSuiteGroupDescendantIds(index: SuiteGroupIndex, groupId: number): Set<number> {
  const descendants = new Set<number>();
  const pending = [...(index.childrenByParentId.get(groupId) ?? [])];
  while (pending.length > 0) {
    const group = pending.pop();
    if (!group || descendants.has(group.id)) continue;
    descendants.add(group.id);
    pending.push(...(index.childrenByParentId.get(group.id) ?? []));
  }
  return descendants;
}

export function getSuitesForGroup(group: SuiteGroup, suites: TestSuite[]): TestSuite[] {
  const byId = new Map(suites.map((suite) => [suite.id, suite]));
  return [...group.members]
    .sort((left, right) => left.sort_order - right.sort_order || left.suite_id - right.suite_id)
    .map((member) => byId.get(member.suite_id))
    .filter((suite): suite is TestSuite => Boolean(suite));
}

export function getUngroupedSuites(groups: SuiteGroup[], suites: TestSuite[]): TestSuite[] {
  const groupedIds = new Set(groups.flatMap((group) => group.members.map((member) => member.suite_id)));
  return suites.filter((suite) => !groupedIds.has(suite.id));
}
