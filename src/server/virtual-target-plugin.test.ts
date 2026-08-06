import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

import { registerTrustedTarget } from "./target-registration";
import { registerSourceProject } from "./source-project-registration";
import {
  SourceDraftPreviewRegistry,
  sourceDraftPreviewModuleId,
} from "./source-draft-preview-registry";
import { DESIGN_SPACE_TARGET_MODULE_ID, designSpaceTargetPlugin } from "./virtual-target-plugin";
import type { RegisteredTarget } from "./target-registration";

it("binds the virtual runtime to the server-registered target module", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-space-virtual-"));
  await writeFile(join(root, "target.tsx"), "export const target = {};\n");
  const target = await registerTrustedTarget({
    project: { id: "demo", label: "Demo" },
    root,
    targetModule: "target.tsx",
    files: {},
    editTargets: {},
  });
  const plugin = designSpaceTargetPlugin(target);
  expect(await (plugin.resolveId as Function)(DESIGN_SPACE_TARGET_MODULE_ID)).toBe(
    `\0${DESIGN_SPACE_TARGET_MODULE_ID}`,
  );
  expect(await (plugin.resolveId as Function)("/browser/chosen/module.tsx")).toBeUndefined();
  const source = await (plugin.load as Function)(`\0${DESIGN_SPACE_TARGET_MODULE_ID}`);
  expect(source).toContain("virtual:design-space-target/registered");
  expect(await (plugin.resolveId as Function)("virtual:design-space-target/registered")).toBe(
    target.targetModulePath,
  );
  expect(source).not.toContain(root);
  expect(source).not.toContain("browser/chosen");
});

it("generates a runtime from server-indexed TypeScript exports without a target manifest", async () => {
  const root = resolve(import.meta.dirname, "../../examples/source-target");
  const target = await registerSourceProject(root, {
    project: { id: "generated-project-template-web", label: "Generated Project Template Web" },
    tablet: { fallback: "desktop" },
  });
  const plugin = designSpaceTargetPlugin(target);
  const source = await (plugin.load as Function)(`\0${DESIGN_SPACE_TARGET_MODULE_ID}`) as string;

  expect(source).not.toContain('import { lazy } from "react"');
  expect(source).not.toContain("lazy(() => import(");
  expect(source).toContain("ProjectSummary/desktop.design.tsx");
  expect(source).toContain("load: () => import(");
  expect(source).toContain("src/app/desktop/layout.tsx");
  expect(source).toContain("src/styles.css?inline");
  expect(source).toContain('"exportName":"default"');
  expect(source).not.toContain("design.json");
  expect(await (plugin.resolveId as Function)("virtual:design-space-target/registered")).toBeUndefined();

  const page = target.sourceWorkspace?.files.find((file) => file.relativePath === "src/app/desktop/pages/GeneratedHome.tsx");
  expect(page).toBeDefined();
  const transformed = await (plugin.transform as Function)(
    await readFile(page!.absolutePath, "utf8"),
    page!.absolutePath,
  );
  expect(transformed.code).toContain("data-design-space-source-layer-id");
});

it("serves a validated draft graph through Vite without changing the registered files", async () => {
  const root = resolve(import.meta.dirname, "../../examples/source-target");
  const target = await registerSourceProject(root, {
    project: { id: "generated-project-template-web", label: "Generated Project Template Web" },
    tablet: { fallback: "desktop" },
  });
  const entry = target.sourceWorkspace?.manifest.entries.find((candidate) => candidate.design);
  const sourceFile = target.sourceWorkspace?.files.find((file) => file.id === entry?.fileId);
  const designFile = target.sourceWorkspace?.files.find((file) => file.id === entry?.design?.fileId);
  expect(sourceFile).toBeDefined();
  expect(designFile).toBeDefined();
  const draft = `${await readFile(sourceFile!.absolutePath, "utf8")}\n// prepared review\n`;
  const registry = new SourceDraftPreviewRegistry();
  registry.register({
    challengeId: "prepared-review",
    scope: "app",
    workspace: target.sourceWorkspace!,
    changes: [{ fileId: sourceFile!.id, source: draft }],
    expiresAt: Date.now() + 60_000,
  });
  const plugin = designSpaceTargetPlugin(target, registry);
  const designId = sourceDraftPreviewModuleId("prepared-review", designFile!.id, designFile!.relativePath);
  const resolvedDesign = await (plugin.resolveId as Function)(designId);

  expect(await (plugin.load as Function)(resolvedDesign)).toBe(await readFile(designFile!.absolutePath, "utf8"));
  const resolvedSource = await (plugin.resolveId as Function).call({
    resolve: async () => ({ id: sourceFile!.absolutePath }),
  }, "./component", resolvedDesign);
  expect(resolvedSource).toBe(`\0${sourceDraftPreviewModuleId(
    "prepared-review",
    sourceFile!.id,
    sourceFile!.relativePath,
  )}`);
  expect(await (plugin.load as Function)(resolvedSource)).toBe(draft);
  const transformed = await (plugin.transform as Function)(draft, resolvedSource);
  expect(transformed.code).toContain("data-design-space-source-layer-id");
  expect(await readFile(sourceFile!.absolutePath, "utf8")).not.toContain("prepared review");
});

