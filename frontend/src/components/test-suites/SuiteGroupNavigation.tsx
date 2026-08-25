import { ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { SuiteGroup, TestSuite } from "../../api/client";
import { buildSuiteGroupIndex, getSuitesForGroup, getUngroupedSuites } from "./suiteGroups";
import type { SuiteSelection } from "./suiteTree";

type GroupSelection = "all" | "ungrouped" | number;

export function SuiteGroupNavigation({
  groups,
  suites,
  selected,
  query,
  onSelect,
}: {
  groups: SuiteGroup[];
  suites: TestSuite[];
  selected: SuiteSelection;
  query: string;
  onSelect: (selection: SuiteSelection) => void;
}) {
  const [groupSelection, setGroupSelection] = useState<GroupSelection>("all");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const index = useMemo(() => buildSuiteGroupIndex(groups), [groups]);
  const selectedGroup = typeof groupSelection === "number" ? index.byId.get(groupSelection) ?? null : null;
  const visibleSuites = groupSelection === "all"
    ? suites
    : groupSelection === "ungrouped"
      ? getUngroupedSuites(groups, suites)
      : selectedGroup
        ? getSuitesForGroup(selectedGroup, suites)
        : [];
  const needle = query.trim().toLocaleLowerCase("cs");
  const filteredSuites = needle.length < 2
    ? visibleSuites
    : visibleSuites.filter((suite) => (suite.name + " " + suite.path).toLocaleLowerCase("cs").includes(needle));

  function toggle(groupId: number) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }

  return (
    <div className="grid min-h-80 md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-50/60 p-3 md:border-b-0 md:border-r" aria-label="Strom skupin suit">
        <NavigationButton label="Všechny suity" count={suites.length} active={groupSelection === "all"} onClick={() => setGroupSelection("all")} />
        <NavigationButton label="Bez skupiny" count={getUngroupedSuites(groups, suites).length} active={groupSelection === "ungrouped"} onClick={() => setGroupSelection("ungrouped")} />
        <div className="mt-2 border-t border-slate-200 pt-2">
          {index.roots.map((group) => (
            <GroupNode key={group.id} group={group} depth={0} index={index} selected={groupSelection} collapsedIds={collapsedIds} onSelect={setGroupSelection} onToggle={toggle} />
          ))}
        </div>
      </aside>
      <main className="p-4">
        <div className="mb-3 flex items-center gap-2"><Layers3 className="text-cyan-700" size={18} /><h3 className="font-semibold">{groupSelection === "all" ? "Všechny suity" : groupSelection === "ungrouped" ? "Bez skupiny" : selectedGroup?.name}</h3><span className="text-xs text-slate-500">{filteredSuites.length}</span></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSuites.map((suite) => (
            <button aria-pressed={selected === suite.id} className={selected === suite.id ? "rounded-md border border-cyan-300 bg-cyan-50 p-3 text-left" : "rounded-md border border-slate-200 p-3 text-left hover:border-cyan-200 hover:bg-slate-50"} key={suite.id} type="button" onClick={() => onSelect(suite.id)}>
              <span className="block truncate font-medium">{suite.name}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">{suite.path} · {suite.direct_test_case_count} test cases</span>
            </button>
          ))}
        </div>
        {filteredSuites.length === 0 && <p className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">V tomto pohledu nejsou žádné suity.</p>}
      </main>
    </div>
  );
}

function NavigationButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button aria-pressed={active} className={active ? "mb-1 flex w-full justify-between rounded bg-cyan-50 px-3 py-2 text-left text-sm font-medium text-cyan-800" : "mb-1 flex w-full justify-between rounded px-3 py-2 text-left text-sm hover:bg-white"} type="button" onClick={onClick}><span>{label}</span><span className="text-xs text-slate-500">{count}</span></button>;
}

function GroupNode({ group, depth, index, selected, collapsedIds, onSelect, onToggle }: { group: SuiteGroup; depth: number; index: ReturnType<typeof buildSuiteGroupIndex>; selected: GroupSelection; collapsedIds: ReadonlySet<number>; onSelect: (selection: GroupSelection) => void; onToggle: (groupId: number) => void }) {
  const children = index.childrenByParentId.get(group.id) ?? [];
  const collapsed = collapsedIds.has(group.id);
  return <div><div className={selected === group.id ? "flex rounded bg-cyan-50 text-cyan-800" : "flex rounded hover:bg-white"} style={{ paddingLeft: depth * 12 }}><button className="grid h-8 w-8 place-items-center" disabled={children.length === 0} type="button" onClick={() => onToggle(group.id)}>{children.length > 0 ? collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} /> : null}</button><button className="min-w-0 flex-1 truncate py-2 pr-2 text-left text-sm" type="button" onClick={() => onSelect(group.id)}>{group.name} <span className="text-xs text-slate-400">({group.members.length})</span></button></div>{!collapsed && children.map((child) => <GroupNode key={child.id} group={child} depth={depth + 1} index={index} selected={selected} collapsedIds={collapsedIds} onSelect={onSelect} onToggle={onToggle} />)}</div>;
}
