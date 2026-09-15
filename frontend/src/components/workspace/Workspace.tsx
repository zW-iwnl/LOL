import type { CSSProperties, ReactNode } from "react";
export function WorkspacePanels({ navigation, children, width = 300 }: { navigation?: ReactNode; children: ReactNode; width?: number }) {
  return <div className={`workspace-panels ${navigation ? "with-navigation" : ""}`} style={{ "--workspace-navigation-width": `${width}px` } as CSSProperties}>{navigation}{children}</div>;
}
export function Pagination({ total, offset, limit, busy, onChange, onLimit, label = "položek" }: { total: number; offset: number; limit: number; busy?: boolean; onChange: (offset: number) => void; onLimit?: (limit: number) => void; label?: string }) {
  return <div className="workspace-pagination"><span>{total ? offset + 1 : 0}–{Math.min(total, offset + limit)} z {total} {label}</span><div className="flex items-center gap-1">{onLimit && <select aria-label="Položek na stránku" className="workspace-input" value={limit} disabled={busy} onChange={e => onLimit(Number(e.target.value))}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select>}<button type="button" className="workspace-button" disabled={busy || !offset} onClick={() => onChange(Math.max(0, offset - limit))}>Předchozí</button><button type="button" className="workspace-button" disabled={busy || offset + limit >= total} onClick={() => onChange(offset + limit)}>Další</button></div></div>;
}
