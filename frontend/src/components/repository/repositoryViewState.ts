import type { SuiteViewMode } from "../test-suites/useSuiteViewState";

export type RepositoryExpansionState = {
  collapsedIds: number[];
  rootCollapsed: boolean;
};

const emptyExpansionState: RepositoryExpansionState = {
  collapsedIds: [],
  rootCollapsed: false,
};

export function repositoryExpansionStorageKey(view: SuiteViewMode): string {
  return `fet-repository-expansion:${view}`;
}

export function readRepositoryExpansion(
  key: string,
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): RepositoryExpansionState {
  if (!storage) return emptyExpansionState;

  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (!parsed || typeof parsed !== "object") return emptyExpansionState;
    const value = parsed as Partial<RepositoryExpansionState>;
    const collapsedIds = Array.isArray(value.collapsedIds)
      ? [...new Set(value.collapsedIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
      : [];
    return {
      collapsedIds,
      rootCollapsed: value.rootCollapsed === true,
    };
  } catch {
    return emptyExpansionState;
  }
}

export function storeRepositoryExpansion(
  key: string,
  state: RepositoryExpansionState,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // Stav zůstane funkční v rámci aktuální relace.
  }
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
