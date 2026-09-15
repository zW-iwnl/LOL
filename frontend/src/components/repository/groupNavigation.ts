import type { RepositoryGroup } from "../../api/repositoryWorkspace";
import { normalizeSearch } from "../test-runs/selection";

export type GroupPlacement = { groupId: number; path: number[]; includeDescendants: boolean };
export type GroupRow = GroupPlacement & { group: RepositoryGroup; key: string; depth: number; expandable: boolean };
export function createGroupIndex(groups: RepositoryGroup[]) {
  const byId = new Map(groups.map(group => [group.id, group]));
  const ordered = [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "cs") || a.id - b.id);
  const roots = ordered.filter(group => !group.parent_ids.some(id => byId.has(id)));
  const represented = new Set<number>();
  const expanded = new Set<number>();
  function visit(start: number) {
    const pending = [{ id: start, expand: true }];
    while (pending.length) {
      const { id, expand } = pending.pop()!;
      represented.add(id);
      if (!expand || expanded.has(id)) continue;
      expanded.add(id);
      byId.get(id)?.child_relations.forEach(edge => pending.push({ id: edge.child_group_id, expand: edge.include_descendants }));
    }
  }
  roots.forEach(root => visit(root.id));
  for (const group of ordered) {
    if (!represented.has(group.id) || (group.child_ids.length && !expanded.has(group.id))) { roots.push(group); visit(group.id); }
  }
  return { byId, ordered, roots };
}
export type GroupIndex = ReturnType<typeof createGroupIndex>;

export function validatePlacement(index: GroupIndex, groupId: number, path: number[]): GroupPlacement {
  let expand = true;
  const valid = path.length > 0 && path.at(-1) === groupId && new Set(path).size === path.length && path.every((id, i) => {
    if (!index.byId.has(id)) return false;
    if (i === 0) return true;
    if (!expand) return false;
    const edge = index.byId.get(path[i - 1])?.child_relations.find(edge => edge.child_group_id === id);
    expand = edge?.include_descendants ?? true;
    return Boolean(edge);
  });
  return { groupId, path: valid ? path : [groupId], includeDescendants: valid ? expand : true };
}

// Traverse only open placements. A closed diamond never expands into all paths.
export function visibleGroupRows(index: GroupIndex, expanded: Set<string>): GroupRow[] {
  const rows: GroupRow[] = [];
  const pending = index.roots.slice().reverse().map(group => ({ id: group.id, path: [group.id], expand: true }));
  while (pending.length) {
    const current = pending.pop()!;
    const group = index.byId.get(current.id);
    if (!group) continue;
    const key = current.path.join(".");
    const expandable = current.expand && group.child_relations.length > 0;
    rows.push({ group, groupId: group.id, path: current.path, includeDescendants: current.expand, key, depth: current.path.length - 1, expandable });
    if (!expandable || !expanded.has(key)) continue;
    for (const edge of group.child_relations.slice().reverse()) {
      if (!current.path.includes(edge.child_group_id)) pending.push({ id: edge.child_group_id, path: [...current.path, edge.child_group_id], expand: edge.include_descendants });
    }
  }
  return rows;
}

// Find one navigable placement in O(groups + edges); never enumerate all paths.
export function revealGroup(index: GroupIndex, targetId: number): GroupPlacement {
  const queue = index.roots.map(group => group.id);
  const previous = new Map<number, { parent: number | null; expand: boolean }>(queue.map(id => [id, { parent: null, expand: true }]));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === targetId) break;
    if (!previous.get(id)?.expand) continue;
    for (const edge of index.byId.get(id)?.child_relations ?? []) {
      if (!previous.has(edge.child_group_id) || (!previous.get(edge.child_group_id)!.expand && edge.include_descendants)) {
        previous.set(edge.child_group_id, { parent: id, expand: edge.include_descendants });
        queue.push(edge.child_group_id);
      }
    }
  }
  const path: number[] = [];
  let current: number | null = targetId;
  while (current !== null && !path.includes(current)) { path.unshift(current); current = previous.get(current)?.parent ?? null; }
  return validatePlacement(index, targetId, path);
}
export function matchingGroups(groups: RepositoryGroup[], query: string) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return groups.filter(group => {
    const text = normalizeSearch(`${group.id} ${group.name} ${group.tags.map(tag => tag.name).join(" ")}`);
    return words.every(word => text.includes(word));
  });
}
export function relatedGroupIds(index: GroupIndex, id: number, direction: "parents" | "children") {
  const found = new Set<number>([id]); const pending = [id];
  while (pending.length) {
    const group = index.byId.get(pending.pop()!);
    for (const next of (direction === "parents" ? group?.parent_ids : group?.child_ids) ?? []) {
      if (!found.has(next)) { found.add(next); pending.push(next); }
    }
  }
  return found;
}
