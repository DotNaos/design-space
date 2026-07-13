import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { designSpaceApiPlugin, designSpaceTargetPlugin, EditService, loadRegisteredProject, resolveServerProjectRoot } from "./src/server";

const root = import.meta.dirname;

function enforcedPortless(): Plugin {
  return {
    name: "design-space-portless-guard",
    apply: "serve",
    configResolved() {
      if (process.env.DESIGN_SPACE_VIA_PORTLESS !== "1" && process.env.DESIGN_SPACE_ALLOW_DIRECT !== "1") {
        throw new Error("Direct Vite startup is blocked. Run `bun run dev` through Portless.");
      }
    },
  };
}

export default defineConfig(async () => {
  const registeredTarget = await loadRegisteredProject(
    resolveServerProjectRoot(resolve(root, "examples/demo-target")),
  );
  const api = new EditService(registeredTarget);

  return {
    plugins: [
      enforcedPortless(),
      designSpaceTargetPlugin(registeredTarget),
      designSpaceApiPlugin(api),
      react(),
      tailwindcss(),
    ],
    server: {
      host: "127.0.0.1",
      port: process.env.PORT ? Number(process.env.PORT) : 4173,
      strictPort: true,
    },
    build: { sourcemap: true },
  };
});
