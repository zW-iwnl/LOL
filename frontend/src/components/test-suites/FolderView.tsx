import { ChevronRight, Folder, FolderOpen, Star } from "lucide-react";
import {
  getFolderSuites,
  getSuiteTrail,
  REPOSITORY_ROOT_LABEL,
  type SuiteIndex,
  type SuiteSelection,
} from "./suiteTree";

type FolderViewProps = {
  index: SuiteIndex;
  selected: SuiteSelection;
  query?: string;
  favoriteSuiteIds?: number[];
  onSelect: (selection: SuiteSelection) => void;
  onToggleFavorite?: (suiteId: number) => void;
};

export function FolderView({
  index,
  selected,
  query = "",
  favoriteSuiteIds = [],
  onSelect,
  onToggleFavorite,
}: FolderViewProps) {
  const selectedSuite = typeof selected === "number" ? index.byId.get(selected) ?? null : null;
  const trail = selectedSuite ? getSuiteTrail(index, selectedSuite.id) : [];
  const suites = getFolderSuites(index, selected, query);
  const searching = query.trim().length >= 2;

  return (
    <div className="p-4">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Cesta test suity">
        <button className="inline-flex items-center gap-1 hover:text-cyan-700" type="button" onClick={() => onSelect("root")}>
          <FolderOpen size={14} /> {REPOSITORY_ROOT_LABEL}
        </button>
        {trail.map((suite) => (
          <span className="inline-flex items-center gap-1" key={suite.id}>
            <ChevronRight size={12} />
            <button
              className={selected === suite.id ? "font-medium text-slate-800" : "hover:text-cyan-700"}
              type="button"
              onClick={() => onSelect(suite.id)}
            >
              {suite.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="mb-3 text-sm font-medium text-slate-700">
        {searching ? "Výsledky hledání" : "Podsložky"}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {suites.map((suite) => {
          const favorite = favoriteSuiteIds.includes(suite.id);
          return (
            <div
              key={suite.id}
              className={[
                "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-4 transition",
                selected === suite.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100",
                suite.is_active ? "" : "opacity-60",
              ].join(" ")}
            >
              <Folder size={21} className="text-slate-500" />
              <button className="min-w-0 text-left" type="button" onClick={() => onSelect(suite.id)}>
                <span className="block truncate font-medium">{suite.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {suite.direct_test_case_count} přímo · {suite.total_test_case_count} celkem
                  {!suite.is_active ? " · Neaktivní" : ""}
                </span>
              </button>
              {onToggleFavorite ? (
                <button
                  aria-label={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                  className={favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}
                  type="button"
                  onClick={() => onToggleFavorite(suite.id)}
                >
                  <Star fill={favorite ? "currentColor" : "none"} size={17} />
                </button>
              ) : <ChevronRight size={16} className="text-slate-400" />}
            </div>
          );
        })}
      </div>
      {suites.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
          {searching ? "Žádná suita neodpovídá hledání." : "Tato úroveň nemá žádné podsložky."}
        </div>
      )}
    </div>
  );
}
