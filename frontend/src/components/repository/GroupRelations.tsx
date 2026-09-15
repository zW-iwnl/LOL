import { useEffect, useMemo, useState } from "react";
import type { SuiteGroup, TestCaseTag, TestSuite } from "../../api/client";
import { RepositoryCaseTable } from "./RepositoryCaseTable";
import { normalizeSearch } from "../test-runs/selection";
import type { GroupIndex } from "./groupNavigation";

export function GroupRelations({ group, index, suites, tags, busy, refreshKey, onOpenCase, onOpenGroup, onRemove, onScope, onRemoveCase, onAdd }: {
  group: SuiteGroup; index: GroupIndex; suites: TestSuite[]; tags: TestCaseTag[]; busy: boolean; refreshKey: number;
  onOpenCase: (id: number) => void; onOpenGroup: (id: number) => void;
  onRemove: (kind: "parent" | "child" | "suite", id: number) => void;
  onScope: (parentId: number, childId: number, include: boolean) => void;
  onRemoveCase: (id: number) => void; onAdd: () => void;
}) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0);
  const rows = useMemo(() => [
    ...group.parent_ids.map(id => ({ kind: "parent" as const, id, name: index.byId.get(id)?.name ?? `#${id}`, include: index.byId.get(id)?.child_relations.find(edge => edge.child_group_id === group.id)?.include_descendants ?? true })),
    ...group.child_relations.map(edge => ({ kind: "child" as const, id: edge.child_group_id, name: index.byId.get(edge.child_group_id)?.name ?? `#${edge.child_group_id}`, include: edge.include_descendants })),
    ...group.members.map(member => ({ kind: "suite" as const, id: member.suite_id, name: suites.find(suite => suite.id === member.suite_id)?.name ?? `#${member.suite_id}`, include: null })),
  ].filter(row => normalizeSearch(`${row.id} ${row.name}`).includes(normalizeSearch(query))), [group, index, suites, query]);
  useEffect(() => { setPage(value => Math.min(value, Math.max(0, Math.ceil(rows.length / 50) - 1))); }, [rows.length]);
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><input type="search" className="workspace-input flex-1" aria-label="Hledat ve vazbách" placeholder="Hledat ve vazbách…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><button type="button" className="workspace-button" disabled={busy} onClick={onAdd}>+ Přidat vazbu</button></div>
    <table className="repository-table"><thead><tr><th>Vztah</th><th>Položka</th><th>Další potomci</th><th>Akce</th></tr></thead><tbody>
      {rows.slice(page * 50, page * 50 + 50).map(row => <tr key={`${row.kind}:${row.id}`}>
        <td>{row.kind === "parent" ? "Nadřazená skupina" : row.kind === "child" ? "Podřazená skupina" : "Test suita"}</td>
        <td>{row.kind === "suite" ? row.name : <button type="button" className="text-cyan-800" disabled={busy} onClick={() => onOpenGroup(row.id)}>{row.name}</button>}</td>
        <td>{row.include !== null ? <label className="flex items-center gap-1"><input type="checkbox" aria-label={`Zahrnout potomky: ${row.name}`} checked={row.include} disabled={busy} onChange={event => onScope(row.kind === "parent" ? row.id : group.id, row.kind === "parent" ? group.id : row.id, event.target.checked)} />{row.include ? "Ano" : "Ne"}</label> : "—"}</td>
        <td><button type="button" className="text-xs text-rose-700" disabled={busy} onClick={() => onRemove(row.kind, row.id)}>Odebrat vazbu</button></td>
      </tr>)}
    </tbody></table>
    {!rows.length && <p className="text-sm text-slate-500">Žádné odpovídající vazby.</p>}
    {rows.length > 50 && <div className="repository-pagination"><span>{page * 50 + 1}–{Math.min(page * 50 + 50, rows.length)} z {rows.length}</span><div><button className="workspace-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Předchozí</button><button className="workspace-button" disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(value => value + 1)}>Další</button></div></div>}
    <RepositoryCaseTable key={group.id} scope={{ groupId: group.id, directOnly: true, includeDescendants: false }} title="Přímé odkazy na test cases" compact suites={suites} tags={tags} refreshKey={refreshKey} onOpen={onOpenCase} onUnlink={item => onRemoveCase(item.id)} />
  </div>;
}
