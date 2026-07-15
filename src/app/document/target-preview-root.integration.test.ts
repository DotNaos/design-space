// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createServer, isFileServingAllowed, type ViteDevServer } from "vite";

import { registerTrustedTarget } from "../../server/target-registration";
import {
  DESIGN_SPACE_TARGET_MODULE_ID,
  designSpaceTargetPlugin,
} from "../../server/virtual-target-plugin";

it("preserves a target-owned preview root through the trusted Vite module boundary", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "design-space-preview-root-"));
  const designSpaceRoot = resolve(import.meta.dirname, "../../..");
  let server: ViteDevServer | undefined;
  try {
    await mkdir(join(projectRoot, "node_modules/react"), { recursive: true });
    await writeFile(join(projectRoot, "node_modules/react/package.json"), JSON.stringify({
      name: "react",
      version: "0.0.0-wrong-copy",
      type: "module",
      exports: "./index.mjs",
    }));
    await writeFile(join(projectRoot, "node_modules/react/index.mjs"), `
      export function createElement() { throw new Error("target-local React copy loaded"); }
      export function useState() { throw new Error("target-local React copy loaded"); }
    `);
    await writeFile(join(projectRoot, "HookComponent.mjs"), `
      import { createElement, useState } from "react";
      export function HookComponent() {
        const [count] = useState(1);
        return createElement("span", null, "hook-count:" + count);
      }
    `);
    await writeFile(join(projectRoot, "secret.mjs"), "export const secret = 'not in the registered graph';\n");
    await writeFile(join(projectRoot, "target.mjs"), `
      import { createElement } from "react";
      import { HookComponent } from "./HookComponent.mjs";
      export const target = {
        project: { id: "external", label: "External target" },
        defaultAdapterId: "stack",
        defaultFixture: {
          instanceId: "root",
          adapterId: "stack",
          slots: { content: [] },
        },
        files: [],
        adapters: [{
          component: {
            id: "stack",
            label: "Stack",
            group: "Layout",
            slots: [{ id: "content", label: "Content" }],
          },
          render: () => createElement(HookComponent),
        }],
        previewRoot: ({ children }) => children,
      };
    `, "utf8");

    const registered = await registerTrustedTarget({
      project: { id: "external", label: "External target" },
      root: projectRoot,
      targetModule: "target.mjs",
      files: {},
      editTargets: {},
    });
    server = await createServer({
      configFile: false,
      root: designSpaceRoot,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true, include: [] },
      resolve: { dedupe: ["react", "react-dom"] },
      server: { middlewareMode: true, fs: { strict: true, allow: [designSpaceRoot, registered.targetModulePath] } },
      plugins: [designSpaceTargetPlugin(registered)],
    });

    const loaded = await server.ssrLoadModule(DESIGN_SPACE_TARGET_MODULE_ID);
    expect(loaded.target.project.id).toBe("external");
    expect(loaded.target.previewRoot({ children: "direct preview" })).toBe("direct preview");
    expect(renderToStaticMarkup(createElement(() => loaded.target.adapters[0].render({}, {}))))
      .toContain("hook-count:1");

    await server.transformRequest(`/@fs${registered.targetModulePath}`);
    expect(isFileServingAllowed(`/@fs${join(registered.root, "HookComponent.mjs")}`, server)).toBe(true);
    expect(isFileServingAllowed(`/@fs${join(registered.root, "secret.mjs")}`, server)).toBe(false);
    const reactResolution = await server.pluginContainer.resolveId("react", join(projectRoot, "HookComponent.mjs"));
    expect(reactResolution?.id.replaceAll("\\", "/")).toContain(`${designSpaceRoot.replaceAll("\\", "/")}/node_modules/react/`);
  } finally {
    await server?.close();
    await rm(projectRoot, { recursive: true, force: true });
  }
}, 20_000);
