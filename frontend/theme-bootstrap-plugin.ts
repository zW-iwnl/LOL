import { resolve } from "node:path";
import { build, type Plugin } from "vite";

/** One source for early paint, the provider, and palette tests. No checked-in bundle. */
export function themeBootstrap(): Plugin {
  let script: Promise<string> | undefined;
  function bundle() {
    return script ??= build({
      configFile: false, logLevel: "silent",
      build: { write: false, emptyOutDir: false, minify: true,
        lib: { entry: resolve(import.meta.dirname, "src/theme/bootstrap.ts"), name: "FetAppearance", formats: ["iife"] } },
    }).then(result => {
      const outputs = Array.isArray(result) ? result : [result];
      for (const output of outputs) if ("output" in output) {
        const chunk = output.output.find(item => item.type === "chunk");
        if (chunk?.type === "chunk") return chunk.code;
      }
      throw new Error("Appearance bootstrap was not generated");
    });
  }
  return {
    name: "fet-theme-bootstrap",
    configureServer(server) { server.watcher.on("change", path => { if (path.replaceAll("\\", "/").includes("/src/theme/")) script = undefined; }); },
    transformIndexHtml: { order: "pre", async handler(html) {
      // Keep the charset declaration first and execute before module scripts/CSS paint.
      return html.replace("<!-- appearance-bootstrap -->", `<script id="appearance-bootstrap">${await bundle()}</script>`);
    } },
  };
}
