import type { SuiteGroup } from "../../api/client";

export type GroupPathRow = {
  group: SuiteGroup;
  depth: number;
  pathKey: string;
  pathLabel: string;
};

function compareGroups(left: SuiteGroup, right: SuiteGroup) {
  return (
    left.sort_order - right.sort_order
    || left.name.localeCompare(right.name, "cs")
    || left.id - right.id
  );
}

export function groupPathRows(groups: SuiteGroup[]): GroupPathRow[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const roots = groups
    .filter((group) => !group.parent_ids.some((id) => byId.has(id)))
    .sort(compareGroups);
  const rows: GroupPathRow[] = [];
  const represented = new Set<number>();

  function visit(group: SuiteGroup, path: SuiteGroup[]) {
    if (path.some((item) => item.id === group.id)) return;
    const nextPath = [...path, group];
    represented.add(group.id);
    rows.push({
      group,
      depth: path.length,
      pathKey: nextPath.map((item) => item.id).join("-"),
      pathLabel: nextPath.map((item) => item.name).join(" › "),
    });
    group.child_ids
      .map((id) => byId.get(id))
      .filter((item): item is SuiteGroup => item !== undefined)
      .sort(compareGroups)
      .forEach((child) => visit(child, nextPath));
  }

  roots.forEach((root) => visit(root, []));
  groups
    .filter((group) => !represented.has(group.id))
    .sort(compareGroups)
    .forEach((group) => visit(group, []));
  return rows;
}

export function reachableGroupIds(
  groups: SuiteGroup[],
  startGroupId: number,
): Set<number> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const reachable = new Set<number>();
  const pending = [...(byId.get(startGroupId)?.child_ids ?? [])];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    pending.push(...(byId.get(current)?.child_ids ?? []));
  }
  return reachable;
}

export function wouldCreateGroupCycle(
  groups: SuiteGroup[],
  parentGroupId: number,
  childGroupId: number,
): boolean {
  return (
    parentGroupId === childGroupId
    || reachableGroupIds(groups, childGroupId).has(parentGroupId)
  );
}
