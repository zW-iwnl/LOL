import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { applyAppearance } from "./apply";
import { APPEARANCE_KEY, parseAppearance, readAppearance, resolveTheme, writeAppearance } from "./preferences";
import { accentPalette } from "./palette";
import type { AppearancePreferences, ResolvedTheme } from "./types";

type ThemeContextValue = {
  preferences: AppearancePreferences;
  resolvedTheme: ResolvedTheme;
  save: (preferences: AppearancePreferences) => boolean;
  storageWarning: boolean;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readAppearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [storageWarning, setStorageWarning] = useState(false);

  useLayoutEffect(() => { applyAppearance(preferences, systemDark); }, [preferences, systemDark]);
  useEffect(() => {
    if (preferences.mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const change = () => setSystemDark(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [preferences.mode]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_KEY && event.key !== null) return;
      setSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      setPreferences(readAppearance());
      setStorageWarning(false);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function save(value: AppearancePreferences) {
    const validated = parseAppearance(value);
    // Check both modes before persisting a palette, including system mode.
    accentPalette(validated.accent, "light");
    accentPalette(validated.accent, "dark");
    const persisted = writeAppearance(validated);
    setSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    setPreferences(validated);
    setStorageWarning(!persisted);
    return persisted;
  }

  return <ThemeContext.Provider value={{ preferences, resolvedTheme: resolveTheme(preferences.mode, systemDark), save, storageWarning }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
