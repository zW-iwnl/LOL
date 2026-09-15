import { useState, type FormEvent } from "react";
import { useRepositoryPreference } from "./useRepositoryPreference";
import type { SuiteGroup } from "../../api/client";

export function GroupMetadataForm({ group, busy, onSave }: { group: SuiteGroup; busy: boolean; onSave: (name: string, description: string, order: number) => Promise<boolean> }) {
  const [draft, setDraft] = useRepositoryPreference<{ name: string; description: string; order: number } | null>(`groupDraft:${group.id}`, null);
  const values = draft ?? { name: group.name, description: group.description ?? "", order: group.sort_order };
  const { name, description, order } = values;
  const setName = (name: string) => setDraft({ ...values, name });
  const setDescription = (description: string) => setDraft({ ...values, description });
  const setOrder = (order: number) => setDraft({ ...values, order });
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) { setError("Vyplňte název skupiny."); return; }
    if (!Number.isInteger(order) || order < 0) { setError("Pořadí musí být celé nezáporné číslo."); return; }
    setError(null); if (await onSave(name.trim(), description, order)) setDraft(null);
  }
  return <form onSubmit={event => void submit(event)} className="max-w-2xl space-y-3 text-sm">
    <p className="text-xs text-muted">Skupina #{group.id} · změny názvu a popisu se projeví ve všech jejích umístěních.</p>
    {draft && <p className="text-xs text-warning">Rozepsané změny jsou uložené v tomto prohlížeči. <button type="button" className="underline" disabled={busy} onClick={() => setDraft(null)}>Zahodit změny</button></p>}
    <label className="block">Název skupiny<input className="workspace-input mt-1 w-full" required maxLength={200} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
    <label className="block">Popis skupiny<textarea className="workspace-input mt-1 w-full" rows={3} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} /></label>
    <label className="block">Pořadí<input type="number" min={0} step={1} className="workspace-input ml-2 w-24" value={order} disabled={busy} onChange={event => setOrder(Number(event.target.value))} /></label>
    {error && <p role="alert" className="text-danger">{error}</p>}<button className="workspace-button workspace-primary" type="submit" disabled={busy}>{busy ? "Ukládám…" : "Uložit skupinu"}</button>
    <div className="border-t pt-3"><h3 className="font-medium">Tagy v obsahu skupiny</h3><div className="mt-2 flex flex-wrap gap-1">{group.tags.map(tag => <span key={tag.id} className="rounded bg-surface-muted px-2 py-1 text-xs">{tag.name} ({tag.test_case_count})</span>)}{!group.tags.length && <p className="text-xs text-muted">Obsah skupiny zatím nemá tagy.</p>}</div></div>
  </form>;
}