it("keeps native-first, web, and Electron target runtimes and CSS isolated", async () => {
  const target = manifestRuntimeTarget([
    { id: "native", runtime: "react-native", style: "/styles/native-only.css" },
    { id: "web", runtime: "react", style: "/styles/web-only.css" },
    { id: "desktop", runtime: "electron", style: "/styles/electron-only.css" },
  ]);
  const plugin = designSpaceTargetPlugin(target);
  const source = await (plugin.load as Function)(`\0${DESIGN_SPACE_TARGET_MODULE_ID}`) as string;

  expect(source).not.toContain("native-only.css?inline");
  expect(source).toContain("web-only.css?inline");
  expect(source).toContain("electron-only.css?inline");
  expect(source).toContain('"id":"native","runtime":"react-native"');
  expect(source).toContain('"id":"web","runtime":"react"');
  expect(source).toContain('"id":"desktop","runtime":"electron"');
  expect(source).toContain("styles: [SourceTarget1Style0]");
  expect(source).toContain("styles: [SourceTarget2Style0]");
  expect(source).toContain("    styles: [],");
});

it("does not inject a later target's conflicting CSS into a web-first target", async () => {
  const target = manifestRuntimeTarget([
    { id: "web", runtime: "react", style: "/styles/web-brand.css" },
    { id: "admin", runtime: "react", style: "/styles/admin-brand.css" },
  ]);
  const plugin = designSpaceTargetPlugin(target);
  const source = await (plugin.load as Function)(`\0${DESIGN_SPACE_TARGET_MODULE_ID}`) as string;

  expect(source).toContain("styles: [SourceTarget0Style0]");
  expect(source).toContain("styles: [SourceTarget1Style0]");
  expect(source).not.toContain("styles: [SourceTarget0Style0, SourceTarget1Style0]");
});

function manifestRuntimeTarget(
  definitions: readonly { id: string; runtime: "react" | "react-native" | "electron"; style: string }[],
): RegisteredTarget {
  const targets = definitions.map(({ id, runtime }) => ({
    id,
    runtime,
    sourceRoot: `clients/${id}`,
    entrypoint: `clients/${id}/src/main.tsx`,
    devices: [{
      id: runtime === "react-native" ? "mobile" as const : "desktop" as const,
      entryId: `${id}-entry`,
      root: {
        source: `clients/${id}/src/App.${runtime === "react-native" ? "mobile" : "desktop"}.tsx`,
        export: "default",
      },
    }],
  }));
  return {
    project: { id: "manifest-runtime", label: "Manifest runtime" },
    root: "/workspace",
    targetModulePath: "/workspace/app.manifest.json",
    files: new Map(),
    editTargets: new Map(),
    sourceWorkspace: {
      root: "/workspace",
      files: [],
      entryFiles: new Map(definitions.map(({ id }) => [`${id}-entry`, `/workspace/clients/${id}/src/App.tsx`])),
      stylePaths: definitions.map(({ style }) => style),
      targetStylePaths: new Map(definitions.map(({ id, style }) => [id, [style]])),
      manifest: {
        adapter: "app-manifest",
        runtime: "react",
        sourceRoot: targets[0]!.sourceRoot,
        devices: [],
        targets,
        entries: definitions.map(({ id, runtime }) => ({
          id: `${id}-entry`,
          label: `${id} app`,
          area: "layout",
          device: runtime === "react-native" ? "mobile" : "desktop",
          fileId: `${id}-file`,
          relativePath: `clients/${id}/src/App.tsx`,
          exportName: "default",
          props: [], slots: [], findings: [], source: { start: 0, end: 1 },
          targetId: id,
        })),
      },
    },
  };
}
