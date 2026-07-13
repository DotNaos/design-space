import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "dist-production"),
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/production.tsx"),
      formats: ["es"],
      fileName: "target-production",
    },
  },
});
