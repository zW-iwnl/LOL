import { useEffect, useRef, useState, type ReactNode } from "react";

type Props<T> = { items: T[]; itemKey: (item: T) => string | number; render: (item: T, index: number) => ReactNode;
  rowHeight?: number; label: string; revealIndex?: number; storageKey?: string };
export function VirtualList<T>({ items, itemKey, render, rowHeight = 36, label, revealIndex, storageKey }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 400 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (storageKey) { try { element.scrollTop = Number(sessionStorage.getItem(storageKey) ?? 0); } catch { /* optional persistence */ } }
    const observer = new ResizeObserver(() => setViewport({ top: element.scrollTop, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [storageKey]);
  useEffect(() => {
    const element = ref.current;
    if (element && revealIndex !== undefined && revealIndex >= 0) {
      const top = revealIndex * rowHeight;
      if (top < element.scrollTop || top + rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = top;
    }
  }, [revealIndex, rowHeight]);
  useEffect(() => {
    const element = ref.current;
    if (element && element.scrollTop > Math.max(0, items.length * rowHeight - element.clientHeight)) {
      element.scrollTop = Math.max(0, items.length * rowHeight - element.clientHeight);
      setViewport(current => ({ ...current, top: element.scrollTop }));
    }
  }, [items.length, rowHeight]);
  const start = Math.max(0, Math.floor(viewport.top / rowHeight) - 5);
  const end = Math.min(items.length, Math.ceil((viewport.top + viewport.height) / rowHeight) + 5);
  return <div ref={ref} role="list" aria-label={label} className="workspace-virtual-list" onScroll={event => {
    const top = event.currentTarget.scrollTop;
    setViewport(current => ({ ...current, top }));
    if (storageKey) { try { sessionStorage.setItem(storageKey, String(top)); } catch { /* optional persistence */ } }
  }} onKeyDown={event => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const index = Number((event.target as HTMLElement).closest<HTMLElement>("[data-row-index]")?.dataset.rowIndex);
    if (!Number.isFinite(index) || !items.length) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(items.length - 1, event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1)));
    const element = event.currentTarget;
    if (next * rowHeight < element.scrollTop) element.scrollTop = next * rowHeight;
    else if ((next + 1) * rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = (next + 1) * rowHeight - element.clientHeight;
    setViewport(current => ({ ...current, top: element.scrollTop }));
    requestAnimationFrame(() => element.querySelector<HTMLElement>(`[data-row-index="${next}"] [data-focus-target]`)?.focus());
  }}>
    <div style={{ height: items.length * rowHeight, position: "relative" }}>
      {items.slice(start, end).map((item, relativeIndex) => <div role="listitem" aria-posinset={start + relativeIndex + 1} aria-setsize={items.length}
        key={itemKey(item)} data-row-index={start + relativeIndex} style={{ position: "absolute", top: (start + relativeIndex) * rowHeight, height: rowHeight, width: "100%" }}>
        {render(item, start + relativeIndex)}
      </div>)}
    </div>
    {!items.length && <p className="p-3 text-sm text-slate-500">Žádné odpovídající položky.</p>}
  </div>;
}
