import type { Page } from "@playwright/test";

/** Checks opaque text in the rendered viewport, including alpha-composited surfaces.
 * Complements screenshots; it deliberately excludes disabled/hidden elements. */
export async function textContrastIssues(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((x, i) => i === 3 ? x / 255 : x);
    };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
    const issues: { text: string; ratio: number; foreground: string; background: number[]; className: string }[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (["SCRIPT", "STYLE", "OPTION", "SVG"].includes(element.tagName) || element.closest("[disabled], [aria-disabled=true], [inert], [aria-hidden=true]")) continue;
      const text = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("").trim();
      const rect = element.getBoundingClientRect();
      if (!text || !rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== "visible") continue;
      const ancestry: HTMLElement[] = [];
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) ancestry.push(ancestor);
      if (ancestry.some(ancestor => Number(getComputedStyle(ancestor).opacity) < 1)) continue;
      let bg = [255, 255, 255];
      for (const ancestor of ancestry.reverse()) {
        const color = rgba(getComputedStyle(ancestor).backgroundColor);
        bg = bg.map((channel, i) => color[i] * color[3] + channel * (1 - color[3]));
      }
      const fg = rgba(style.color), a = luminance(fg), b = luminance(bg);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const size = parseFloat(style.fontSize);
      const minimum = size >= 24 || size >= 18.67 && Number(style.fontWeight) >= 700 ? 3 : 4.5;
      if (fg[3] === 1 && ratio < minimum) issues.push({ text: text.slice(0, 70), ratio: Math.round(ratio * 100) / 100, foreground: style.color, background: bg, className: element.className });
    }
    return issues;
  });
}
