import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ChevronsDown, ChevronsUp, FolderPlus, RefreshCw } from "lucide-react";
import { SuiteViewSwitcher } from "../test-suites/SuiteViewSwitcher";
import type { SuiteViewMode } from "../test-suites/useSuiteViewState";
import { RepositoryFoldersView } from "./RepositoryFoldersView";
import { RepositoryNestedView } from "./RepositoryNestedView";
import { RepositoryGroupsView } from "./RepositoryGroupsView";
import type { SuiteGroup, TestCaseTag } from "../../api/client";
import type { RepositoryViewProps } from "./repositoryTypes";
import {
  readRepositoryExpansion,
  repositoryExpansionStorageKey,
  storeRepositoryExpansion,
} from "./repositoryViewState";

const RepositoryMindMapView = lazy(() => import("./RepositoryMindMapView"));

type RepositoryWorkspaceProps = Omit<RepositoryViewProps, "collapsedIds" | "rootCollapsed" | "onToggleCollapsed" | "onToggleRootCollapsed"> & {
  view: SuiteViewMode;
  preview: ReactNode | null;
  onViewChange: (view: SuiteViewMode) => void;
  groups: SuiteGroup[];
  tags: TestCaseTag[];
  onGroupsChanged: () => void | Promise<void>;
};

export function RepositoryWorkspace({
  view,
  preview,
  onViewChange,
  groups,
  tags,
  onGroupsChanged,
  ...viewProps
}: RepositoryWorkspaceProps) {
  const expansionKey = repositoryExpansionStorageKey(view);
  const initialExpansion = readRepositoryExpansion(expansionKey);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(
    () => new Set(initialExpansion.collapsedIds),
  );
  const [rootCollapsed, setRootCollapsed] = useState(initialExpansion.rootCollapsed);

  useEffect(() => {
    const stored = readRepositoryExpansion(expansionKey);
    setCollapsedIds(new Set(stored.collapsedIds));
    setRootCollapsed(stored.rootCollapsed);
  }, [expansionKey]);

  function persistExpansion(nextCollapsedIds: ReadonlySet<number>, nextRootCollapsed: boolean) {
    storeRepositoryExpansion(expansionKey, {
      collapsedIds: [...nextCollapsedIds],
      rootCollapsed: nextRootCollapsed,
    });
  }

  function toggleCollapsed(suiteId: number) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(suiteId)) next.delete(suiteId);
      else next.add(suiteId);
      persistExpansion(next, rootCollapsed);
      return next;
    });
  }

  const commonProps: RepositoryViewProps = {
    ...viewProps,
    collapsedIds,
    rootCollapsed,
    onToggleCollapsed: toggleCollapsed,
    onToggleRootCollapsed: () => {
      setRootCollapsed((current) => {
        const next = !current;
        persistExpansion(collapsedIds, next);
        return next;
      });
    },
  };

  return (
    <section id="repository-workspace" className="relative overflow-hidden rounded-md border border-slate-200 bg-white lg:flex lg:h-[calc(100dvh-6rem)] lg:min-h-[560px] lg:flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-semibold">Suity a test cases</h2>
          <p className="mt-1 text-xs text-slate-500">Navigace a obsah v jedné pracovní ploše</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SuiteViewSwitcher value={view} onChange={onViewChange} />
          {view !== "mind-map" && (
            <>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Sbalit všechny suity"
                type="button"
                onClick={() => {
                  const nextCollapsedIds = new Set(view === "groups" ? groups.map((group) => group.id) : [...viewProps.model.suiteIndex.byId.keys()]);
                  const nextRootCollapsed = view === "tree";
                  setCollapsedIds(nextCollapsedIds);
                  setRootCollapsed(nextRootCollapsed);
                  persistExpansion(nextCollapsedIds, nextRootCollapsed);
                }}
              >
                <ChevronsUp size={16} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                title="Rozbalit všechny suity"
                type="button"
                onClick={() => {
                  const nextCollapsedIds = new Set<number>();
                  setCollapsedIds(nextCollapsedIds);
                  setRootCollapsed(false);
                  persistExpansion(nextCollapsedIds, false);
                }}
              >
                <ChevronsDown size={16} />
              </button>
            </>
          )}
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={() => viewProps.onCreateSuite(viewProps.selected)}
          >
            <FolderPlus size={16} /> Nová suita
          </button>
        </div>
      </div>

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain" data-repository-scroll>
        {view === "folders" && <RepositoryFoldersView {...commonProps} />}
        {view === "tree" && <RepositoryNestedView {...commonProps} />}
        {view === "groups" && <RepositoryGroupsView {...commonProps} groups={groups} tags={tags} onGroupsChanged={onGroupsChanged} />}
        {view === "mind-map" && (
          <Suspense fallback={<div className="grid h-[680px] place-items-center text-sm text-slate-500"><RefreshCw className="animate-spin" size={18} /> Načítám myšlenkovou mapu...</div>}>
            <RepositoryMindMapView {...commonProps} />
          </Suspense>
        )}
      </div>

      {preview && (
        <div className="absolute inset-y-0 right-0 z-30 w-full overflow-auto border-l border-slate-200 bg-white shadow-2xl sm:max-w-xl">
          {preview}
        </div>
      )}
    </section>
  );
}
