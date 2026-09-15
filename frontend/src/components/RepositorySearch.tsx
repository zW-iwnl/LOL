import { FileCheck2, Folder, Layers3, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  searchRepository,
  type RepositorySearchItem,
  type RepositorySearchType,
} from "../api/repositorySearch";

type RepositorySearchProps = {
  compact?: boolean;
  query: string;
  type: RepositorySearchType;
  businessAreaIds?: number[];
  applicationDomainIds?: number[];
  objectTypeIds?: number[];
  filterControls?: ReactNode;
  activeFilterChips?: ReactNode;
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
  compact = false,
  query,
  type,
  businessAreaIds = [],
  applicationDomainIds = [],
  objectTypeIds = [],
  filterControls,
  activeFilterChips,
  onQueryChange,
  onSelectGroup,
  onTypeChange,
  onSelectSuite,
  onSelectTestCase,
}: RepositorySearchProps) {
  const container = useRef<HTMLDivElement>(null);
  const [resultsOpen, setResultsOpen] = useState(Boolean(query.trim()));
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setResultsOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
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
    <div ref={container} className={compact ? "repository-search" : ""} onKeyDown={event => { if (event.key === "Escape") setResultsOpen(false); }}>
      <div className={compact ? "repository-search-controls p-2" : "border-b border-border p-4"}>
        <div className={compact ? "sr-only" : ""}>
          <h2 className="font-semibold text-text">Vyhledávání a filtry</h2>
          <p className="mt-1 text-xs text-muted">Suity i skupiny automaticky zahrnují tagy svých test casů.</p>
        </div>

        <div className={compact ? "flex items-end gap-2" : "mt-4"}>
          <label className="block flex-1 text-sm">
            <span className={compact ? "sr-only" : "font-medium"}>Vyhledat</span>
            <span className="relative mt-1 block">
              <Search className="absolute left-2.5 top-2.5 text-subtle" size={16} aria-hidden="true" />
              <input
                aria-label="Hledat v repository"
                className="w-full rounded-md border border-control bg-surface py-2 pl-8 pr-8 text-sm"
                value={query}
                onFocus={() => setResultsOpen(true)}
                onChange={(event) => { setResultsOpen(true); onQueryChange(event.target.value); }}
                placeholder="Suita, skupina, tag, kód nebo název test case"
              />
              {query && (
                <button
                  aria-label="Vymazat hledání"
                  className="absolute right-2 top-2 text-subtle hover:text-text"
                  onClick={() => onQueryChange("")}
                  title="Vymazat hledání"
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </span>
          </label>
          {compact && filterControls && <button type="button" className="workspace-button mb-0.5" aria-expanded={filtersOpen} onClick={() => { setFiltersOpen(!filtersOpen); setResultsOpen(true); }}>Filtry{hasTagFilter ? ` (${businessAreaIds.length + applicationDomainIds.length + objectTypeIds.length})` : ""}</button>}
          {!compact && filterControls}
        </div>

        {compact && filtersOpen && <div className="repository-search-filters mt-2 grid gap-2 md:grid-cols-3">{filterControls}</div>}
        <div aria-label="Typ výsledků hledání" className="mt-1 flex flex-wrap items-center gap-1" role="group">
          <span className="mr-1 text-xs font-medium text-muted">Hledat v:</span>
          {typeOptions.map((option) => (
            <button
              aria-pressed={type === option.value}
              key={option.value}
              className={type === option.value
                ? "rounded-md bg-selected-bg px-2 py-1 text-xs font-medium text-link"
                : "rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-muted"}
              onClick={() => { setResultsOpen(true); onTypeChange(option.value); }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {normalizedQuery.length === 1 && (
          <div className="mt-2 text-xs text-muted">Zadejte alespoň 2 znaky.</div>
        )}
      </div>

      {compact && hasTagFilter && <div className="flex flex-wrap items-center gap-1 px-2 pb-2 text-xs"><span className="text-muted">Filtry hledání:</span>{activeFilterChips}</div>}
      {active && (!compact || resultsOpen) && (
        <div className={compact ? "repository-search-results" : "max-h-[420px] overflow-y-auto border-t border-border p-2"} aria-live="polite">
          {compact && <div className="flex justify-between px-3 py-1 text-xs text-muted"><span>Nejvýše 20 výsledků · hledání v celém repository</span><button type="button" onClick={() => setResultsOpen(false)}>Zavřít výsledky</button></div>}
          {loading && (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted">
              <LoaderCircle className="animate-spin" size={16} /> Hledám…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-md bg-danger-bg px-3 py-4 text-sm text-danger">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted">Nic nenalezeno.</div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item) => item.type === "test_suite" ? (
                <button
                  key={`suite-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-muted"
                  onClick={() => { setResultsOpen(false); onSelectSuite(item.id); }}
                  type="button"
                >
                  <Folder className="mt-0.5 shrink-0 text-warning" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted">
                      {item.test_case_count} testů · {item.group_ids.length} skupin
                    </span>
                    {item.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span className="rounded bg-warning-bg px-1.5 py-0.5 text-[10px] text-warning" key={tag.id}>{tag.name} ({tag.test_case_count})</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              ) : item.type === "suite_group" ? (
                <button
                  key={`group-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-muted"
                  onClick={() => { setResultsOpen(false); onSelectGroup(item.id); }}
                  type="button"
                >
                  <Layers3 className="mt-0.5 shrink-0 text-note" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted">
                      Skupina · {item.test_case_count} test cases
                    </span>
                    {item.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span className="rounded bg-note-bg px-1.5 py-0.5 text-[10px] text-note" key={tag.id}>{tag.name} ({tag.test_case_count})</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  key={`case-${item.id}`}
                  className="flex w-full gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-muted"
                  onClick={() => { setResultsOpen(false); onSelectTestCase(item.id, item.suite_id); }}
                  type="button"
                >
                  <FileCheck2 className="mt-0.5 shrink-0 text-link" size={16} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      <strong className="text-link">{item.code}</strong> {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted">{item.suite_name} · {item.status}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                          <span key={tag.id} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
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
    </div>
  );
}
