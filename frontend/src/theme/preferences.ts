import { ACCENTS, DEFAULT_APPEARANCE, type AppearancePreferences, type ResolvedTheme, type ThemeMode } from "./types";

export const APPEARANCE_KEY = "fet:appearance:v1";
export const isHexColor = (value: string): boolean => /^#[\da-f]{6}$/i.test(value);
export const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark" || value === "system";

export function parseAppearance(value: unknown): AppearancePreferences {
  if (!value || typeof value !== "object") return DEFAULT_APPEARANCE;
  const candidate = value as Partial<AppearancePreferences>;
  if (candidate.version !== 1 || !isThemeMode(candidate.mode)) return DEFAULT_APPEARANCE;
  const accent = candidate.accent;
  if (accent?.kind === "preset" && Object.hasOwn(ACCENTS, accent.id)) {
    return { version: 1, mode: candidate.mode, accent: { kind: "preset", id: accent.id } };
  }
  if (accent?.kind === "custom" && typeof accent.hex === "string" && isHexColor(accent.hex)) {
    return { version: 1, mode: candidate.mode, accent: { kind: "custom", hex: accent.hex.toUpperCase() } };
  }
  return DEFAULT_APPEARANCE;
}

export function readAppearance(): AppearancePreferences {
  try { return parseAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? "null")); }
  catch { return DEFAULT_APPEARANCE; }
}

export function writeAppearance(preferences: AppearancePreferences): boolean {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(parseAppearance(preferences))); return true; }
  catch { return false; }
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  return mode === "system" ? systemDark ? "dark" : "light" : mode;
}
