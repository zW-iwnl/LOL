import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { TestCase } from "../../api/client";

export function RepositoryCaseList({
  testCases,
  selectedCaseIds,
  deleting,
  mutating = false,
  density = "comfortable",
  emptyMessage = "Tato úroveň zatím neobsahuje test cases.",
  renderBulkActions,
  onToggleCase,
  onToggleAll,
  onDelete,
  onOpenCase,
}: {
  testCases: TestCase[];
  selectedCaseIds: ReadonlySet<number>;
  deleting: boolean;
  mutating?: boolean;
  density?: "comfortable" | "compact";
  emptyMessage?: string;
  renderBulkActions?: (selectedIds: number[]) => ReactNode;
  onToggleCase: (testCaseId: number, checked: boolean) => void;
  onToggleAll: (testCaseIds: number[], checked: boolean) => void;
  onDelete: (testCaseIds: number[]) => void;
  onOpenCase: (testCase: TestCase) => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const ids = useMemo(() => testCases.map((testCase) => testCase.id), [testCases]);
  const selectedIds = useMemo(
    () => ids.filter((id) => selectedCaseIds.has(id)),
    [ids, selectedCaseIds],
  );
  const allSelected = ids.length > 0 && selectedIds.length === ids.length;
  const busy = deleting || mutating;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && !allSelected;
    }
  }, [allSelected, selectedIds.length]);

  if (testCases.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
        <label className="flex items-center gap-3">
          <input
            ref={selectAllRef}
            aria-label="Vybrat všechny test cases v této sekci"
            checked={allSelected}
            disabled={busy}
            type="checkbox"
            onChange={(event) => onToggleAll(ids, event.target.checked)}
          />
          <span className="font-medium">Vybrat vše</span>
          <span className="text-xs text-slate-500">{selectedIds.length} z {testCases.length}</span>
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {renderBulkActions?.(selectedIds)}
          <button
            className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedIds.length === 0 || busy}
            type="button"
            onClick={() => onDelete(selectedIds)}
          >
            <Trash2 size={15} /> {deleting ? "Mažu…" : `Smazat vybrané (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {testCases.map((testCase) => {
        const checked = selectedCaseIds.has(testCase.id);
        return (
          <div
            key={testCase.id}
            className={[
              "flex items-center gap-3 rounded-md border text-sm transition",
              density === "compact" ? "px-2 py-1.5" : "px-3 py-2",
              checked ? "border-cyan-200 bg-cyan-50" : "border-slate-100 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <input
              aria-label={`Vybrat test case ${testCase.code}`}
              checked={checked}
              disabled={busy}
              type="checkbox"
              onChange={(event) => onToggleCase(testCase.id, event.target.checked)}
            />
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" type="button" onClick={() => onOpenCase(testCase)}>
              <span className="shrink-0 font-medium text-cyan-700">{testCase.code}</span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{testCase.title}</span>
              <span className="hidden truncate text-xs text-slate-500 2xl:inline">
                {testCase.tags.map((tag) => tag.name).join(" · ")}
              </span>
              <span className="hidden shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500 md:inline">{testCase.status}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
