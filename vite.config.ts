import { createHash } from "node:crypto";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import {
  designSpaceApiPlugin,
  designSpaceTargetPlugin,
  DocumentService,
  EditService,
  LibraryDevelopmentProjectService,
  LibraryReleaseService,
  loadRegisteredProject,
  LocalOperationService,
  resolveServerProjectRoot,
  SourceCodexService,
  SourceApprovalService,
  SourceDraftPreviewRegistry,
  sourceCodexPlugin,
  workspaceControlPlugin,
} from "./src/server";
import { createViteFileSystemPolicy } from "./src/server/vite-file-system-policy";
import { targetTypeScriptAliasRoots, targetTypeScriptAliases } from "./src/server/typescript-path-aliases";
import { runningTargetPlugin } from "./src/server/running-target-plugin";

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
  const sourceDraftPreviews = new SourceDraftPreviewRegistry();
  const sourceCodex = new SourceCodexService(undefined, root);
  const targetAliases = targetTypeScriptAliases(registeredTarget.root);
  const libraryAliases = registeredTarget.sourceLibrary?.development
    ? targetTypeScriptAliases(registeredTarget.sourceLibrary.development.root)
    : [];
  const targetCacheKey = createHash("sha256")
    .update(registeredTarget.sourceLibrary?.development?.root ?? "installed-library")
    .digest("hex")
    .slice(0, 12);
  const api = new LocalOperationService(
    new EditService(registeredTarget, { sourceDraftPreviews }),
    new DocumentService(registeredTarget),
    new LibraryDevelopmentProjectService(registeredTarget),
    new SourceApprovalService(registeredTarget),
    new LibraryReleaseService(registeredTarget),
  );

  return {
    cacheDir: resolve(root, "node_modules/.vite-design-space", `port-${serverPort}`, targetCacheKey),
    resolve: {
      alias: [...targetAliases, ...libraryAliases],
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      // Monaco's pre-bundled shared chunk is large enough to overflow Vite's
      // transform-filter RegExp stack when the file explorer first opens it.
      // Keep Monaco as native ESM so Vite transforms its smaller modules.
      exclude: ["monaco-editor"],
    },
    plugins: [
      enforcedPortless(),
      designSpaceTargetPlugin(registeredTarget, sourceDraftPreviews),
      designSpaceApiPlugin(api),
      sourceCodexPlugin(sourceCodex),
      workspaceControlPlugin(),
      runningTargetPlugin(registeredTarget.project),
      react(),
      tailwindcss(),
    ],
    server: {
      host: "127.0.0.1",
      port: serverPort,
      proxy: {
        "/__project-space": {
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/__project-space/, ""),
          target: "http://project-space.localhost:1355",
        },
      },
      strictPort: true,
      fs: createViteFileSystemPolicy(root, registeredTarget.targetModulePath, registeredTarget.root, [
        registeredTarget.sourceLibrary?.development?.root ?? "",
        registeredTarget.sourceLibrary?.release?.modulePath ?? "",
        ...targetTypeScriptAliasRoots(libraryAliases),
      ]),
    },
    build: { sourcemap: true },
  };
});
