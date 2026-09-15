import type { LucideIcon } from "lucide-react";

type WorkflowTab = { id: string; label: string; icon: LucideIcon };

/** Same segmented navigation treatment as the Repository workspace. */
export function WorkflowTabs({ label, tabs, value, onChange }: {
  label: string;
  tabs: WorkflowTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return <nav aria-label={label} className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface p-1 sm:flex sm:flex-wrap">
    {tabs.map(({ id, label: title, icon: Icon }) => <button
      key={id}
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${value === id ? "bg-selected-bg font-medium text-link" : "text-muted hover:bg-surface-muted"}`}
    ><Icon size={16} aria-hidden="true" />{title}</button>)}
  </nav>;
}
