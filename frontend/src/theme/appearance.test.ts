import { afterEach, describe, expect, it, vi } from "vitest";
import css from "./tokens.css?raw";
import { accentPalette, contrast } from "./palette";
import { APPEARANCE_KEY, parseAppearance, readAppearance, resolveTheme, writeAppearance } from "./preferences";
import { DEFAULT_APPEARANCE } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("appearance preferences", () => {
  it("rejects malformed, unsupported and CSS-injecting preferences", () => {
    for (const value of [null, [], { version: 2 }, { ...DEFAULT_APPEARANCE, mode: "sepia" },
      { ...DEFAULT_APPEARANCE, accent: { kind: "preset", id: "toString" } },
      { ...DEFAULT_APPEARANCE, accent: { kind: "custom", hex: "red; color: transparent" } },
      { ...DEFAULT_APPEARANCE, accent: { kind: "custom", hex: "#fff" } }]) {
      expect(parseAppearance(value)).toEqual(DEFAULT_APPEARANCE);
    }
    expect(parseAppearance({ version: 1, mode: "dark", accent: { kind: "custom", hex: "#ff00aa" } })).toEqual({ version: 1, mode: "dark", accent: { kind: "custom", hex: "#FF00AA" } });
  });

  it("survives blocked storage access and corrupt JSON", () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } });
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(writeAppearance(DEFAULT_APPEARANCE)).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => "{broken" });
    expect(readAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("persists only validated preferences and resolves system independently", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    expect(writeAppearance({ ...DEFAULT_APPEARANCE, mode: "dark" })).toBe(true);
    expect(values.has(APPEARANCE_KEY)).toBe(true);
    expect(readAppearance().mode).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("readable custom accents", () => {
  const tokenSets = Object.fromEntries((["light", "dark"] as const).map(mode => {
    const block = css.split(`[data-theme="${mode}"] {`)[1].split("}")[0];
    return [mode, Object.fromEntries(Array.from(block.matchAll(/--ui-([\w-]+): (#[\da-f]+);/gi)).map(match => [match[1], match[2]]))];
  }));
  it("uses the WCAG contrast formula", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
    expect(contrast("#0e7490", "#ffffff")).toBeCloseTo(5.36, 2);
  });

  // Includes black, white, yellow, red, grays and saturated/near-white colors.
  const seeds = ["#0e7490", "#2563eb", "#7c3aed"];
  for (const red of [0, 51, 102, 153, 204, 255]) for (const green of [0, 51, 102, 153, 204, 255]) for (const blue of [0, 51, 102, 153, 204, 255]) {
    seeds.push(`#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`);
  }
  for (const mode of ["light", "dark"] as const) it(`keeps text, hover and selection readable for ${seeds.length} seeds in ${mode}`, () => {
    const surfaces = mode === "dark" ? ["#0f172a", "#1e293b", "#27364d"] : ["#ffffff", "#f6f8fb", "#f1f5f9"];
    for (const hex of seeds) {
      const p = accentPalette({ kind: "custom", hex }, mode);
      const tokens = tokenSets[mode];
      for (const status of ["success", "danger", "warning", "skipped", "not-run"]) {
        for (const background of [...surfaces, p["--ui-selected-bg"]]) expect(contrast(tokens[status], background), `${mode} ${hex} ${status}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const key of ["--ui-accent", "--ui-accent-hover"]) expect(contrast(p[key], p["--ui-on-accent"]), `${mode} ${hex} ${key}`).toBeGreaterThanOrEqual(4.5);
      for (const background of [...surfaces, p["--ui-selected-bg"]]) {
        expect(contrast(p["--ui-link"], background), `${mode} ${hex} link`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--ui-link-hover"], background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--ui-focus"], background)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("does not inject arbitrary CSS from an invalid color", () => {
    expect(() => accentPalette({ kind: "custom", hex: "url(https://example.com)" }, "light")).toThrow();
  });
});
