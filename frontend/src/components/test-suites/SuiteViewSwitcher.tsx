import { Folder, Layers3, ListTree, Network } from "lucide-react";
import type { SuiteViewMode } from "./useSuiteViewState";

const options: Array<{ value: SuiteViewMode; label: string; icon: typeof ListTree }> = [
  { value: "tree", label: "Strom", icon: ListTree },
  { value: "folders", label: "Složky", icon: Folder },
  { value: "mind-map", label: "Myšlenková mapa", icon: Network },
  { value: "groups", label: "Skupiny", icon: Layers3 },
];

export function SuiteViewSwitcher({
  value,
  onChange,
}: {
  value: SuiteViewMode;
  onChange: (value: SuiteViewMode) => void;
}) {
  return (
    <>
      <label className="md:hidden">
        <span className="sr-only">Zobrazení test suit</span>
        <select
          aria-label="Zobrazení test suit"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value as SuiteViewMode)}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="hidden rounded-md border border-slate-200 bg-slate-50 p-1 md:flex" aria-label="Zobrazení test suit">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          return (
            <button
              key={option.value}
              aria-pressed={active}
              className={[
                "inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition",
                active ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600 hover:bg-white/70",
              ].join(" ")}
              title={option.label}
              type="button"
              onClick={() => onChange(option.value)}
            >
              <Icon size={16} /> {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
