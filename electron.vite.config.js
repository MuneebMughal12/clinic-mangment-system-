import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(root, "electron/main.js") } },
    },
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(root, "electron/preload.js") } },
    },
  },
  renderer: {
    root: resolve(root, "frontend"),
    plugins: [react()],
    server: {
      host: "127.0.0.1",
    },
    build: {
      rollupOptions: { input: { index: resolve(root, "frontend/index.html") } },
    },
  },
});
