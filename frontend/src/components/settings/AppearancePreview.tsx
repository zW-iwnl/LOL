import { useState, type CSSProperties } from "react";
import { accentPalette } from "../../theme/palette";
import type { Accent, ResolvedTheme } from "../../theme/types";

export function AppearancePreview({ accent, mode }: { accent: Accent; mode: ResolvedTheme }) {
  const [selected, setSelected] = useState("passed");
  const [checked, setChecked] = useState(true);
  return <section aria-label={`${mode === "dark" ? "Tmavý" : "Světlý"} náhled`} data-theme={mode} style={accentPalette(accent, mode) as CSSProperties}
    className="appearance-preview min-w-0 rounded-lg border border-border p-4">
    <h3 className="mb-3 text-sm font-semibold">{mode === "dark" ? "Tmavý" : "Světlý"} náhled</h3>
    <div className="space-y-4 rounded-md border border-border bg-surface p-4">
      <div><strong className="text-sm">Regrese plateb</strong><p className="text-xs text-muted">QA-123 · TEST · Vyhodnoceno 12/30</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="workspace-button workspace-primary">Primární akce</button><button type="button" className="workspace-button">Běžná akce</button><button type="button" className="workspace-button" disabled>Nedostupné</button></div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Zahrnout test</label>
        <label>Prostředí<select className="workspace-input ml-2" defaultValue="TEST"><option>TEST</option><option>UAT</option></select></label>
        <button type="button" className="text-link underline">Detail testu</button>
      </div>
      <input aria-label={`Hledání – ${mode === "dark" ? "tmavý" : "světlý"} náhled`} className="workspace-input w-full" placeholder="Hledat test…" />
      <div className="overflow-hidden rounded border border-border text-xs">
        <div className="bg-surface-muted px-3 py-2 text-muted">Test · Výsledek</div>
        <button type="button" aria-pressed="true" className="workspace-selected w-full border-l-4 px-3 py-2 text-left">TC-12 · Ověření platby – vybráno</button>
        <div className="px-3 py-2">TC-15 · Ověření storna</div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ukázka výsledků">
        {[
          ["passed", "✓ Úspěšné", "text-success"], ["failed", "✕ Neúspěšné", "text-danger"],
          ["blocked", "⊘ Blokované", "text-warning"], ["skipped", "– Přeskočené", "text-skipped"],
          ["not_run", "○ Neprovedené", "text-not-run"],
        ].map(([value, label, color]) => <button type="button" key={value} className={`workspace-button ${color}`} aria-pressed={selected === value} onClick={() => setSelected(value)}>{label}</button>)}
      </div>
      <p className="rounded border border-danger-border bg-danger-bg p-2 text-xs text-danger">Ukázka chyby: Vyplňte název testu.</p>
    </div>
  </section>;
}
