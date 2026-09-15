import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { addSuiteGroupChild, addSuiteGroupMember, createSuiteGroup, deleteSuiteGroup, removeSuiteGroupChild, removeSuiteGroupMember, setSuiteGroupTestCases, updateSuiteGroup, updateSuiteGroupChildScope,
  type TestCaseTag, type TestSuite } from "../../api/client";
import { getRepositoryGroup, type RepositoryGroup } from "../../api/repositoryWorkspace";
import { useApiResource } from "../../api/hooks";
import { AccessibleDialog } from "../AccessibleDialog";
import { ExecutionMenu } from "../execution/ExecutionMenu";
import { normalizeSearch } from "../test-runs/selection";
import { GroupNavigator } from "./GroupNavigator";
import { GroupRelations } from "./GroupRelations";
import { GroupMetadataForm } from "./GroupMetadataForm";
import { GroupRelationPicker, type RelationKind } from "./GroupRelationPicker";
import { RepositoryCaseTable } from "./RepositoryCaseTable";
import { createGroupIndex, validatePlacement, type GroupPlacement } from "./groupNavigation";
import { useRepositoryPreference } from "./useRepositoryPreference";

type Props = { groups: RepositoryGroup[]; suites: TestSuite[]; tags: TestCaseTag[]; selectedGroupId: number | null;
  onSelectedGroupChange: (id: number | null, path?: number[]) => void; onChanged: () => void;
  onOpenCase: (id: number) => void; onOpenSuite: (id: number) => void };
