import { isHexColor } from "./preferences";
import { ACCENTS, type Accent, type ResolvedTheme } from "./types";

function channels(hex: string): number[] {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

function luminance(hex: string): number {
  const values = channels(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function contrast(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function mix(first: string, second: string, amount: number): string {
  const other = channels(second);
  return `#${channels(first).map((value, index) => Math.round(value + (other[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function readable(seed: string, backgrounds: string[], target: string, minimum: number): string {
  for (let step = 0; step <= 100; step++) {
    const color = mix(seed, target, step / 100);
    if (backgrounds.every(background => contrast(color, background) >= minimum)) return color;
  }
  throw new Error("Z této barvy nelze vytvořit čitelný vzhled. Vyberte některou z předvoleb.");
}

/** The seed is a hue preference; each actual UI color is checked against its surfaces. */
export function accentPalette(accent: Accent, theme: ResolvedTheme): Record<string, string> {
  const seed = accent.kind === "preset" ? ACCENTS[accent.id].hex : accent.hex;
  if (!isHexColor(seed)) throw new Error("Zadejte barvu ve formátu #RRGGBB.");
  const dark = theme === "dark";
  const surfaces = dark ? ["#0f172a", "#1e293b", "#27364d"] : ["#ffffff", "#f6f8fb", "#f1f5f9"];
  const onAccent = dark ? "#0f172a" : "#ffffff";
  const target = dark ? "#ffffff" : "#000000";
  const fill = readable(seed, [onAccent], target, 4.7);
  const hover = mix(fill, target, 0.14);
  const selected = mix(surfaces[1], seed, dark ? 0.15 : 0.08);
  const link = readable(seed, [...surfaces, selected], target, 4.7);
  return {
    "--ui-accent": fill, "--ui-accent-hover": hover, "--ui-on-accent": onAccent,
    "--ui-link": link, "--ui-link-hover": mix(link, target, 0.15),
    "--ui-selected-bg": selected, "--ui-selected-text": link,
    "--ui-selected-border": link, "--ui-focus": link,
  };
}
