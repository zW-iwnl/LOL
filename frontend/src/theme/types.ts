export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemeMode, "system">;
export type Accent = { kind: "preset"; id: "cyan" | "blue" | "violet" } | { kind: "custom"; hex: string };
export type AppearancePreferences = { version: 1; mode: ThemeMode; accent: Accent };

export const DEFAULT_APPEARANCE: AppearancePreferences = { version: 1, mode: "system", accent: { kind: "preset", id: "cyan" } };
export const ACCENTS = { cyan: { label: "Tyrkysová", hex: "#0E7490" }, blue: { label: "Modrá", hex: "#2563EB" }, violet: { label: "Fialová", hex: "#7C3AED" } };
export const THEME_LABELS: Record<ThemeMode, string> = { light: "Světlý", dark: "Tmavý", system: "Podle systému" };
