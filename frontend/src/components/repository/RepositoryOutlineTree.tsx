import { NestedTreeView } from "../test-suites/NestedTreeView";
import type { SuiteSelection } from "../test-suites/suiteTree";
import type { RepositoryWorkspaceModel } from "./repositoryModel";

export function RepositoryOutlineTree({
  model,
  collapsedIds,
  rootCollapsed = false,
  selected,
  query,
  favoriteSuiteIds,
  toggleOnSuiteSelect = false,
  onSelect,
  onToggleCollapsed,
  onToggleRootCollapsed,
  onToggleFavorite,
}: {
  model: RepositoryWorkspaceModel;
  collapsedIds: ReadonlySet<number>;
  rootCollapsed?: boolean;
  selected: SuiteSelection;
  query: string;
  favoriteSuiteIds: number[];
  toggleOnSuiteSelect?: boolean;
  onSelect: (selection: SuiteSelection) => void;
  onToggleCollapsed: (suiteId: number) => void;
  onToggleRootCollapsed?: () => void;
  onToggleFavorite: (suiteId: number) => void;
}) {
  const favoriteSuites = favoriteSuiteIds
    .map((id) => model.suiteIndex.byId.get(id))
    .filter((suite) => suite !== undefined);
  const collapsibleSuiteIds = new Set<number>();
  for (const [suiteId, count] of model.directCaseCountBySuiteId) {
    if (suiteId !== null && count > 0) collapsibleSuiteIds.add(suiteId);
  }

  return (
    <aside
      className="flex flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r"
      data-testid="repository-outline"
    >
      {favoriteSuites.length > 0 && (
        <div className="border-b border-slate-200 p-2">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Oblíbené</div>
          {favoriteSuites.map((suite) => (
            <button
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              key={suite.id}
              type="button"
              onClick={() => onSelect(suite.id)}
            >
              <span className="truncate">{suite.path}</span>
              <span className="ml-2 text-slate-400">{suite.total_test_case_count}</span>
            </button>
          ))}
        </div>
      )}
      <NestedTreeView
        index={model.suiteIndex}
        collapsedIds={collapsedIds}
        rootCollapsed={rootCollapsed}
        selected={selected}
        query={query}
        rootDirectTestCaseCount={model.directCaseCountBySuiteId.get(null) ?? 0}
        favoriteSuiteIds={favoriteSuiteIds}
        collapsibleSuiteIds={collapsibleSuiteIds}
        toggleOnSuiteSelect={toggleOnSuiteSelect}
        respectCollapsedDuringSearch
        className="flex-1"
        onSelect={onSelect}
        onToggleCollapsed={onToggleCollapsed}
        onToggleRootCollapsed={onToggleRootCollapsed}
        onToggleFavorite={onToggleFavorite}
      />
    </aside>
  );
}
