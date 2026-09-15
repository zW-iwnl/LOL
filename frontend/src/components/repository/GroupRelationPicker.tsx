import { useEffect, useMemo, useState } from "react";
import type { SuiteGroup, TestSuite } from "../../api/client";
import { getRepositoryCases } from "../../api/repositoryWorkspace";
import { AccessibleDialog } from "../AccessibleDialog";
import { VirtualList } from "./VirtualList";
import { normalizeSearch } from "../test-runs/selection";
import { relatedGroupIds, type GroupIndex } from "./groupNavigation";

export type RelationKind = "parent" | "child" | "suite" | "case";
export function GroupRelationPicker({ group, index, suites, busy, error, onClose, onAdd }: {
  group: SuiteGroup; index: GroupIndex; suites: TestSuite[]; busy: boolean; error: string | null; onClose: () => void;
  onAdd: (kind: RelationKind, id: number, includeDescendants: boolean) => void;
}) {
  const [kind, setKind] = useState<RelationKind>("child"); const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null); const [include, setInclude] = useState(true);
  const [caseOptions, setCaseOptions] = useState<{ id: number; name: string }[]>([]); const [offset, setOffset] = useState(0); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false); const [loadError, setLoadError] = useState<string | null>(null);
  const forbidden = useMemo(() => relatedGroupIds(index, group.id, kind === "parent" ? "children" : "parents"), [index, group.id, kind]);
  useEffect(() => {
    if (kind !== "case") return;
    let active = true; setLoading(true); setLoadError(null);
    const timer = setTimeout(() => void getRepositoryCases({ query, offset, limit: 50 }).then(data => {
      if (active) { setCaseOptions(data.items.map(item => ({ id: item.id, name: `${item.code} · ${item.title}` }))); setTotal(data.total); }
    }).catch(reason => { if (active) setLoadError(reason instanceof Error ? reason.message : "Nabídku se nepodařilo načíst."); }).finally(() => { if (active) setLoading(false); }), 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, kind, offset]);
  const options = (kind === "case" ? caseOptions.filter(item => !group.test_case_members.some(member => member.test_case_id === item.id))
    : kind === "suite" ? suites.filter(item => !group.members.some(member => member.suite_id === item.id))
    : index.ordered.filter(item => !forbidden.has(item.id) && !(kind === "parent" ? group.parent_ids : group.child_ids).includes(item.id)))
    .filter(item => kind === "case" || normalizeSearch(`${item.id} ${item.name}`).includes(normalizeSearch(query)));
  return <AccessibleDialog title="Přidat vazbu" onClose={() => !busy && onClose()}>
    <div className="space-y-3">
      <select aria-label="Typ vazby" className="workspace-input w-full" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as RelationKind); setSelected(null); setOffset(0); setQuery(""); }}><option value="child">Podřazená skupina</option><option value="parent">Nadřazená skupina</option><option value="suite">Test suita</option><option value="case">Přímý odkaz na test case</option></select>
      <input aria-label="Hledat položku pro vazbu" className="workspace-input w-full" type="search" maxLength={200} value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setSelected(null); setOffset(0); }} />
      {loading && <p role="status" className="text-xs">Hledám…</p>}{loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
      <div className="h-64"><VirtualList items={options} itemKey={item => item.id} label="Dostupné položky" render={item => <button type="button" data-focus-target className={`repository-picker-row ${selected === item.id ? "bg-selected-bg text-link" : ""}`} disabled={busy || loading} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>#{item.id} {item.name}</button>} /></div>
      {kind === "case" && <div className="flex items-center justify-between text-xs"><span>{total ? offset + 1 : 0}–{Math.min(offset + 50, total)} z {total}</span><div><button type="button" className="workspace-button" disabled={busy || loading || offset === 0} onClick={() => { setOffset(value => value - 50); setSelected(null); }}>Předchozí</button><button type="button" className="workspace-button" disabled={busy || loading || offset + 50 >= total} onClick={() => { setOffset(value => value + 50); setSelected(null); }}>Další</button></div></div>}
      {(kind === "child" || kind === "parent") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={include} disabled={busy} onChange={event => setInclude(event.target.checked)} />Zahrnout další potomky v tomto umístění</label>}
      {(kind === "child" || kind === "parent") && <p className="text-xs text-muted">Již připojené skupiny a vazby vytvářející cyklus nejsou v nabídce.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="workspace-button" disabled={busy} onClick={onClose}>Zrušit</button><button type="button" className="workspace-button workspace-primary" disabled={busy || loading || !selected} onClick={() => selected && onAdd(kind, selected, include)}>{busy ? "Přidávám…" : "Přidat vazbu"}</button></div>
    </div>
  </AccessibleDialog>;
}
