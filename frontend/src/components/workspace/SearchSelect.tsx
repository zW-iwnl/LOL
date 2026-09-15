import { useState } from "react";
import { VirtualList } from "../workspace/VirtualList";
import { normalizeSearch } from "../test-runs/selection";
export function SearchSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: number; name: string }[]; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = options.filter(item => normalizeSearch(`${item.id} ${item.name}`).includes(normalizeSearch(query)));
  return <details className="repository-filter-details min-w-0"><summary className="workspace-button w-full cursor-pointer truncate" title={label}>{label}: {options.find(item => String(item.id) === value)?.name ?? (value ? `#${value}` : "Vše")}</summary><div className="repository-filter-popover left-0 right-auto w-72 max-w-[80vw] !max-h-none"><input className="workspace-input w-full" type="search" aria-label={`Hledat: ${label}`} value={query} onChange={e => setQuery(e.target.value)} /><button type="button" className="workspace-button my-2" onClick={e => { onChange(""); e.currentTarget.closest("details")!.open = false; }}>Zrušit filtr</button><div className="h-48"><VirtualList label={label} items={filtered} itemKey={item => item.id} render={item => <button type="button" data-focus-target className="repository-picker-row truncate" onClick={e => { onChange(String(item.id)); e.currentTarget.closest("details")!.open = false; }}>{item.name}</button>} /></div></div></details>;
}
