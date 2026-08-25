import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type SuiteViewMode = "tree" | "folders" | "mind-map" | "groups";
export type SuiteViewPage = "repository" | "suites";

export function parseSuiteViewMode(value: string | null): SuiteViewMode | null {
  return value === "tree" || value === "folders" || value === "mind-map" || value === "groups" ? value : null;
}

function readStoredView(key: string): SuiteViewMode | null {
  try {
    return parseSuiteViewMode(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function useSuiteViewState(
  page: SuiteViewPage,
  defaultMode: SuiteViewMode,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const storageKey = "fet-suite-view:" + page;
  const urlMode = parseSuiteViewMode(searchParams.get("view"));
  const mode = useMemo(
    () => urlMode ?? (storageKey ? readStoredView(storageKey) : null) ?? defaultMode,
    [defaultMode, storageKey, urlMode],
  );

  useEffect(() => {
    if (urlMode === mode) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", mode);
      return next;
    }, { replace: true });
  }, [mode, setSearchParams, urlMode]);

  function setMode(nextMode: SuiteViewMode) {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, nextMode);
      } catch {
        // URL remains the durable fallback when storage is unavailable.
      }
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", nextMode);
      return next;
    }, { replace: true });
  }

  return [mode, setMode] as const;
}
