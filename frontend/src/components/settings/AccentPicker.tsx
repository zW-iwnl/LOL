import { ACCENTS, type Accent } from "../../theme/types";
import { isHexColor } from "../../theme/preferences";

export function AccentPicker({ value, onChange }: { value: Accent; onChange: (value: Accent) => void }) {
  const custom = value.kind === "custom";
  const hex = custom ? value.hex : ACCENTS[value.id].hex;
  const invalid = custom && !isHexColor(hex);
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-semibold">Akcentová barva</legend>
    <div className="flex flex-wrap gap-2">
      {Object.entries(ACCENTS).map(([id, preset]) => <label key={id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
        <input type="radio" name="appearance-accent" checked={!custom && value.id === id} onChange={() => onChange({ kind: "preset", id: id as keyof typeof ACCENTS })} />
        <span className="h-4 w-4 rounded-full border border-control" style={{ backgroundColor: preset.hex }} aria-hidden="true" />{preset.label}
      </label>)}
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
        <input type="radio" name="appearance-accent" checked={custom} onChange={() => onChange({ kind: "custom", hex })} />Vlastní
      </label>
    </div>
    {custom && <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Výběr barvy<input aria-label="Výběr vlastní barvy" type="color" className="mt-1 block h-10 w-16 cursor-pointer rounded border border-control bg-surface p-1" value={isHexColor(hex) ? hex : "#0e7490"} onChange={event => onChange({ kind: "custom", hex: event.target.value.toUpperCase() })} /></label>
        <label className="text-sm">HEX barva<input className="mt-1 block w-36 rounded border border-control bg-surface px-3 py-2 font-mono text-sm" value={hex} spellCheck={false} maxLength={7} placeholder="#0E7490" aria-invalid={invalid} aria-describedby={invalid ? "accent-error" : "accent-help"} onChange={event => onChange({ kind: "custom", hex: event.target.value })} /></label>
      </div>
      {invalid && <p id="accent-error" role="alert" className="text-sm text-danger">Zadejte barvu ve formátu #RRGGBB, například #2563EB.</p>}
    </div>}
    <p id="accent-help" className="text-xs text-muted">Odstíny tlačítek, odkazů a výběru se přizpůsobí čitelnosti v obou režimech. Význam barev výsledků zůstává zachovaný.</p>
  </fieldset>;
}
