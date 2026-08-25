import { ChevronDown, ChevronRight, FolderPlus, Layers3, Plus, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createSuiteGroup, setSuiteGroupTestCases, type SuiteGroup, type TestCaseTag, type TestSuite } from "../../api/client";
import {
  buildSuiteGroupIndex,
  getSuitesForGroup,
  getUngroupedSuites,
  type SuiteGroupIndex,
} from "../test-suites/suiteGroups";
import { MultiTagSelect } from "../TestCaseTags";
import { RepositoryCaseList } from "./RepositoryCaseList";
import { getDirectCases } from "./repositoryModel";
import type { RepositoryViewProps } from "./repositoryTypes";

type GroupSelection = "all" | "ungrouped" | number;

type RepositoryGroupsViewProps = RepositoryViewProps & {
  groups: SuiteGroup[];
  tags: TestCaseTag[];
  onGroupsChanged: () => void | Promise<void>;
};

export function RepositoryGroupsView(props: RepositoryGroupsViewProps) {
  const [selection, setSelection] = useState<GroupSelection>("all");
  const [groupQuery, setGroupQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParentId, setNewGroupParentId] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseTagIds, setCaseTagIds] = useState<number[]>([]);
  const [groupCaseIds, setGroupCaseIds] = useState<Set<number>>(new Set());
  const [savingCases, setSavingCases] = useState(false);
  const [caseMessage, setCaseMessage] = useState<string | null>(null);
  const index = useMemo(() => buildSuiteGroupIndex(props.groups), [props.groups]);
  const selectedGroup = typeof selection === "number" ? index.byId.get(selection) ?? null : null;
  const allSuites = [...props.model.suiteIndex.byId.values()];
  const allCases = useMemo(() => [...props.model.directCasesBySuiteId.values()].flat(), [props.model]);
  const normalizedGroupQuery = groupQuery.trim().toLocaleLowerCase("cs");
  const matchingGroups = normalizedGroupQuery
    ? props.groups.filter((group) => group.name.toLocaleLowerCase("cs").includes(normalizedGroupQuery))
    : [];
  const visibleCases = useMemo(() => {
    const normalizedCaseQuery = caseQuery.trim().toLocaleLowerCase("cs");
    const selectedTags = props.tags.filter((tag) => caseTagIds.includes(tag.id));
    const selectedCategories = new Set(selectedTags.map((tag) => tag.category));
    return allCases.filter((testCase) => {
      if (normalizedCaseQuery && !(testCase.code + " " + testCase.title).toLocaleLowerCase("cs").includes(normalizedCaseQuery)) return false;
      return [...selectedCategories].every((category) => {
        const categoryIds = new Set(selectedTags.filter((tag) => tag.category === category).map((tag) => tag.id));
        return testCase.tags.some((tag) => categoryIds.has(tag.id));
      });
    });
  }, [allCases, caseQuery, caseTagIds, props.tags]);

  useEffect(() => {
    setGroupCaseIds(new Set(selectedGroup?.test_case_members.map((member) => member.test_case_id) ?? []));
    setCaseMessage(null);
  }, [selectedGroup]);
  const visibleSuites = useMemo(() => {
    const suites = selection === "all"
      ? allSuites
      : selection === "ungrouped"
        ? getUngroupedSuites(props.groups, allSuites)
        : selectedGroup
          ? getSuitesForGroup(selectedGroup, allSuites)
          : [];
    const query = props.query.trim().toLocaleLowerCase("cs");
    if (query.length < 2) return suites;
    return suites.filter((suite) => (suite.name + " " + suite.path).toLocaleLowerCase("cs").includes(query));
  }, [allSuites, props.groups, props.query, selectedGroup, selection]);
  const selectedSuite = typeof props.selected === "number"
    ? props.model.suiteIndex.byId.get(props.selected) ?? null
    : null;
  const selectedCases = selectedSuite ? getDirectCases(props.model, selectedSuite.id) : [];
  const childGroups = selectedGroup ? index.childrenByParentId.get(selectedGroup.id) ?? [] : index.roots;

  function openCreateGroup() {
    setNewGroupName("");
    setNewGroupParentId(selectedGroup ? String(selectedGroup.id) : "");
    setGroupError(null);
    setShowCreateGroup(true);
  }

  async function saveNewGroup() {
    const name = newGroupName.trim();
    if (!name) {
      setGroupError("Název skupiny je povinný.");
      return;
    }
    setCreatingGroup(true);
    setGroupError(null);
    try {
      const created = await createSuiteGroup({
        name,
        parent_group_id: newGroupParentId ? Number(newGroupParentId) : null,
      });
      await props.onGroupsChanged();
      setSelection(created.id);
      setGroupQuery("");
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupParentId("");
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Skupinu se nepodařilo vytvořit.");
    } finally {
      setCreatingGroup(false);
    }
  }

  function toggleGroupCase(testCaseId: number) {
    setGroupCaseIds((current) => {
      const next = new Set(current);
      if (next.has(testCaseId)) next.delete(testCaseId);
      else next.add(testCaseId);
      return next;
    });
    setCaseMessage(null);
  }

  async function saveGroupCases() {
    if (!selectedGroup) return;
    setSavingCases(true);
    setCaseMessage(null);
    try {
      await setSuiteGroupTestCases(selectedGroup.id, [...groupCaseIds]);
      await props.onGroupsChanged();
      setCaseMessage("Výběr test casů byl uložen.");
    } catch (error) {
      setCaseMessage(error instanceof Error ? error.message : "Výběr test casů se nepodařilo uložit.");
    } finally {
      setSavingCases(false);
    }
  }

  return (
    <div className="grid min-h-[520px] lg:min-h-full lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
      <aside className="border-b border-slate-200 bg-slate-50/70 p-3 lg:sticky lg:top-0 lg:border-b-0 lg:border-r" aria-label="Skupiny test suit">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organizace podle skupin</span>
          <button className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800" type="button" onClick={openCreateGroup}>
            <Plus size={14} /> Nová skupina
          </button>
        </div>
        {showCreateGroup && (
          <form className="mb-3 space-y-2 rounded-md border border-cyan-200 bg-white p-3 shadow-sm" onSubmit={(event) => { event.preventDefault(); void saveNewGroup(); }}>
            <div className="text-sm font-semibold">{newGroupParentId ? "Nová podskupina" : "Nová skupina"}</div>
            {groupError && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{groupError}</p>}
            <label className="block text-xs font-medium">
              Název
              <input autoFocus className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm" maxLength={200} required value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
            </label>
            <label className="block text-xs font-medium">
              Nadřazená skupina
              <select className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm" value={newGroupParentId} onChange={(event) => setNewGroupParentId(event.target.value)}>
                <option value="">Kořenová úroveň</option>
                {props.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={creatingGroup || !newGroupName.trim()} type="submit">{creatingGroup ? "Vytvářím…" : "Vytvořit"}</button>
              <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium" disabled={creatingGroup} type="button" onClick={() => { setShowCreateGroup(false); setGroupError(null); }}>Zrušit</button>
            </div>
          </form>
        )}
        <label className="relative mb-2 block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input aria-label="Hledat skupinu" className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm" placeholder="Hledat skupinu" type="search" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} />
        </label>
        <GroupButton label="Všechny suity" count={allSuites.length} active={selection === "all"} onClick={() => setSelection("all")} />
        <GroupButton label="Bez skupiny" count={getUngroupedSuites(props.groups, allSuites).length} active={selection === "ungrouped"} onClick={() => setSelection("ungrouped")} />
        <div className="mt-2 border-t border-slate-200 pt-2">
          {normalizedGroupQuery
            ? matchingGroups.map((group) => <GroupButton key={group.id} label={group.name} count={group.members.length + group.test_case_members.length} active={selection === group.id} onClick={() => setSelection(group.id)} />)
            : index.roots.map((group) => (
              <GroupTreeNode
                key={group.id}
                group={group}
                index={index}
                depth={0}
                collapsedIds={props.collapsedIds}
                selected={selection}
                onSelect={setSelection}
                onToggle={props.onToggleCollapsed}
              />
            ))}
          {normalizedGroupQuery && matchingGroups.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">Žádná skupina neodpovídá hledání.</p>}
          {!normalizedGroupQuery && index.roots.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">Zatím nebyla vytvořena žádná skupina.</p>}
        </div>
      </aside>

      <div className="min-w-0 bg-white">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{selection === "all" ? "Všechny suity" : selection === "ungrouped" ? "Bez skupiny" : selectedGroup?.name ?? "Skupina"}</h2>
              <p className="mt-1 text-xs text-slate-500">{visibleSuites.length} suit · {childGroups.length} podskupin</p>
            </div>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50" type="button" onClick={() => props.onCreateSuite("root")}>
              <FolderPlus size={16} /> Nová suita
            </button>
          </div>
        </header>

        <div className="space-y-5 p-4">
          {selectedGroup && childGroups.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Podskupiny</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {childGroups.map((group) => (
                  <button key={group.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:border-cyan-200 hover:bg-cyan-50" type="button" onClick={() => setSelection(group.id)}>
                    <Layers3 className="text-cyan-700" size={18} />
                    <span><span className="block font-medium">{group.name}</span><span className="text-xs text-slate-500">{group.members.length} suit</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedGroup && (
            <section className="rounded-md border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Test cases ve skupině</h3>
                  <p className="mt-1 text-xs text-slate-500">Výběr nemění umístění test case v původní suitě.</p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={savingCases} type="button" onClick={() => void saveGroupCases()}>
                  <Save size={15} /> {savingCases ? "Ukládám…" : `Uložit výběr (${groupCaseIds.size})`}
                </button>
              </div>
              <div className="space-y-3 p-4">
                {caseMessage && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{caseMessage}</p>}
                <label className="relative block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input aria-label="Hledat test case ve skupině" className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder="Hledat podle kódu nebo názvu" type="search" value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} />
                </label>
                <div className="grid gap-3 xl:grid-cols-3">
                  {([
                    ["business_area", "Business oblast"],
                    ["application_domain", "Aplikace/doména"],
                    ["object_type", "Objekt"],
                  ] as const).map(([category, label]) => {
                    const categoryTags = props.tags.filter((tag) => tag.category === category);
                    const categoryIds = new Set(categoryTags.map((tag) => tag.id));
                    return <MultiTagSelect key={category} label={label} values={caseTagIds.filter((id) => categoryIds.has(id))} tags={categoryTags} onChange={(values) => setCaseTagIds([...caseTagIds.filter((id) => !categoryIds.has(id)), ...values])} />;
                  })}
                </div>
                <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium">
                  <input
                    checked={visibleCases.length > 0 && visibleCases.every((testCase) => groupCaseIds.has(testCase.id))}
                    type="checkbox"
                    onChange={(event) => setGroupCaseIds((current) => {
                      const next = new Set(current);
                      for (const testCase of visibleCases) event.target.checked ? next.add(testCase.id) : next.delete(testCase.id);
                      return next;
                    })}
                  />
                  Vybrat všechny zobrazené ({visibleCases.length})
                </label>
                <div className="max-h-80 space-y-1 overflow-auto">
                  {visibleCases.map((testCase) => (
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-slate-50" key={testCase.id}>
                      <input checked={groupCaseIds.has(testCase.id)} type="checkbox" onChange={() => toggleGroupCase(testCase.id)} />
                      <span className="shrink-0 font-medium text-cyan-700">{testCase.code}</span>
                      <span className="min-w-0 flex-1 truncate">{testCase.title}</span>
                      <span className="hidden max-w-xs truncate text-xs text-slate-500 md:block">{testCase.tags.map((tag) => tag.name).join(" · ")}</span>
                    </label>
                  ))}
                  {visibleCases.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Filtru neodpovídá žádný test case.</p>}
                </div>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Test suity</h3>
            <div className="space-y-2">
              {visibleSuites.map((suite) => (
                <SuiteRow key={suite.id} suite={suite} selected={props.selected === suite.id} onSelect={() => props.onSelectSuite(suite.id)} onCreateCase={() => props.onCreateTestCase(suite.id)} />
              ))}
              {visibleSuites.length === 0 && <div className="rounded-md border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">Tento pohled zatím neobsahuje žádné test suity.</div>}
            </div>
          </section>

          {selectedSuite && (
            <section className="rounded-md border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div><h3 className="font-semibold">{selectedSuite.name}</h3><p className="text-xs text-slate-500">{selectedCases.length} přímých test cases</p></div>
                <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" type="button" onClick={() => props.onCreateTestCase(selectedSuite.id)}><Plus size={15} /> Nový test case</button>
              </div>
              {props.createForm && props.createFormSelection === selectedSuite.id && <div className="border-b border-slate-200">{props.createForm}</div>}
              <div className="p-2">
                <RepositoryCaseList testCases={selectedCases} selectedCaseIds={props.selectedCaseIds} deleting={props.deletingCases} mutating={props.movingCases} density="compact" emptyMessage="Vybraná suita zatím neobsahuje přímé test cases." onToggleCase={props.onToggleCase} onToggleAll={props.onToggleAllCases} onDelete={props.onDeleteCases} onOpenCase={props.onOpenCase} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button aria-pressed={active} className={active ? "mb-1 flex w-full items-center justify-between rounded-md bg-cyan-50 px-3 py-2 text-left text-sm font-medium text-cyan-800" : "mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"} type="button" onClick={onClick}><span>{label}</span><span className="text-xs text-slate-500">{count}</span></button>;
}

function GroupTreeNode({ group, index, depth, collapsedIds, selected, onSelect, onToggle }: { group: SuiteGroup; index: SuiteGroupIndex; depth: number; collapsedIds: ReadonlySet<number>; selected: GroupSelection; onSelect: (selection: GroupSelection) => void; onToggle: (id: number) => void }) {
  const children = index.childrenByParentId.get(group.id) ?? [];
  const collapsed = collapsedIds.has(group.id);
  return (
    <div>
      <div className={selected === group.id ? "flex items-center rounded-md bg-cyan-50 text-cyan-800" : "flex items-center rounded-md text-slate-700 hover:bg-white"} style={{ paddingLeft: depth * 14 }}>
        <button aria-label={collapsed ? `Rozbalit skupinu ${group.name}` : `Sbalit skupinu ${group.name}`} className="grid h-8 w-8 shrink-0 place-items-center" disabled={children.length === 0} type="button" onClick={() => onToggle(group.id)}>{children.length > 0 ? collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} /> : <span className="h-4 w-4" />}</button>
        <button className="min-w-0 flex-1 truncate py-2 pr-2 text-left text-sm" type="button" onClick={() => onSelect(group.id)}>{group.name} <span className="text-xs text-slate-400">({group.members.length})</span></button>
      </div>
      {!collapsed && children.map((child) => <GroupTreeNode key={child.id} group={child} index={index} depth={depth + 1} collapsedIds={collapsedIds} selected={selected} onSelect={onSelect} onToggle={onToggle} />)}
    </div>
  );
}

function SuiteRow({ suite, selected, onSelect, onCreateCase }: { suite: TestSuite; selected: boolean; onSelect: () => void; onCreateCase: () => void }) {
  return (
    <div className={selected ? "flex items-center gap-3 rounded-md border border-cyan-300 bg-cyan-50 p-3" : "flex items-center gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50"}>
      <button className="min-w-0 flex-1 text-left" type="button" onClick={onSelect}><span className="block truncate font-medium">{suite.name}</span><span className="block truncate text-xs text-slate-500">{suite.path} · {suite.direct_test_case_count} přímo</span></button>
      <button className="grid h-8 w-8 place-items-center rounded-md text-cyan-700 hover:bg-white" title="Nový test case" type="button" onClick={onCreateCase}><Plus size={15} /></button>
    </div>
  );
}
