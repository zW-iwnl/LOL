import { Archive, Edit3, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type { TestCase, TestCaseStatus, TestCaseTag, TestSuite } from "../../api/client";
import { MultiTagSelect } from "../TestCaseTags";

const statusLabels: Record<TestCaseStatus, string> = {
  draft: "Koncept",
  ready: "Připraveno",
  deprecated: "Vyřazeno",
};

export function RepositoryCasesView({
  testCases,
  suites,
  tags,
  onCreate,
  onOpen,
  onDelete,
  onMove,
  movingCaseId,
}: {
  testCases: TestCase[];
  suites: TestSuite[];
  tags: TestCaseTag[];
  onCreate: (suiteId: number | null) => void;
  onOpen: (testCase: TestCase) => void;
  onDelete: (testCase: TestCase) => void;
  onMove: (testCase: TestCase, suiteId: number) => void;
  movingCaseId: number | null;
}) {
  const [query, setQuery] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const suiteById = useMemo(
    () => new Map(suites.map((suite) => [suite.id, suite])),
    [suites],
  );
  const normalized = query.trim().toLocaleLowerCase("cs");
  const visible = testCases.filter((testCase) => {
    if (
      normalized
      && !(testCase.code + " " + testCase.title)
        .toLocaleLowerCase("cs")
        .includes(normalized)
    ) return false;
    if (suiteFilter !== "all" && testCase.suite_id !== Number(suiteFilter)) return false;
    return tagIds.every((id) => testCase.tag_ids.includes(id));
  });

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="font-semibold">Test cases</h2>
          <p className="mt-1 text-xs text-slate-500">Každý test case má právě jednu vlastnící test suitu.</p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white"
          type="button"
          onClick={() => onCreate(suiteFilter === "all" ? null : Number(suiteFilter))}
        >
          <Plus size={16} aria-hidden="true" /> Nový test case
        </button>
      </div>
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_240px_1.2fr]">
        <label className="block text-sm">
          <span className="font-medium">Hledat test case</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Kód nebo název"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Test suite</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            value={suiteFilter}
            onChange={(event) => setSuiteFilter(event.target.value)}
          >
            <option value="all">Všechny test suity</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>#{suite.id} {suite.name}</option>
            ))}
          </select>
        </label>
        <MultiTagSelect label="Tagy" values={tagIds} tags={tags} onChange={setTagIds} />
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {visible.map((testCase) => (
          <article className="rounded-md border border-slate-200 p-4" key={testCase.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-cyan-800">{testCase.code}</div>
                <h3 className="mt-1 text-sm font-medium">{testCase.title}</h3>
              </div>
              <StatusBadge status={testCase.status} />
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-medium">Vlastnící test suite</span>
              <select
                aria-busy={movingCaseId === testCase.id}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                disabled={movingCaseId === testCase.id}
                value={testCase.suite_id}
                onChange={(event) => onMove(testCase, Number(event.target.value))}
              >
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>#{suite.id} {suite.name}</option>
                ))}
              </select>
            </label>
            <TagList testCase={testCase} />
            <div className="mt-4 flex gap-2">
              <button className="min-h-11 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium" type="button" onClick={() => onOpen(testCase)}>
                Otevřít detail
              </button>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700" type="button" onClick={() => onDelete(testCase)}>
                <Archive size={16} aria-hidden="true" /> Vyřadit
              </button>
            </div>
          </article>
        ))}
        {visible.length === 0 && <EmptyState />}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Test cases odpovídající zvoleným filtrům</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3" scope="col">Kód</th>
              <th className="px-4 py-3" scope="col">Název</th>
              <th className="px-4 py-3" scope="col">Test suite</th>
              <th className="px-4 py-3" scope="col">Tagy</th>
              <th className="px-4 py-3" scope="col">Stav</th>
              <th className="px-4 py-3 text-right" scope="col">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((testCase) => (
              <tr key={testCase.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-cyan-800">{testCase.code}</td>
                <td className="px-4 py-3">{testCase.title}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Vlastnící test suite pro ${testCase.code}`}
                    aria-busy={movingCaseId === testCase.id}
                    className="max-w-[220px] rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                    disabled={movingCaseId === testCase.id}
                    value={testCase.suite_id}
                    onChange={(event) => onMove(testCase, Number(event.target.value))}
                  >
                    {suites.map((suite) => (
                      <option key={suite.id} value={suite.id}>#{suite.id} {suite.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3"><TagList testCase={testCase} compact /></td>
                <td className="px-4 py-3"><StatusBadge status={testCase.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button aria-label={`Otevřít detail ${testCase.code}`} className="grid h-11 w-11 place-items-center rounded hover:bg-slate-100" title="Otevřít detail" type="button" onClick={() => onOpen(testCase)}>
                      <Edit3 size={15} aria-hidden="true" />
                    </button>
                    <button aria-label={`Vyřadit ${testCase.code}`} className="grid h-11 w-11 place-items-center rounded text-rose-700 hover:bg-rose-50" title="Vyřadit" type="button" onClick={() => onDelete(testCase)}>
                      <Archive size={15} aria-hidden="true" />
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

function StatusBadge({ status }: { status: TestCaseStatus }) {
  const className = status === "ready"
    ? "bg-emerald-50 text-emerald-700"
    : status === "deprecated"
      ? "bg-slate-100 text-slate-600"
      : "bg-amber-50 text-amber-800";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{statusLabels[status]}</span>;
}

function TagList({ testCase, compact = false }: { testCase: TestCase; compact?: boolean }) {
  if (testCase.tags.length === 0) {
    return compact ? <span className="text-xs text-slate-500">Bez tagů</span> : null;
  }
  return (
    <div className={`${compact ? "" : "mt-3 "}flex flex-wrap gap-1`}>
      {testCase.tags.map((tag) => (
        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800" key={tag.id}>{tag.name}</span>
      ))}
    </div>
  );
}

function EmptyState() {
  return <div className="p-8 text-center text-sm text-slate-500">Žádné test cases odpovídající filtrům.</div>;
}
