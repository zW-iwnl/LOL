import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { themeBootstrap } from "./theme-bootstrap-plugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [themeBootstrap(), react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
