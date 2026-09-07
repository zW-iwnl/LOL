import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SuiteGroup, TestSuite } from "../../api/client";

export function RepositorySuitesView({
  suites,
  groups,
  selectedSuiteId,
  onCreate,
  onEdit,
  onDelete,
}: {
  suites: TestSuite[];
  groups: SuiteGroup[];
  selectedSuiteId: number | null;
  onCreate: () => void;
  onEdit: (suite: TestSuite) => void;
  onDelete: (suite: TestSuite) => void;
}) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  useEffect(() => {
    if (selectedSuiteId !== null) {
      setQuery(String(selectedSuiteId));
      setGroupFilter("all");
    }
  }, [selectedSuiteId]);
  const normalized = query.trim().toLocaleLowerCase("cs");
  const visible = suites.filter((suite) => {
    const matchesText = (
      !normalized
      || suite.name.toLocaleLowerCase("cs").includes(normalized)
      || String(suite.id) === normalized
    );
    if (!matchesText) return false;
    if (groupFilter === "all") return true;
    if (groupFilter === "none") return suite.group_ids.length === 0;
    return suite.group_ids.includes(Number(groupFilter));
  });

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="font-semibold">Ploché test suity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Organizační strukturu tvoří skupiny, nikoliv nadřazené suity.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white"
          type="button"
          onClick={onCreate}
        >
          <Plus size={16} aria-hidden="true" /> Nová test suite
        </button>
      </div>
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Hledat test suitu</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Název nebo ID"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Skupina</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="all">Všechny skupiny</option>
            <option value="none">Bez skupiny</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>#{group.id} {group.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {visible.map((suite) => (
          <article className="rounded-md border border-slate-200 p-4" key={suite.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">#{suite.id} {suite.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{suite.description || "Bez popisu"}</p>
              </div>
              <span className={suite.is_active ? "text-xs font-medium text-emerald-700" : "text-xs text-slate-500"}>
                {suite.is_active ? "Aktivní" : "Neaktivní"}
              </span>
            </div>
            <GroupChips groupIds={suite.group_ids} groupById={groupById} />
            <p className="mt-3 text-sm text-slate-600">{suite.test_case_count} test cases</p>
            <div className="mt-4 flex gap-2">
              <button className="min-h-11 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium" type="button" onClick={() => onEdit(suite)}>Upravit</button>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700" type="button" onClick={() => onDelete(suite)}>
                <Trash2 size={16} aria-hidden="true" /> Smazat
              </button>
            </div>
          </article>
        ))}
        {visible.length === 0 && <EmptyState />}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Test suity odpovídající zvoleným filtrům</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3" scope="col">Test suite</th>
              <th className="px-4 py-3" scope="col">Skupiny</th>
              <th className="px-4 py-3" scope="col">Test cases</th>
              <th className="px-4 py-3" scope="col">Stav</th>
              <th className="px-4 py-3 text-right" scope="col">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((suite) => (
              <tr key={suite.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium">#{suite.id} {suite.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{suite.description || "Bez popisu"}</div>
                </td>
                <td className="px-4 py-3"><GroupChips groupIds={suite.group_ids} groupById={groupById} compact /></td>
                <td className="px-4 py-3">{suite.test_case_count}</td>
                <td className="px-4 py-3">
                  <span className={suite.is_active ? "text-emerald-700" : "text-slate-500"}>
                    {suite.is_active ? "Aktivní" : "Neaktivní"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button aria-label={`Upravit test suitu ${suite.name}`} className="grid h-11 w-11 place-items-center rounded hover:bg-slate-100" title="Upravit" type="button" onClick={() => onEdit(suite)}>
                      <Edit3 size={15} aria-hidden="true" />
                    </button>
                    <button aria-label={`Smazat test suitu ${suite.name}`} className="grid h-11 w-11 place-items-center rounded text-rose-700 hover:bg-rose-50" title="Smazat" type="button" onClick={() => onDelete(suite)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <EmptyState />}
      </div>
    </section>
  );
}

function GroupChips({ groupIds, groupById, compact = false }: {
  groupIds: number[];
  groupById: Map<number, SuiteGroup>;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "" : "mt-3 "}flex flex-wrap gap-1`}>
      {groupIds.map((id) => (
        <span className="rounded bg-violet-50 px-2 py-1 text-xs text-violet-800" key={id}>
          {groupById.get(id)?.name ?? `#${id}`}
        </span>
      ))}
      {groupIds.length === 0 && <span className="text-sm text-slate-500">Bez skupiny</span>}
    </div>
  );
}

function EmptyState() {
  return <div className="p-8 text-center text-sm text-slate-500">Žádné test suity odpovídající filtrům.</div>;
}
