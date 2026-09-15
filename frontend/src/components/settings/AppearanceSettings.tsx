import { useEffect, useState } from "react";
import { useTheme } from "../../theme/ThemeProvider";
import { isHexColor } from "../../theme/preferences";
import { DEFAULT_APPEARANCE, THEME_LABELS, type ThemeMode } from "../../theme/types";
import { AccentPicker } from "./AccentPicker";
import { AppearancePreview } from "./AppearancePreview";

export function AppearanceSettings() {
  const { preferences, resolvedTheme, save } = useTheme();
  const [draft, setDraft] = useState(preferences);
  const savedKey = JSON.stringify(preferences);
  const [baseKey, setBaseKey] = useState(savedKey);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== baseKey;
  const conflict = savedKey !== baseKey && dirty;
  const invalid = draft.accent.kind === "custom" && !isHexColor(draft.accent.hex);
  const previewAccent = invalid ? preferences.accent : draft.accent;

  useEffect(() => {
    if (savedKey === baseKey || dirty) return;
    setDraft(preferences); setBaseKey(savedKey);
  }, [savedKey, baseKey, dirty, preferences]);

  function resetToSaved() {
    setDraft(preferences); setBaseKey(savedKey); setMessage("");
  }

  return <section aria-labelledby="appearance-title" className="space-y-5 rounded-md border border-border bg-surface p-4 md:p-5">
    <div><h2 id="appearance-title" className="text-lg font-semibold">Vzhled aplikace</h2><p className="mt-1 text-sm text-muted">Ukládá se v tomto prohlížeči a platí pro všechny účty na tomto zařízení. Mezi zařízeními se nesynchronizuje.</p></div>
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      if (invalid) return;
      try {
        const persisted = save(draft);
        const normalized = { ...draft, accent: draft.accent.kind === "custom" ? { ...draft.accent, hex: draft.accent.hex.toUpperCase() } : draft.accent };
        setDraft(normalized); setBaseKey(JSON.stringify(normalized));
        setMessage(persisted ? "Vzhled byl uložen." : "Vzhled je použitý, ale nelze ho uložit. Platí jen do zavření stránky.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Vzhled se nepodařilo uložit."); }
    }}>
      <fieldset><legend className="mb-2 text-sm font-semibold">Režim</legend><div className="flex flex-wrap gap-4">
        {Object.entries(THEME_LABELS).map(([mode, label]) => <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name="appearance-mode" checked={draft.mode === mode} onChange={() => { setDraft({ ...draft, mode: mode as ThemeMode }); setMessage(""); }} />{label}</label>)}
      </div><p className="mt-2 text-xs text-muted">Aktuální vzhled: {THEME_LABELS[resolvedTheme]}. Změny se použijí po uložení.</p></fieldset>
      <AccentPicker value={draft.accent} onChange={accent => { setDraft({ ...draft, accent }); setMessage(""); }} />
      <div><h3 className="mb-3 text-sm font-semibold">Náhled obou režimů</h3><div className="grid gap-4 xl:grid-cols-2"><AppearancePreview accent={previewAccent} mode="light" /><AppearancePreview accent={previewAccent} mode="dark" /></div></div>
      {conflict && <div role="alert" className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning">Uložený vzhled se mezitím změnil v jiné kartě nebo v horní liště. Váš návrh zůstal zachovaný. <button type="button" className="underline" onClick={resetToSaved}>Načíst uložený vzhled</button></div>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
        <button type="button" className="workspace-button" onClick={() => { setDraft(DEFAULT_APPEARANCE); setMessage("Výchozí hodnoty jsou připravené v náhledu. Potvrďte je uložením."); }}>Obnovit výchozí</button>
        <div className="flex flex-wrap gap-2"><button type="button" className="workspace-button" onClick={resetToSaved}>Zrušit změny</button><button type="submit" disabled={invalid} className="workspace-button workspace-primary">{conflict ? "Uložit své změny" : "Uložit vzhled"}</button></div>
      </div>
    </form>
  </section>;
}
