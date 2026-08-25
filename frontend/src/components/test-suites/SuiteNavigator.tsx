import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronsDown, ChevronsUp, RefreshCw, Search } from "lucide-react";
import type { SuiteGroup, TestSuite } from "../../api/client";
import { FolderView } from "./FolderView";
import { NestedTreeView } from "./NestedTreeView";
import { SuiteViewSwitcher } from "./SuiteViewSwitcher";
import { SuiteGroupNavigation } from "./SuiteGroupNavigation";
import { buildSuiteIndex, validateSuiteHierarchy, type SuiteSelection } from "./suiteTree";
import type { SuiteViewMode } from "./useSuiteViewState";

const MindMapView = lazy(() => import("./MindMapView"));

type SuiteNavigatorProps = {
  suites: TestSuite[];
  groups?: SuiteGroup[];
  selected: SuiteSelection;
  view: SuiteViewMode;
  onSelect: (selection: SuiteSelection) => void;
  onViewChange: (view: SuiteViewMode) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  showSearch?: boolean;
  rootDirectTestCaseCount?: number;
  favoriteSuiteIds?: number[];
  onToggleFavorite?: (suiteId: number) => void;
  actions?: ReactNode;
};

export function SuiteNavigator({
  suites,
  groups = [],
  selected,
  view,
  onSelect,
  onViewChange,
  query,
  onQueryChange,
  showSearch = true,
  rootDirectTestCaseCount = 0,
  favoriteSuiteIds = [],
  onToggleFavorite,
  actions,
}: SuiteNavigatorProps) {
  const [localQuery, setLocalQuery] = useState("");
  const [treeCollapsedIds, setTreeCollapsedIds] = useState<Set<number>>(new Set());
  const [mapCollapsedIds, setMapCollapsedIds] = useState<Set<number>>(new Set());
  const [mapInitialized, setMapInitialized] = useState(false);
  const effectiveQuery = query ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
  const index = useMemo(() => buildSuiteIndex(suites), [suites]);
  const issues = useMemo(() => validateSuiteHierarchy(suites), [suites]);

  useEffect(() => {
    if (mapInitialized || suites.length === 0) return;
    setMapCollapsedIds(new Set(suites.filter((suite) => suite.level >= 1).map((suite) => suite.id)));
    setMapInitialized(true);
  }, [mapInitialized, suites]);

  function toggleTreeCollapsed(suiteId: number) {
    setTreeCollapsedIds((current) => toggleId(current, suiteId));
  }

  function toggleMapCollapsed(suiteId: number) {
    setMapCollapsedIds((current) => toggleId(current, suiteId));
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showSearch && (
            <label className="relative block min-w-0 flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm"
                placeholder="Hledat suitu podle názvu nebo cesty"
                type="search"
                value={effectiveQuery}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          {!showSearch && <div className="font-semibold">Navigace v test suitách</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SuiteViewSwitcher value={view} onChange={onViewChange} />
          {view === "tree" && (
            <>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Sbalit všechny suity"
                type="button"
                onClick={() => setTreeCollapsedIds(new Set(suites.map((suite) => suite.id)))}
              >
                <ChevronsUp size={16} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Rozbalit všechny suity"
                type="button"
                onClick={() => setTreeCollapsedIds(new Set())}
              >
                <ChevronsDown size={16} />
              </button>
            </>
          )}
          {actions}
        </div>
      </div>

      {(issues.orphanIds.length > 0 || issues.cycleIds.length > 0) && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Hierarchie obsahuje nekonzistentní vazby.
          {issues.orphanIds.length > 0 ? " Chybějící parent: " + issues.orphanIds.join(", ") + "." : ""}
          {issues.cycleIds.length > 0 ? " Cyklus: " + issues.cycleIds.join(", ") + "." : ""}
        </div>
      )}

      {view === "tree" && (
        <NestedTreeView
          index={index}
          collapsedIds={treeCollapsedIds}
          selected={selected}
          query={effectiveQuery}
          rootDirectTestCaseCount={rootDirectTestCaseCount}
          favoriteSuiteIds={favoriteSuiteIds}
          onSelect={onSelect}
          onToggleCollapsed={toggleTreeCollapsed}
          onToggleFavorite={onToggleFavorite}
        />
      )}
      {view === "folders" && (
        <FolderView
          index={index}
          selected={selected}
          query={effectiveQuery}
          favoriteSuiteIds={favoriteSuiteIds}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      )}
      {view === "groups" && (
        <SuiteGroupNavigation groups={groups} suites={suites} selected={selected} query={effectiveQuery} onSelect={onSelect} />
      )}
      {view === "mind-map" && (
        <Suspense fallback={<div className="grid h-[560px] place-items-center text-sm text-slate-500"><RefreshCw className="animate-spin" size={18} /> Načítám myšlenkovou mapu...</div>}>
          <MindMapView
            index={index}
            collapsedIds={mapCollapsedIds}
            selected={selected}
            query={effectiveQuery}
            favoriteSuiteIds={favoriteSuiteIds}
            onSelect={onSelect}
            onToggleCollapsed={toggleMapCollapsed}
            onToggleFavorite={onToggleFavorite}
          />
        </Suspense>
      )}
    </section>
  );
}

function toggleId(current: Set<number>, id: number): Set<number> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
