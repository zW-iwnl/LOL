import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Edit3, FolderPlus, Plus, Star, Trash2 } from "lucide-react";
import { getSuiteTrail, REPOSITORY_ROOT_LABEL, type SuiteSelection } from "../test-suites/suiteTree";
import { RepositoryCaseList } from "./RepositoryCaseList";
import { RepositoryOutlineTree } from "./RepositoryOutlineTree";
import { getRepositorySections } from "./repositoryModel";
import type { RepositoryViewProps } from "./repositoryTypes";

export function RepositoryNestedView(props: RepositoryViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [highlightedSelection, setHighlightedSelection] = useState<SuiteSelection>(props.selected);
  const sections = useMemo(() => getRepositorySections(props.model, props.collapsedIds, props.query), [props.collapsedIds, props.model, props.query]);
  const visibleSections = useMemo(() => props.rootCollapsed ? sections.slice(0, 1) : sections, [props.rootCollapsed, sections]);

  useEffect(() => {
    setHighlightedSelection(props.selected);
    contentRef.current?.querySelector<HTMLElement>(`#${sectionId(props.selected)}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [props.collapsedIds, props.rootCollapsed, props.selected]);

  useEffect(() => {
    const content = contentRef.current;
    const scrollContainer = content?.closest<HTMLElement>("[data-repository-scroll]") ?? null;
    if (!content || !scrollContainer || typeof IntersectionObserver === "undefined") return;
    const scrollRoot = scrollContainer;
    const elements = [...content.querySelectorAll<HTMLElement>("[data-repository-selection]")];
    function syncHighlightedSection() {
      const rootRect = scrollRoot.getBoundingClientRect();
      const visible = elements
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > rootRect.top + 72 && rect.top < rootRect.bottom)
        .sort((left, right) => Math.abs(left.rect.top - rootRect.top - 72) - Math.abs(right.rect.top - rootRect.top - 72));
      const value = visible[0]?.element.dataset.repositorySelection;
      if (value) setHighlightedSelection(value === "root" ? "root" : Number(value));
    }
    const observer = new IntersectionObserver(syncHighlightedSection, { root: scrollRoot, rootMargin: "-72px 0px -65% 0px", threshold: [0, 0.1, 0.5, 1] });
    elements.forEach((element) => observer.observe(element));
    syncHighlightedSection();
    return () => observer.disconnect();
  }, [visibleSections]);

  function selectAndReveal(selection: SuiteSelection) {
    if (selection !== "root" && props.rootCollapsed) props.onToggleRootCollapsed();
    setHighlightedSelection(selection);
    props.onSelectSuite(selection);
    requestAnimationFrame(() => contentRef.current?.querySelector<HTMLElement>(`#${sectionId(selection)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const contextSection = visibleSections.find((section) => section.selection === highlightedSelection) ?? visibleSections[0];

  return (
    <div className="grid min-h-[520px] lg:min-h-full lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <RepositoryOutlineTree
        model={props.model}
        collapsedIds={props.collapsedIds}
        rootCollapsed={props.rootCollapsed}
        selected={highlightedSelection}
        query={props.query}
        favoriteSuiteIds={props.favoriteSuiteIds}
        onSelect={selectAndReveal}
        onToggleCollapsed={props.onToggleCollapsed}
        onToggleRootCollapsed={props.onToggleRootCollapsed}
        onToggleFavorite={props.onToggleFavorite}
      />

      <div ref={contentRef} className="min-w-0 space-y-2 bg-white p-3" data-testid="repository-tree-content">
        {contextSection && (
          <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <SectionBreadcrumb model={props.model} selection={contextSection.selection} depth={contextSection.depth} />
            <div className="flex min-w-0 items-center justify-between gap-3">
              <h2 className="truncate font-semibold text-slate-900">{contextSection.suite?.name ?? REPOSITORY_ROOT_LABEL}</h2>
              <span className="shrink-0 text-xs text-slate-500">{contextSection.testCases.length} přímých test cases</span>
            </div>
          </div>
        )}
        {visibleSections.map((section) => {
          const active = highlightedSelection === section.selection;
          const favorite = section.suite ? props.favoriteSuiteIds.includes(section.suite.id) : false;
          const collapsed = section.selection === "root" ? props.rootCollapsed : props.collapsedIds.has(section.selection);
          return (
            <section
              className={["scroll-mt-20 overflow-hidden rounded-md border border-l-2 bg-white", active ? "border-cyan-300 ring-1 ring-cyan-100" : "border-slate-200"].join(" ")}
              data-repository-selection={String(section.selection)}
              id={sectionId(section.selection)}
              key={String(section.selection)}
              style={{ marginLeft: section.depth * 12 }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <SectionBreadcrumb model={props.model} selection={section.selection} depth={section.depth} />
                  <div className="flex min-w-0 items-center gap-2">
                    <button aria-expanded={!collapsed} className="flex min-w-0 items-center gap-2 font-semibold text-slate-800 hover:text-cyan-700" type="button" onClick={() => {
                      props.onSelectSuite(section.selection);
                      if (section.selection === "root") props.onToggleRootCollapsed(); else props.onToggleCollapsed(section.selection);
                    }}>
                      {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}<span className="truncate">{section.suite?.name ?? REPOSITORY_ROOT_LABEL}</span>
                    </button>
                    <span className="text-xs text-slate-500">{section.testCases.length}</span>
                    {section.suite && <button className={favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"} title={favorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"} type="button" onClick={() => props.onToggleFavorite(section.suite!.id)}><Star fill={favorite ? "currentColor" : "none"} size={15} /></button>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="grid h-8 w-8 place-items-center rounded-md text-cyan-700 hover:bg-white" title="Nový test case" type="button" onClick={() => props.onCreateTestCase(section.selection)}><Plus size={16} /></button>
                  <button className="grid h-8 w-8 place-items-center rounded-md text-slate-700 hover:bg-white" title="Nová podsuita" type="button" onClick={() => props.onCreateSuite(section.selection)}><FolderPlus size={16} /></button>
                  {section.suite && <><button className="grid h-8 w-8 place-items-center rounded-md text-slate-700 hover:bg-white" title="Upravit suitu" type="button" onClick={() => props.onEditSuite(section.suite!)}><Edit3 size={15} /></button><button className="grid h-8 w-8 place-items-center rounded-md text-rose-700 hover:bg-rose-50" title="Smazat suitu" type="button" onClick={() => props.onDeleteSuite(section.suite!)}><Trash2 size={15} /></button></>}
                </div>
              </div>

              {!collapsed && <>
                {props.createForm && props.createFormSelection === section.selection && <div className="border-t border-slate-200">{props.createForm}</div>}
                <div className="p-2"><RepositoryCaseList testCases={section.testCases} selectedCaseIds={props.selectedCaseIds} deleting={props.deletingCases} mutating={props.movingCases} density="compact" emptyMessage="Tato sekce zatím neobsahuje přímé test cases." onToggleCase={props.onToggleCase} onToggleAll={props.onToggleAllCases} onDelete={props.onDeleteCases} onOpenCase={props.onOpenCase} /></div>
              </>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function sectionId(selection: SuiteSelection): string {
  return selection === "root" ? "repository-section-root" : `repository-section-${selection}`;
}

function SectionBreadcrumb({ model, selection, depth }: { model: RepositoryViewProps["model"]; selection: SuiteSelection; depth: number }) {
  if (selection === "root") return null;
  const trail = getSuiteTrail(model.suiteIndex, selection);
  const currentName = trail[trail.length - 1]?.name ?? REPOSITORY_ROOT_LABEL;
  return (
    <nav aria-label={`Cesta k sekci ${currentName}`} className="mb-0.5 flex min-w-0 items-center gap-1 overflow-hidden text-[10px] text-slate-500">
      <span className="shrink-0">{REPOSITORY_ROOT_LABEL}</span>
      {trail.map((suite) => <span className="inline-flex min-w-0 items-center gap-1" key={suite.id}><ChevronRight className="shrink-0" size={10} /><span className="truncate">{suite.name}</span></span>)}
      {depth > 0 && <span className="ml-auto shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-600">Úroveň {depth}</span>}
    </nav>
  );
}
