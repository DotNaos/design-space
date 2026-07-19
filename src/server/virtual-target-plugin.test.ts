import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, it } from "vitest";

import { registerTrustedTarget } from "./target-registration";
import { registerSourceProject } from "./source-project-registration";
import { DESIGN_SPACE_TARGET_MODULE_ID, designSpaceTargetPlugin } from "./virtual-target-plugin";

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
