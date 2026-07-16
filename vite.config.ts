import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import {
  designSpaceApiPlugin,
  designSpaceTargetPlugin,
  DocumentService,
  EditService,
  loadRegisteredProject,
  LocalOperationService,
  resolveServerProjectRoot,
} from "./src/server";
import { createViteFileSystemPolicy } from "./src/server/vite-file-system-policy";

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
  const serverPort = process.env.PORT ? Number(process.env.PORT) : 4173;
  const registeredTarget = await loadRegisteredProject(
    resolveServerProjectRoot(resolve(root, "examples/source-target")),
  );
  const api = new LocalOperationService(
    new EditService(registeredTarget),
    new DocumentService(registeredTarget),
  );

  return {
    cacheDir: resolve(root, "node_modules/.vite-design-space", `port-${serverPort}`),
    resolve: { dedupe: ["react", "react-dom"] },
    plugins: [
      enforcedPortless(),
      designSpaceTargetPlugin(registeredTarget),
      designSpaceApiPlugin(api),
      react(),
      tailwindcss(),
    ],
    server: {
      host: "127.0.0.1",
      port: serverPort,
      strictPort: true,
      fs: createViteFileSystemPolicy(root, registeredTarget.targetModulePath, registeredTarget.root),
    },
    build: { sourcemap: true },
  };
});
