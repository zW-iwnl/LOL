import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Edit3, Folder, MoveRight, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getFolderSuites, getSuiteTrail, REPOSITORY_ROOT_LABEL, type SuiteSelection } from "../test-suites/suiteTree";
import { RepositoryCaseList } from "./RepositoryCaseList";
import { RepositoryOutlineTree } from "./RepositoryOutlineTree";
import { getDirectCases, sortRepositoryTestCases, type RepositoryCaseSort, type RepositorySortDirection } from "./repositoryModel";
import type { RepositoryViewProps } from "./repositoryTypes";

export function RepositoryFoldersView(props: RepositoryViewProps) {
  const { model, selected } = props;
  const [sortBy, setSortBy] = useState<RepositoryCaseSort>("code");
  const [sortDirection, setSortDirection] = useState<RepositorySortDirection>("asc");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [moveTarget, setMoveTarget] = useState("");
  const selectedSuite = typeof selected === "number" ? model.suiteIndex.byId.get(selected) ?? null : null;
  const trail = selectedSuite ? getSuiteTrail(model.suiteIndex, selectedSuite.id) : [];
  const childSuites = getFolderSuites(model.suiteIndex, selected);
  const testCases = useMemo(
    () => sortRepositoryTestCases(getDirectCases(model, selected), sortBy, sortDirection),
    [model, selected, sortBy, sortDirection],
  );
  const moveTargets = [...model.suiteIndex.byId.values()]
    .filter((suite) => suite.id !== selected)
    .sort((left, right) => left.path.localeCompare(right.path, "cs", { numeric: true, sensitivity: "base" }));
  const parentSelection: SuiteSelection = selectedSuite?.parent_suite_id ?? "root";
  const favorite = selectedSuite ? props.favoriteSuiteIds.includes(selectedSuite.id) : false;

  useEffect(() => setMoveTarget(""), [selected]);

  return (
    <div className="grid min-h-[520px] lg:min-h-full lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <RepositoryOutlineTree
        model={model}
        collapsedIds={props.collapsedIds}
        selected={selected}
        query={props.query}
        favoriteSuiteIds={props.favoriteSuiteIds}
        onSelect={props.onSelectSuite}
        onToggleCollapsed={props.onToggleCollapsed}
        onToggleFavorite={props.onToggleFavorite}
      />

      <div className="min-w-0 bg-white">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          {selectedSuite && (
            <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Cesta suity">
              <button className="hover:text-cyan-700" type="button" onClick={() => props.onSelectSuite("root")}>{REPOSITORY_ROOT_LABEL}</button>
              {trail.map((suite) => (
                <span className="inline-flex items-center gap-1" key={suite.id}>
                  <ChevronRight size={12} />
                  <button className={selected === suite.id ? "font-medium text-slate-800" : "hover:text-cyan-700"} type="button" onClick={() => props.onSelectSuite(suite.id)}>{suite.name}</button>
                </span>
              ))}
            </nav>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {selectedSuite && (
                <button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100" title="Zpět o úroveň" type="button" onClick={() => props.onSelectSuite(parentSelection)}>
                  <ArrowLeft size={17} />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold">{selectedSuite?.name ?? REPOSITORY_ROOT_LABEL}</h2>
                  {selectedSuite && (
                    <button className={favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"} title={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"} type="button" onClick={() => props.onToggleFavorite(selectedSuite.id)}>
                      <Star fill={favorite ? "currentColor" : "none"} size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{testCases.length} test cases · {childSuites.length} test suit</span>
                  {selectedSuite && (
                    <span className={selectedSuite.is_active ? "rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700" : "rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600"}>
                      {selectedSuite.is_active ? "Aktivní" : "Neaktivní"}
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-2xl truncate text-xs text-slate-600" title={selectedSuite?.description ?? undefined}>
                  {selectedSuite?.description || "Kořenová úroveň repository bez vlastního popisu."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" type="button" onClick={() => props.onCreateTestCase(selected)}><Plus size={16} /> Nový test case</button>
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50" type="button" onClick={() => props.onCreateSuite(selected)}><Folder size={16} /> Nová suita</button>
              {selectedSuite && <><button className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 hover:bg-slate-50" title="Upravit suitu" type="button" onClick={() => props.onEditSuite(selectedSuite)}><Edit3 size={16} /></button><button className="grid h-9 w-9 place-items-center rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50" title="Smazat suitu" type="button" onClick={() => props.onDeleteSuite(selectedSuite)}><Trash2 size={16} /></button></>}
            </div>
          </div>
        </div>

        {props.createForm && props.createFormSelection === selected && <div className="border-b border-slate-200">{props.createForm}</div>}

        <div className="space-y-6 p-4">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Test cases</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Řazení</span>
                  <select aria-label="Řadit test cases podle" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" value={sortBy} onChange={(event) => setSortBy(event.target.value as RepositoryCaseSort)}>
                    <option value="code">Kód</option><option value="title">Název</option><option value="status">Stav</option><option value="updated_at">Aktualizace</option>
                  </select>
                </label>
                <button aria-label={sortDirection === "asc" ? "Řazení vzestupně" : "Řazení sestupně"} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" type="button" onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}>
                  {sortDirection === "asc" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                </button>
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Hustota řádků">
                  {(["comfortable", "compact"] as const).map((option) => (
                    <button key={option} aria-pressed={density === option} className={density === option ? "rounded bg-white px-2 py-1 text-xs font-medium text-cyan-700 shadow-sm" : "rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-800"} type="button" onClick={() => setDensity(option)}>{option === "comfortable" ? "Komfortní" : "Kompaktní"}</button>
                  ))}
                </div>
              </div>
            </div>
            <RepositoryCaseList
              testCases={testCases}
              selectedCaseIds={props.selectedCaseIds}
              deleting={props.deletingCases}
              mutating={props.movingCases}
              density={density}
              renderBulkActions={(selectedIds) => (
                <div className="flex items-center gap-1.5">
                  <select aria-label="Cílová suita pro přesun" className="max-w-52 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" disabled={selectedIds.length === 0 || props.deletingCases || props.movingCases} value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                    <option value="">Přesunout do suity…</option>
                    {selected !== "root" && <option value="root">{REPOSITORY_ROOT_LABEL}</option>}
                    {moveTargets.map((suite) => <option key={suite.id} value={suite.id}>{suite.path}</option>)}
                  </select>
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!moveTarget || selectedIds.length === 0 || props.deletingCases || props.movingCases} type="button" onClick={() => props.onMoveCases(selectedIds, moveTarget === "root" ? "root" : Number(moveTarget))}>
                    <MoveRight size={14} /> {props.movingCases ? "Přesouvám…" : `Přesunout (${selectedIds.length})`}
                  </button>
                </div>
              )}
              onToggleCase={props.onToggleCase}
              onToggleAll={props.onToggleAllCases}
              onDelete={props.onDeleteCases}
              onOpenCase={props.onOpenCase}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Test suity</h3>
            {childSuites.length > 0 ? (
              <div className="space-y-1.5">
                {childSuites.map((suite) => (
                  <button className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:border-cyan-200 hover:bg-cyan-50" key={suite.id} type="button" onClick={() => props.onSelectSuite(suite.id)}>
                    <Folder className="shrink-0 text-slate-500" size={20} /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{suite.name}</span><span className="mt-1 block text-xs text-slate-500">{suite.direct_test_case_count} přímo · {suite.total_test_case_count} celkem</span></span><ChevronRight className="shrink-0 text-slate-400" size={16} />
                  </button>
                ))}
              </div>
            ) : <div className="rounded-md border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">Tato úroveň zatím neobsahuje další test suity.</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
