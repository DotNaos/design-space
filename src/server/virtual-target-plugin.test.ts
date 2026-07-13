import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { registerTrustedTarget } from "./target-registration";
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
