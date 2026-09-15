import { useState } from "react";
import type { ReviewDetail } from "../../api/testCaseWorkflow";
import { changeLabel } from "./ReviewDiff";
export function ReviewComments({ review, body, field, blocking, busy, onBody, onField, onBlocking, onAdd, onResolve, onChange }: {
  review: ReviewDetail; body: string; field: string; blocking: boolean; busy: boolean;
  onBody: (value: string) => void; onField: (value: string) => void; onBlocking: (value: boolean) => void; onAdd: () => void; onResolve: (id: number) => void; onChange: (field: string) => void;
}) {
  const [openOnly, setOpenOnly] = useState(true);
  const caps = review.capabilities;
  return <div className="space-y-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} />Jen otevřené připomínky</label>
    {review.comments.filter(c => !openOnly || !c.resolved_at).map(c => <article key={c.id} className={`rounded border p-3 text-sm ${c.is_blocking && !c.resolved_at ? "border-warning-border bg-warning-bg" : "border-border"}`}><div className="flex flex-wrap justify-between gap-1 text-xs text-muted"><span>{c.author_name ?? `Uživatel #${c.author_id}`} · {c.is_blocking ? "Blokující" : "Poznámka"} · {c.resolved_at ? "Vyřešeno" : "Otevřeno"}</span>{c.field_path && <button type="button" className="text-link" onClick={() => onChange(c.field_path!)}>Zobrazit změnu</button>}</div><p className="my-2 whitespace-pre-wrap break-words">{c.body}</p>{caps?.resolvable_comment_ids.includes(c.id) && <button type="button" className="workspace-button" disabled={busy} onClick={() => onResolve(c.id)}>Označit jako vyřešené</button>}</article>)}
    {!review.comments.some(c => !openOnly || !c.resolved_at) && <p className="text-sm text-muted">Žádné {openOnly ? "otevřené " : ""}připomínky.</p>}
    {caps?.can_comment && <form onSubmit={event => { event.preventDefault(); onAdd(); }} className="space-y-2 border-t pt-3"><label className="block text-xs">Připomínka<textarea aria-label="Připomínka" id="review-comment-body" className="workspace-input mt-1 w-full" rows={3} required maxLength={10000} disabled={busy} value={body} onChange={e => onBody(e.target.value)} /></label>
      <label className="block text-xs">Ke změně<select className="workspace-input ml-2 max-w-full" value={field} disabled={busy} onChange={e => onField(e.target.value)}><option value="">Celý scénář</option>{review.changes.map(c => <option key={c.field} value={c.field}>{changeLabel(c.field, c.before, c.after)}</option>)}</select></label>
      {caps.can_block && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={blocking} disabled={busy} onChange={e => onBlocking(e.target.checked)} />Blokuje schválení</label>}<button type="submit" className="workspace-button" disabled={busy || !body.trim()}>Přidat připomínku</button>
    </form>}
  </div>;
}
