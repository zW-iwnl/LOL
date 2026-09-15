import { applyAppearance } from "./apply";
import { readAppearance } from "./preferences";

// Bundled into a synchronous head script by Vite, before CSS/modules can paint.
applyAppearance(readAppearance(), window.matchMedia("(prefers-color-scheme: dark)").matches);
