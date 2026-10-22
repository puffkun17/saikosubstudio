import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  // MPA HTML inputs must be scoped to `client` — root build.rollupOptions is
  // inherited by the Worker environment and breaks `vite build`.
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: resolve(root, "index.html"),
            about: resolve(root, "about/index.html"),
            feedback: resolve(root, "feedback/index.html"),
          },
        },
      },
    },
  },
});
