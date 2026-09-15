import { accentPalette } from "./palette";
import { resolveTheme } from "./preferences";
import type { AppearancePreferences } from "./types";

export function applyAppearance(preferences: AppearancePreferences, systemDark: boolean): void {
  const root = document.documentElement;
  const theme = resolveTheme(preferences.mode, systemDark);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  for (const [name, value] of Object.entries(accentPalette(preferences.accent, theme))) root.style.setProperty(name, value);
}
