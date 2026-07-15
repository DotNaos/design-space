import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "target-production-boundary",
      generateBundle(_options, bundle) {
        const designSpaceSource = `${resolve(import.meta.dirname, "../../src").replaceAll("\\", "/")}/`;
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          const leaked = Object.keys(output.modules).find((id) => {
            const normalized = id.replaceAll("\\", "/");
            return normalized.startsWith(designSpaceSource) || /design-space\.(?:config|server)/.test(normalized);
          });
          if (leaked) throw new Error(`Development-only module entered the target build: ${leaked}`);
        }
      },
    },
  ],
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
