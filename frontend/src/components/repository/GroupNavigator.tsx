import { ChevronDown, ChevronRight, Plus, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeSearch } from "../test-runs/selection";
import { VirtualList } from "./VirtualList";
import { useRepositoryPreference } from "./useRepositoryPreference";
import { matchingGroups, revealGroup, visibleGroupRows, type GroupIndex, type GroupPlacement, type GroupRow } from "./groupNavigation";

type Props = { index: GroupIndex; selection: GroupPlacement | null; onSelect: (placement: GroupPlacement) => void; onCreate: () => void };
export function GroupNavigator({ index, selection, onSelect, onCreate }: Props) {
  const [query, setQuery] = useRepositoryPreference("groupQuery", "");
  const [mode, setMode] = useRepositoryPreference<"tree" | "list">("groupMode", "tree");
  const [expandedKeys, setExpandedKeys] = useRepositoryPreference<string[]>("groupExpanded", []);
  const [favorites, setFavorites] = useRepositoryPreference<number[]>("groupFavorites", []);
  const [filter, setFilter] = useRepositoryPreference("groupFilter", "all");
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const expanded = useMemo(() => new Set(expandedKeys), [expandedKeys]);
  const searching = Boolean(query.trim()) || filter !== "all";
  const rows = useMemo(() => {
    if (mode === "tree" && !searching) return visibleGroupRows(index, expanded);
    return matchingGroups(index.ordered, query).filter(group => filter === "all" || filter === "favorites" && favorites.includes(group.id)
      || filter === "roots" && group.parent_ids.length === 0 || filter === "shared" && group.parent_ids.length > 1).map(group => ({ group, groupId: group.id, key: String(group.id), depth: 0, path: [group.id], includeDescendants: true, expandable: false }));
  }, [index, query, expanded, mode, searching, filter, favorites]);
  function toggle(key: string) { setExpandedKeys(expanded.has(key) ? expandedKeys.filter(item => item !== key) : [...expandedKeys, key]); }
  function reveal() {
    if (!selection) return;
    const placement = selection.path.length > 1 ? selection : revealGroup(index, selection.groupId);
    const keys = placement.path.map((_, i) => placement.path.slice(0, i + 1).join("."));
    setExpandedKeys([...new Set([...expandedKeys, ...keys.slice(0, -1)])]); setQuery(""); setFilter("all"); setMode("tree");
    onSelect(placement); setRevealKey(keys.at(-1)!);
  }
  function renderRow(row: GroupRow) {
    const active = selection?.groupId === row.groupId && (mode === "list" || searching || selection.path.join(".") === row.key);
    const nameMatch = normalizeSearch(`${row.group.id} ${row.group.name}`).includes(normalizeSearch(query));
    const label = row.path.map(id => index.byId.get(id)?.name ?? id).join(" › ");
    return <div className={`repository-group-row ${active ? "is-selected" : ""}`} style={{ paddingLeft: Math.min(row.depth * 14, 140) }}
      onKeyDown={event => { if (event.key === "ArrowRight" && row.expandable && !expanded.has(row.key) || event.key === "ArrowLeft" && expanded.has(row.key)) { event.preventDefault(); toggle(row.key); } }}>
      <button type="button" className="grid h-8 w-6 shrink-0 place-items-center" disabled={!row.expandable}
        aria-label={`${expanded.has(row.key) ? "Sbalit" : "Rozbalit"} ${row.group.name}`} aria-expanded={row.expandable ? expanded.has(row.key) : undefined} onClick={() => toggle(row.key)}>
        {row.expandable ? expanded.has(row.key) ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span className="text-subtle">·</span>}
      </button>
      <button data-focus-target type="button" className="min-w-0 flex-1 truncate text-left text-xs" aria-current={active ? "true" : undefined}
        title={`${label}\n#${row.groupId} · ${row.group.parent_ids.length} rodičů${!row.includeDescendants ? " · bez dalších potomků" : ""}`}
        onClick={() => { onSelect(row); setRevealKey(null); }}>
        {row.group.name}{row.group.parent_ids.length > 1 && <span className="ml-1 text-link">↗ {row.group.parent_ids.length}</span>}
        {!row.includeDescendants && <span className="ml-1 text-warning">⊣</span>}
        {query.trim() && !nameMatch && <span className="ml-1 text-muted">· tag v obsahu</span>}
      </button>
      <button type="button" className={`grid h-8 w-7 shrink-0 place-items-center ${favorites.includes(row.groupId) ? "text-warning" : "text-subtle hover:text-warning"}`}
        aria-label={`${favorites.includes(row.groupId) ? "Odebrat z oblíbených" : "Přidat do oblíbených"}: ${row.group.name}`} aria-pressed={favorites.includes(row.groupId)}
        onClick={() => setFavorites(favorites.includes(row.groupId) ? favorites.filter(id => id !== row.groupId) : [...favorites, row.groupId])}><Star size={13} fill={favorites.includes(row.groupId) ? "currentColor" : "none"} /></button>
    </div>;
  }
  return <aside className="repository-navigation" aria-label="Struktura skupin">
    <div className="space-y-2 border-b border-border p-3">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Struktura skupin</h2><button type="button" className="workspace-button" aria-label="Nová skupina" onClick={onCreate}><Plus size={14} /></button></div>
      <input type="search" aria-label="Hledat skupinu" placeholder="Název, ID nebo tag…" className="workspace-input w-full" value={query} onChange={event => { setQuery(event.target.value); setRevealKey(null); }} />
      <div className="flex gap-1"><button type="button" className="workspace-button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>Strom</button><button type="button" className="workspace-button" aria-pressed={mode === "list"} onClick={() => setMode("list")}>Seznam</button>
      <select aria-label="Filtr skupin" className="workspace-input min-w-0 flex-1" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Všechny skupiny</option><option value="favorites">★ Oblíbené</option><option value="roots">Kořenové skupiny</option><option value="shared">Více rodičů</option></select></div>
      <div className="flex justify-between gap-2 text-[11px] text-link"><button type="button" onClick={() => setExpandedKeys([])}>Sbalit větve</button><button type="button" disabled={!selection} onClick={reveal}>Ukázat vybranou ve struktuře</button></div>
      {searching && <p className="text-[11px] text-muted">Každá skupina jednou · ↗ počet rodičů</p>}
    </div>
    <nav aria-label="Hierarchie skupin" className="min-h-0 flex-1 flex flex-col">
      <VirtualList items={rows} itemKey={row => row.key} render={renderRow} label="Skupiny" revealIndex={revealKey ? rows.findIndex(row => row.key === revealKey) : undefined}
        storageKey={`repository-group-scroll:${mode}:${query}:${filter}`} />
    </nav>
    <p className="border-t border-border p-2 text-xs text-muted">{index.ordered.length} skupin · {searching || mode === "list" ? rows.length + " ve výběru" : rows.length + " zobrazených umístění"}</p>
  </aside>;
}
