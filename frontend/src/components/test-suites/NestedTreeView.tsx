import { ChevronDown, ChevronRight, Folder, FolderOpen, Star } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  getVisibleSuiteRows,
  REPOSITORY_ROOT_LABEL,
  totalRootTestCaseCount,
  type SuiteIndex,
  type SuiteSelection,
} from "./suiteTree";

type NestedTreeViewProps = {
  index: SuiteIndex;
  collapsedIds: ReadonlySet<number>;
  rootCollapsed?: boolean;
  selected: SuiteSelection;
  query?: string;
  rootDirectTestCaseCount?: number;
  favoriteSuiteIds?: number[];
  collapsibleSuiteIds?: ReadonlySet<number>;
  toggleOnSuiteSelect?: boolean;
  className?: string;
  respectCollapsedDuringSearch?: boolean;
  onSelect: (selection: SuiteSelection) => void;
  onToggleCollapsed: (suiteId: number) => void;
  onToggleRootCollapsed?: () => void;
  onToggleFavorite?: (suiteId: number) => void;
};

export function NestedTreeView({
  index,
  collapsedIds,
  rootCollapsed = false,
  selected,
  query = "",
  rootDirectTestCaseCount = 0,
  favoriteSuiteIds = [],
  collapsibleSuiteIds = new Set<number>(),
  toggleOnSuiteSelect = false,
  className = "max-h-[620px] overflow-auto",
  respectCollapsedDuringSearch = false,
  onSelect,
  onToggleCollapsed,
  onToggleRootCollapsed,
  onToggleFavorite,
}: NestedTreeViewProps) {
  const rows = rootCollapsed ? [] : getVisibleSuiteRows(index, collapsedIds, query, respectCollapsedDuringSearch);
  const rootCount = totalRootTestCaseCount(index) + rootDirectTestCaseCount;
  const rootCollapsible = toggleOnSuiteSelect || index.roots.length > 0 || rootDirectTestCaseCount > 0;

  function focusSuite(container: HTMLDivElement, suiteId: number) {
    container.querySelector<HTMLButtonElement>(`[data-suite-id="${suiteId}"] [data-suite-select]`)?.focus();
  }

  function handleTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement)) return;
    const rowElement = event.target.closest<HTMLElement>("[data-suite-id]");
    const suiteId = Number(rowElement?.dataset.suiteId);
    const rowIndex = rows.findIndex((row) => row.suite.id === suiteId);
    if (rowIndex < 0) return;

    const row = rows[rowIndex];
    const collapsible = toggleOnSuiteSelect || row.hasChildren || collapsibleSuiteIds.has(suiteId);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const target = rows[Math.min(rows.length - 1, Math.max(0, rowIndex + offset))];
      focusSuite(event.currentTarget, target.suite.id);
      return;
    }

    if (event.key === "ArrowRight" && collapsible) {
      event.preventDefault();
      if (collapsedIds.has(suiteId)) {
        onToggleCollapsed(suiteId);
      } else {
        const firstChild = index.childrenByParentId.get(suiteId)?.[0];
        if (firstChild) focusSuite(event.currentTarget, firstChild.id);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (collapsible && !collapsedIds.has(suiteId)) {
        onToggleCollapsed(suiteId);
        return;
      }
      const parentId = row.suite.parent_suite_id;
      if (parentId !== null && index.byId.has(parentId)) {
        focusSuite(event.currentTarget, parentId);
        onSelect(parentId);
      }
    }
  }

  return (
    <div className={`${className} p-2`} role="tree" aria-label="Strom test suit" onKeyDown={handleTreeKeyDown}>
      <TreeShortcut
        active={selected === "root"}
        count={rootCount}
        expanded={rootCollapsible ? !rootCollapsed : undefined}
        icon={rootCollapsible ? rootCollapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} /> : <FolderOpen size={17} />}
        label={REPOSITORY_ROOT_LABEL}
        onClick={() => {
          onSelect("root");
          if (rootCollapsible) onToggleRootCollapsed?.();
        }}
      />
      {rows.map(({ suite, depth, hasChildren }) => {
        const collapsible = toggleOnSuiteSelect || hasChildren || collapsibleSuiteIds.has(suite.id);
        const expanded = collapsible && !collapsedIds.has(suite.id);
        const active = selected === suite.id;
        const favorite = favoriteSuiteIds.includes(suite.id);
        return (
          <div
            key={suite.id}
            data-suite-id={suite.id}
            aria-expanded={collapsible ? expanded : undefined}
            aria-level={depth + 2}
            aria-selected={active}
            className={[
              "mb-1 grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center rounded-md text-sm",
              active ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-50",
              suite.is_active ? "" : "opacity-60",
            ].join(" ")}
            role="treeitem"
            style={{ marginLeft: (depth + 1) * 16, width: "calc(100% - " + (depth + 1) * 16 + "px)" }}
          >
            {collapsible ? (
              <button
                aria-label={(expanded ? "Sbalit " : "Rozbalit ") + suite.name}
                className="grid h-9 place-items-center rounded hover:bg-slate-100"
                type="button"
                onClick={() => onToggleCollapsed(suite.id)}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span className="grid h-9 place-items-center text-slate-400"><Folder size={15} /></span>
            )}
            <button
              data-suite-select
              aria-label={suite.name + (collapsible ? expanded ? ", sbalit složku" : ", rozbalit složku" : "")}
              className="min-w-0 py-2 pr-2 text-left"
              type="button"
              onClick={() => {
                onSelect(suite.id);
                if (toggleOnSuiteSelect && collapsible) onToggleCollapsed(suite.id);
              }}
            >
              <span className="block truncate font-medium" title={suite.name}>{suite.name}</span>
              {!suite.is_active && <span className="block text-[11px] text-slate-500">Neaktivní</span>}
            </button>
            <span className="px-2 text-xs text-slate-500" title="Test cases včetně podsuit">{suite.total_test_case_count}</span>
            {onToggleFavorite ? (
              <button
                aria-label={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                className={favorite ? "mr-1 text-amber-500" : "mr-1 text-slate-300 hover:text-amber-500"}
                type="button"
                onClick={() => onToggleFavorite(suite.id)}
              >
                <Star fill={favorite ? "currentColor" : "none"} size={15} />
              </button>
            ) : <span />}
          </div>
        );
      })}
      {!rootCollapsed && rows.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          {query.trim().length >= 2 ? "Žádná suita neodpovídá hledání." : "Repository zatím nemá žádné test suity."}
        </div>
      )}
    </div>
  );
}

function TreeShortcut({
  active,
  count,
  expanded,
  icon,
  label,
  depth = 0,
  onClick,
}: {
  active: boolean;
  count: number;
  expanded?: boolean;
  icon: ReactNode;
  label: string;
  depth?: number;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      aria-expanded={expanded}
      className={[
        "mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
        active ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-50",
      ].join(" ")}
      role="treeitem"
      aria-level={depth + 1}
      style={{ marginLeft: depth * 16, width: "calc(100% - " + depth * 16 + "px)" }}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="text-xs text-slate-500">{count}</span>
    </button>
  );
}
