import { useEffect, useState } from "react";
import type { TestRunCaseResult } from "../../api/client";
import { resultLabels } from "./model";

type Draft = { result: TestRunCaseResult | null; comment: string };
function readDrafts(key: string): Record<string, Draft> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([, draft]) => draft && typeof draft.comment === "string"
      && (draft.result === null || Object.hasOwn(resultLabels, draft.result))));
  } catch { return {}; }
}

// Stored per user/run/attempt. Switching cases, routes or using browser Back
// never silently discards a comment or an unsubmitted overall result.
export function useExecutionDrafts(runId: number, userId: number) {
  const key = `execution-drafts:${userId}:${runId}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => readDrafts(key));
  function update(attemptId: number, draft: Draft | null) {
    setDrafts(current => {
      const next = { ...current };
      if (draft) next[attemptId] = draft; else delete next[attemptId];
      try {
        if (Object.keys(next).length) sessionStorage.setItem(key, JSON.stringify(next));
        else sessionStorage.removeItem(key);
      } catch { /* beforeunload still protects in-memory drafts if storage is unavailable. */ }
      return next;
    });
  }
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts]);
  return { drafts, update };
}
