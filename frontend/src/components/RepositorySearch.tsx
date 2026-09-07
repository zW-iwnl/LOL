import { FileCheck2, Folder, Layers3, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  searchRepository,
  type RepositorySearchItem,
  type RepositorySearchType,
} from "../api/repositorySearch";

type RepositorySearchProps = {
  query: string;
  type: RepositorySearchType;
  businessAreaIds?: number[];
  applicationDomainIds?: number[];
  objectTypeIds?: number[];
  filterControls?: ReactNode;
  onQueryChange: (query: string) => void;
  onTypeChange: (type: RepositorySearchType) => void;
  onSelectSuite: (suiteId: number) => void;
  onSelectGroup: (groupId: number) => void;
  onSelectTestCase: (testCaseId: number, suiteId: number | null) => void;
};

const typeOptions: Array<{ value: RepositorySearchType; label: string }> = [
  { value: "all", label: "Vše" },
  { value: "suites", label: "Suity" },
  { value: "groups", label: "Skupiny" },
  { value: "cases", label: "Test cases" },
];

export function RepositorySearch({
  query,
  type,
  businessAreaIds = [],
  applicationDomainIds = [],
  objectTypeIds = [],
  filterControls,
  onQueryChange,
  onSelectGroup,
  onTypeChange,
  onSelectSuite,
  onSelectTestCase,
}: RepositorySearchProps) {
  const [items, setItems] = useState<RepositorySearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const normalizedQuery = query.trim();
  const hasTagFilter = businessAreaIds.length + applicationDomainIds.length + objectTypeIds.length > 0;
  const active = normalizedQuery.length >= 2 || hasTagFilter;

  useEffect(() => {
    const currentRequestId = ++requestId.current;
    if (!active) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timeoutId = window.setTimeout(() => {
      searchRepository({
        query: normalizedQuery || undefined,
        type,
        limit: 20,
        businessAreaIds,
        applicationDomainIds,
        objectTypeIds,
      })
        .then((response) => {
          if (requestId.current === currentRequestId) setItems(response.items);
        })
        .catch((searchError: unknown) => {
          if (requestId.current !== currentRequestId) return;
          setItems([]);
          setError(searchError instanceof Error ? searchError.message : "Vyhledávání se nepodařilo.");
        })
        .finally(() => {
          if (requestId.current === currentRequestId) setLoading(false);
        });
    }, 275);

    return () => window.clearTimeout(timeoutId);
  }, [
    active,
    applicationDomainIds.join(","),
    businessAreaIds.join(","),
    normalizedQuery,
    objectTypeIds.join(","),
    type,
  ]);

  return (
    <>
      <div className="border-b border-slate-200 p-4">
        <div>
          <h2 className="font-semibold text-slate-900">Vyhledávání a filtry</h2>
          <p className="mt-1 text-xs text-slate-500">Suity i skupiny automaticky zahrnují tagy svých test casů.</p>
        </div>

        <div className={filterControls
          ? "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_repeat(3,minmax(160px,1fr))]"
          : "mt-4"}
        >
          <label className="block text-sm">
            <span className="font-medium">Vyhledat</span>
            <span className="relative mt-1 block">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={16} aria-hidden="true" />
              <input
                aria-label="Hledat v repository"
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Suita, skupina, tag, kód nebo název test case"
              />
              {query && (
                <button
                  aria-label="Vymazat hledání"
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                  onClick={() => onQueryChange("")}
                  title="Vymazat hledání"
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </span>
          </label>
          {filterControls}
        </div>

        <div aria-label="Typ výsledků hledání" className="mt-3 flex flex-wrap items-center gap-1" role="group">
          <span className="mr-1 text-xs font-medium text-slate-500">Hledat v:</span>
          {typeOptions.map((option) => (
            <button
              aria-pressed={type === option.value}
              key={option.value}
              className={type === option.value
                ? "rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700"
                : "rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"}
              onClick={() => onTypeChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {normalizedQuery.length === 1 && (
          <div className="mt-2 text-xs text-slate-500">Zadejte alespoň 2 znaky.</div>
        )}
      </div>

      {active && (
        <div className="max-h-[420px] overflow-y-auto border-t border-slate-100 p-2" aria-live="polite">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
              <LoaderCircle className="animate-spin" size={16} /> Hledám…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-md bg-rose-50 px-3 py-4 text-sm text-rose-700">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">Nic nenalezeno.</div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item) => item.type === "test_suite" ? (
                <button
                  key={`suite-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => onSelectSuite(item.id)}
                  type="button"
                >
                  <Folder className="mt-0.5 shrink-0 text-amber-500" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {item.test_case_count} testů · {item.group_ids.length} skupin
                    </span>
                    {item.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800" key={tag.id}>{tag.name} ({tag.test_case_count})</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              ) : item.type === "suite_group" ? (
                <button
                  key={`group-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => onSelectGroup(item.id)}
                  type="button"
                >
                  <Layers3 className="mt-0.5 shrink-0 text-violet-600" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">
                      Skupina · {item.test_case_count} test cases
                    </span>
                    {item.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800" key={tag.id}>{tag.name} ({tag.test_case_count})</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  key={`case-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => onSelectTestCase(item.id, item.suite_id)}
                  type="button"
                >
                  <FileCheck2 className="mt-0.5 shrink-0 text-cyan-600" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      <strong className="text-cyan-700">{item.code}</strong> {item.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{item.suite_name} · {item.status}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                          <span key={tag.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {tag.name}
                          </span>
                        ))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
