import { ArrowDown, ArrowUp, Layers3, Plus, Save, Search, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  createSuiteGroup,
  deleteSuiteGroup,
  updateSuiteGroup,
  updateSuiteGroupMember,
  type SuiteGroup,
  type TestSuite,
} from "../../api/client";
import { buildSuiteGroupIndex, getSuiteGroupDescendantIds } from "./suiteGroups";

type GroupForm = {
  name: string;
  description: string;
  parentGroupId: string;
  sortOrder: string;
};

const emptyForm: GroupForm = {
  name: "",
  description: "",
  parentGroupId: "",
  sortOrder: "0",
};

export function SuiteGroupManager({
  groups,
  suites,
  onChanged,
}: {
  groups: SuiteGroup[];
  suites: TestSuite[];
  onChanged: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [parentQuery, setParentQuery] = useState("");
  const index = useMemo(() => buildSuiteGroupIndex(groups), [groups]);
  const editing = editingId === null ? null : index.byId.get(editingId) ?? null;
  const forbiddenParentIds = editing ? getSuiteGroupDescendantIds(index, editing.id) : new Set<number>();
  if (editing) forbiddenParentIds.add(editing.id);
  const parentOptions = groups.filter((group) => !forbiddenParentIds.has(group.id));
  const normalizedParentQuery = parentQuery.trim().toLocaleLowerCase("cs");
  const filteredParentOptions = normalizedParentQuery
    ? parentOptions.filter((group) => group.name.toLocaleLowerCase("cs").includes(normalizedParentQuery))
    : parentOptions;
  const suiteById = new Map(suites.map((suite) => [suite.id, suite]));
  const selectedMembers = editing
    ? [...editing.members].sort((left, right) => left.sort_order - right.sort_order || left.suite_id - right.suite_id)
    : [];

  function startCreate(parentGroupId: number | null = null) {
    setEditingId(null);
    setForm({ ...emptyForm, parentGroupId: parentGroupId?.toString() ?? "" });
    setError(null);
    setParentQuery("");
  }

  function startEdit(group: SuiteGroup) {
    setEditingId(group.id);
    setForm({
      name: group.name,
      description: group.description ?? "",
      parentGroupId: group.parent_group_id?.toString() ?? "",
      sortOrder: String(group.sort_order),
    });
    setError(null);
    setParentQuery("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      parent_group_id: form.parentGroupId ? Number(form.parentGroupId) : null,
      sort_order: Number(form.sortOrder) || 0,
    };
    try {
      if (editing) await updateSuiteGroup(editing.id, payload);
      else await createSuiteGroup(payload);
      setEditingId(null);
      setForm(emptyForm);
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skupinu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing || !window.confirm(`Smazat skupinu „${editing.name}“? Test suity zůstanou zachované.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSuiteGroup(editing.id);
      setEditingId(null);
      setForm(emptyForm);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Skupinu se nepodařilo smazat.");
    } finally {
      setSaving(false);
    }
  }

  async function moveMember(index: number, direction: -1 | 1) {
    if (!editing) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedMembers.length) return;
    const reordered = [...selectedMembers];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        reordered.map((member, sortOrder) => updateSuiteGroupMember(
          editing.id,
          member.suite_id,
          sortOrder,
        )),
      );
      await onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Pořadí suit se nepodařilo změnit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Layers3 size={18} /> Skupiny suit</h2>
        <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50" type="button" onClick={() => startCreate()}><Plus size={14} /> Nová</button>
      </div>
      <div className="mt-3 max-h-56 overflow-auto rounded-md border border-slate-200 p-1">
        {index.roots.map((group) => (
          <GroupRow key={group.id} group={group} depth={0} index={index} selectedId={editingId} onSelect={startEdit} onCreateChild={(parentId) => startCreate(parentId)} />
        ))}
        {index.roots.length === 0 && <p className="p-3 text-xs text-slate-500">Zatím nebyla vytvořena žádná skupina.</p>}
      </div>

      {editing && selectedMembers.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Pořadí suit ve skupině</h3>
          <div className="space-y-1">
            {selectedMembers.map((member, memberIndex) => (
              <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm" key={member.suite_id}>
                <span className="min-w-0 flex-1 truncate">{suiteById.get(member.suite_id)?.name ?? `Suite #${member.suite_id}`}</span>
                <button className="grid h-7 w-7 place-items-center rounded hover:bg-white disabled:opacity-30" disabled={saving || memberIndex === 0} title="Posunout nahoru" type="button" onClick={() => void moveMember(memberIndex, -1)}><ArrowUp size={14} /></button>
                <button className="grid h-7 w-7 place-items-center rounded hover:bg-white disabled:opacity-30" disabled={saving || memberIndex === selectedMembers.length - 1} title="Posunout dolů" type="button" onClick={() => void moveMember(memberIndex, 1)}><ArrowDown size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="mt-4 space-y-3 border-t border-slate-200 pt-4" onSubmit={(event) => void handleSubmit(event)}>
        <h3 className="text-sm font-semibold">{editing ? "Upravit skupinu" : form.parentGroupId ? "Nová podskupina" : "Nová skupina"}</h3>
        {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        <label className="block text-sm"><span className="font-medium">Název</span><input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="block text-sm">
          <span className="font-medium">Nadřazená skupina</span>
          <span className="relative mt-1 block"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input aria-label="Hledat nadřazenou skupinu" className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3" placeholder="Hledat skupinu" type="search" value={parentQuery} onChange={(event) => setParentQuery(event.target.value)} /></span>
          <select className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" value={form.parentGroupId} onChange={(event) => setForm({ ...form, parentGroupId: event.target.value })}><option value="">Kořenová úroveň</option>{filteredParentOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
        </label>
        <label className="block text-sm"><span className="font-medium">Popis</span><textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 px-3 py-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="block text-sm"><span className="font-medium">Řazení</span><input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" min={0} type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></label>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving || !form.name.trim()} type="submit"><Save size={15} /> {saving ? "Ukládám…" : "Uložit"}</button>
          {editing && <button className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={saving} type="button" onClick={() => void handleDelete()}><Trash2 size={15} /> Smazat</button>}
        </div>
      </form>
    </section>
  );
}

function GroupRow({ group, depth, index, selectedId, onSelect, onCreateChild }: { group: SuiteGroup; depth: number; index: ReturnType<typeof buildSuiteGroupIndex>; selectedId: number | null; onSelect: (group: SuiteGroup) => void; onCreateChild: (parentId: number) => void }) {
  const children = index.childrenByParentId.get(group.id) ?? [];
  return (
    <div>
      <div className={selectedId === group.id ? "flex items-center rounded bg-cyan-50 text-cyan-800" : "flex items-center rounded hover:bg-slate-50"} style={{ paddingLeft: depth * 14 }}>
        <button className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm" type="button" onClick={() => onSelect(group)}>{group.name} <span className="text-xs text-slate-400">({group.members.length})</span></button>
        <button className="grid h-7 w-7 place-items-center text-slate-500 hover:text-cyan-700" title="Přidat podskupinu" type="button" onClick={() => onCreateChild(group.id)}><Plus size={13} /></button>
      </div>
      {children.map((child) => <GroupRow key={child.id} group={child} depth={depth + 1} index={index} selectedId={selectedId} onSelect={onSelect} onCreateChild={onCreateChild} />)}
    </div>
  );
}
