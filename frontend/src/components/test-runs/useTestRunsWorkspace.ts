import { useEffect, useRef, useState } from "react";
import { getTestRun, getTestRunPage } from "../../api/testRuns";
import type { TestRunStatus } from "../../api/testRuns";
import { getUsers } from "../../api/client";
import { useApiResource } from "../../api/hooks";
import { useWorkspacePreference } from "../workspace/useWorkspacePreference";
import { useDebounced } from "../workspace/useDebounced";

export function useTestRunsWorkspace(runId: number | null) {
  const [query, setQuery] = useWorkspacePreference("runsQuery", "");
  const [status, setStatus] = useWorkspacePreference<TestRunStatus | "">("runsStatus", "");
  const [environment, setEnvironment] = useWorkspacePreference("runsEnvironment", "");
  const [offset, setOffset] = useWorkspacePreference("runsOffset", 0);
  const [limit, setLimit] = useWorkspacePreference("runsLimit", 50);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const search = useDebounced(query);
  const environmentSearch = useDebounced(environment);
  const list = useApiResource(() => getTestRunPage({ q: search, status, environment: environmentSearch, offset, limit }), [search, status, environmentSearch, offset, limit, revision]);
  const detail = useApiResource(() => runId ? getTestRun(runId, true) : Promise.resolve(null), [runId, revision]);
  const users = useApiResource(getUsers, [revision]);
  const run = detail.data?.id === runId ? detail.data : null;
  function refresh() { setRevision(value => value + 1); }
  useEffect(() => { if (list.data && !list.loading && offset > 0 && offset >= list.data.total) setOffset(Math.max(0, Math.ceil(list.data.total / limit) - 1) * limit); }, [list.data, list.loading, offset, limit]);
  useEffect(() => { setError(null); }, [runId]);
  async function mutate(action: () => Promise<unknown>, onSuccess?: () => void) {
    if (locked.current) return;
    locked.current = true; setSaving(true); setError(null);
    try { await action(); refresh(); onSuccess?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Změnu se nepodařilo uložit."); }
    finally { locked.current = false; setSaving(false); }
  }
  return { query, setQuery, status, setStatus, environment, setEnvironment, offset, setOffset, limit, setLimit, list, detail, run, users, revision, saving, error, refresh, mutate };
}