export function RepositoryGroupsView(props: Props) {
  const { groups, suites, tags, selectedGroupId, onSelectedGroupChange, onChanged } = props;
  const index = useMemo(() => createGroupIndex(groups), [groups]);
  const [params] = useSearchParams();
  const id = selectedGroupId ?? index.roots[0]?.id;
  const path = (params.get("groupPath") ?? "").split(".").map(Number).filter(value => value > 0);
  const selection = id && index.byId.has(id) ? validatePlacement(index, id, path) : null;
  const [showNavigator, setShowNavigator] = useRepositoryPreference("groupNavigatorOpen", true);
  const [width, setWidth] = useRepositoryPreference("groupNavigatorWidth", 300);
  const [newOpen, setNewOpen] = useState(false); const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false); const [error, setError] = useState<string | null>(null);
  async function create() {
    if (!newName.trim() || creating) return;
    setCreating(true); setError(null);
    try { const created = await createSuiteGroup({ name: newName.trim() }); onChanged(); onSelectedGroupChange(created.id); setNewOpen(false); setNewName(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Skupinu se nepodařilo vytvořit."); }
    finally { setCreating(false); }
  }
  function select(placement: GroupPlacement) { onSelectedGroupChange(placement.groupId, placement.path); }
  return <div className="repository-group-workspace">
    <div className="flex items-center gap-3 text-xs"><button type="button" className="workspace-button" aria-expanded={showNavigator} onClick={() => setShowNavigator(!showNavigator)}>{showNavigator ? "Skrýt strukturu" : "Zobrazit strukturu"}</button>
      <label className="workspace-width-control">Šířka navigace <input type="range" aria-label="Šířka struktury" min={260} max={400} step={10} value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
    </div>
    <div className={`repository-panels ${showNavigator ? "with-navigation" : ""}`} style={{ "--repository-navigation-width": `${width}px` } as CSSProperties}>
      {showNavigator && <GroupNavigator index={index} selection={selection} onSelect={select} onCreate={() => { setError(null); setNewOpen(true); }} />}
      {selection ? <GroupDetail key={selection.groupId} {...props} index={index} selection={selection} onSelect={select} /> : <section className="repository-detail p-4 text-sm">Vyberte skupinu nebo <button type="button" className="text-cyan-800 underline" onClick={() => setNewOpen(true)}>vytvořte novou</button>.</section>}
    </div>
    {newOpen && <AccessibleDialog title="Nová kořenová skupina" onClose={() => !creating && setNewOpen(false)}><form onSubmit={event => { event.preventDefault(); void create(); }} className="space-y-3">
      <label className="block text-sm">Název skupiny<input className="workspace-input mt-1 w-full" required maxLength={200} value={newName} disabled={creating} onChange={event => setNewName(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<button type="submit" className="workspace-button workspace-primary" disabled={creating || !newName.trim()}>Vytvořit skupinu</button>
    </form></AccessibleDialog>}
  </div>;
}

function GroupDetail({ selection, index, onSelect, ...props }: Props & { selection: GroupPlacement; index: ReturnType<typeof createGroupIndex>; onSelect: (placement: GroupPlacement) => void }) {
  const [tab, setTab] = useRepositoryPreference<"content" | "relations" | "details">(`groupTab:${selection.groupId}`, "content");
  const [contentMode, setContentMode] = useRepositoryPreference<"direct" | "all">(`groupContent:${selection.groupId}`, "direct");
  const [refreshKey, setRefreshKey] = useState(0); const [busy, setBusy] = useState(false); const locked = useRef(false);
  const [feedback, setFeedback] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [picker, setPicker] = useState(false);
  const state = useApiResource(() => getRepositoryGroup(selection.groupId), [selection.groupId, refreshKey]);
  const group = state.data; const disabled = busy || state.loading;
  const [structurePage, setStructurePage] = useState(0);
  const [structureQuery, setStructureQuery] = useState("");
  useEffect(() => { setStructurePage(0); }, [structureQuery, group, selection.includeDescendants]);
  async function mutate(action: () => Promise<unknown>, message: string) {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setFeedback(null); setError(null);
    try { await action(); setRefreshKey(value => value + 1); props.onChanged(); setFeedback(message); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Operaci se nepodařilo dokončit."); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  async function add(kind: RelationKind, id: number, include: boolean) {
    if (!group) return;
    const action = kind === "parent" ? () => addSuiteGroupChild(id, group.id, include)
      : kind === "child" ? () => addSuiteGroupChild(group.id, id, include)
      : kind === "suite" ? () => addSuiteGroupMember(group.id, id)
      : () => setSuiteGroupTestCases(group.id, [...group.test_case_members.map(member => member.test_case_id), id]);
    if (await mutate(action, "Vazba byla přidána.")) setPicker(false);
  }
  async function remove(kind: "parent" | "child" | "suite", id: number) {
    if (!group) return;
    await mutate(kind === "suite" ? () => removeSuiteGroupMember(group.id, id)
      : kind === "parent" ? () => removeSuiteGroupChild(id, group.id) : () => removeSuiteGroupChild(group.id, id), "Vazba byla odebrána.");
  }
  if (!group) return <section className="repository-detail p-4">{state.error ? <p role="alert" className="text-sm text-rose-700">{state.error}<button className="ml-2 underline" onClick={() => setRefreshKey(value => value + 1)}>Zkusit znovu</button></p> : <p role="status" className="text-sm">Načítám skupinu…</p>}</section>;
  const structure = [
    ...(selection.includeDescendants ? group.child_relations.map(edge => ({ kind: "group" as const, id: edge.child_group_id, name: index.byId.get(edge.child_group_id)?.name ?? `#${edge.child_group_id}`, include: edge.include_descendants })) : []),
    ...group.members.map(member => ({ kind: "suite" as const, id: member.suite_id, name: props.suites.find(suite => suite.id === member.suite_id)?.name ?? `#${member.suite_id}`, include: true })),
  ].filter(row => normalizeSearch(`${row.id} ${row.name}`).includes(normalizeSearch(structureQuery)));
  return <section className="repository-detail" aria-label="Detail skupiny">
    <header className="space-y-2 border-b border-slate-200 p-3">
      <nav aria-label="Cesta skupiny" className="flex flex-wrap gap-1 text-xs text-slate-500">{selection.path.map((id, i) => <span key={id}>{i > 0 && " › "}<button type="button" onClick={() => onSelect(validatePlacement(index, id, selection.path.slice(0, i + 1)))}>{index.byId.get(id)?.name ?? `#${id}`}</button></span>)}</nav>
      <div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">{group.name}</h2><p className="text-xs text-slate-500">#{group.id} · {group.members.length} přímých suit · {group.test_case_members.length} přímých odkazů · {group.parent_ids.length} rodičů</p></div>
        <ExecutionMenu label="Akce skupiny"><button type="button" disabled={disabled} onClick={() => { setError(null); setPicker(true); }}>Přidat vazbu</button><button type="button" onClick={() => setTab("details")}>Upravit skupinu</button><button type="button" disabled={disabled} onClick={async () => {
          if (window.confirm(`Smazat skupinu „${group.name}“ ve všech umístěních? Suity ani test cases se nesmažou.`)) {
            if (await mutate(() => deleteSuiteGroup(group.id), "Skupina byla smazána.")) props.onSelectedGroupChange(null);
          }
        }}>Smazat skupinu</button></ExecutionMenu>
      </div>
      {!selection.includeDescendants && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">Toto umístění je bez dalších potomků. <button type="button" className="underline" onClick={() => onSelect({ groupId: group.id, path: [group.id], includeDescendants: true })}>Otevřít celou skupinu</button></p>}
      <div className="flex gap-1" aria-label="Část detailu skupiny">{([["content", "Obsah"], ["relations", "Vazby"], ["details", "Podrobnosti"]] as const).map(([value, label]) => <button type="button" key={value} className="workspace-button" aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    </header>
    <div className="repository-detail-scroll p-3">
      {(error || state.error) && <p role="alert" className="mb-2 text-sm text-rose-700">{error ?? state.error}</p>}{feedback && <p role="status" className="mb-2 text-xs text-emerald-700">{feedback}</p>}
      {tab === "content" && <>
        <div className="mb-2 flex gap-1"><button type="button" className="workspace-button" aria-pressed={contentMode === "direct"} onClick={() => setContentMode("direct")}>Přímý obsah</button><button type="button" className="workspace-button" aria-pressed={contentMode === "all"} onClick={() => setContentMode("all")}>Všechny testy v rozsahu</button></div>
        {contentMode === "direct" && <>
          <input type="search" aria-label="Hledat přímé skupiny a suity" placeholder="Hledat přímé skupiny a suity…" className="workspace-input mb-2 w-full" value={structureQuery} onChange={event => setStructureQuery(event.target.value)} />
          <table className="repository-table"><thead><tr><th>Typ</th><th>Název</th><th>Rozsah</th></tr></thead><tbody>{structure.slice(structurePage * 50, structurePage * 50 + 50).map(row => <tr key={`${row.kind}:${row.id}`}><td>{row.kind === "group" ? "Skupina" : "Suita"}</td><td><button type="button" className="text-cyan-800" onClick={() => row.kind === "suite" ? props.onOpenSuite(row.id) : onSelect(validatePlacement(index, row.id, [...selection.path, row.id]))}>{row.name}</button></td><td>{row.kind === "group" ? row.include ? "Včetně potomků" : "Bez dalších potomků" : `${props.suites.find(suite => suite.id === row.id)?.test_case_count ?? 0} testů`}</td></tr>)}</tbody></table>
          {structure.length > 50 && <div className="repository-pagination"><span>{structurePage * 50 + 1}–{Math.min(structurePage * 50 + 50, structure.length)} z {structure.length}</span><div><button className="workspace-button" disabled={!structurePage} onClick={() => setStructurePage(value => value - 1)}>Předchozí</button><button className="workspace-button" disabled={(structurePage + 1) * 50 >= structure.length} onClick={() => setStructurePage(value => value + 1)}>Další</button></div></div>}
        </>}
        <RepositoryCaseTable key={`${group.id}:${contentMode}:${selection.includeDescendants}`} scope={{ groupId: group.id, includeDescendants: selection.includeDescendants, directOnly: contentMode === "direct" }} suites={props.suites} tags={props.tags} refreshKey={refreshKey} onOpen={props.onOpenCase} compact title={contentMode === "direct" ? "Přímé odkazy na test cases" : "Všechny testy v rozsahu"} />
      </>}
      {tab === "relations" && <GroupRelations group={group} index={index} suites={props.suites} tags={props.tags} busy={disabled} refreshKey={refreshKey} onOpenCase={props.onOpenCase} onOpenGroup={id => onSelect({ groupId: id, path: [id], includeDescendants: true })} onAdd={() => { setError(null); setPicker(true); }} onRemove={(kind, id) => void remove(kind, id)}
        onScope={(parent, child, include) => void mutate(() => updateSuiteGroupChildScope(parent, child, include), "Rozsah vazby byl změněn.")}
        onRemoveCase={id => { if (!disabled) void mutate(() => setSuiteGroupTestCases(group.id, group.test_case_members.map(member => member.test_case_id).filter(value => value !== id)), "Přímý odkaz byl odebrán."); }} />}
      {tab === "details" && <GroupMetadataForm group={group} busy={disabled} onSave={(name, description, order) => mutate(() => updateSuiteGroup(group.id, { name, description, sort_order: order }), "Skupina byla upravena.")} />}
    </div>
    {picker && <GroupRelationPicker group={group} index={index} suites={props.suites} busy={disabled} error={error} onClose={() => setPicker(false)} onAdd={(kind, id, include) => void add(kind, id, include)} />}
  </section>;
}
