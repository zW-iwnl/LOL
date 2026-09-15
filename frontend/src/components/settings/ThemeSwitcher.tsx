import { useTheme } from "../../theme/ThemeProvider";
import { THEME_LABELS, type ThemeMode } from "../../theme/types";

export function ThemeSwitcher() {
  const { preferences, save, storageWarning } = useTheme();
  return <div className="text-xs">
    <select aria-label="Režim vzhledu" className="workspace-input max-w-36" value={preferences.mode}
      onChange={event => save({ ...preferences, mode: event.target.value as ThemeMode })}>
      {Object.entries(THEME_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
    </select>
    {storageWarning && <p role="status" className="mt-1 max-w-48 text-warning">Vzhled platí jen do zavření stránky; uložení není dostupné.</p>}
  </div>;
}
