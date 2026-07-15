import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EditService } from "./edit-service";
import {
  registerTrustedTarget,
  type TailwindCompilerContext,
  type TrustedTargetConfig,
} from "./target-registration";

const marker = "/* design-space:card.surface */";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "design-space-tailwind-"));
  const componentPath = join(root, "component.tsx");
  const themePath = join(root, "theme.css");
  await writeFile(componentPath, `const cardClass = ${marker} "rounded-xl p-4";\n`, "utf8");
  await writeFile(themePath, "@theme { --color-brand-panel: #123456; }\n", "utf8");
  await writeFile(join(root, "target.tsx"), "export const target = {};\n", "utf8");
  const config = {
    project: { id: "demo", label: "Demo" },
    root,
    targetModule: "target.tsx",
    files: { "file.card": "component.tsx", "tailwind.theme": "theme.css" },
    editTargets: { "edit.card.surface": { fileId: "file.card", marker } },
  } satisfies TrustedTargetConfig;
  return { root, componentPath, themePath, config };
}

describe("target-owned Tailwind compilation", () => {
  it("rejects unknown or duplicate trusted source file IDs", async () => {
    const base = await fixture();
    for (const sourceFileIds of [["file.unknown"], ["tailwind.theme", "tailwind.theme"]]) {
      await expect(registerTrustedTarget({
        ...base.config,
        tailwindCompiler: { sourceFileIds, compile: () => "" },
      })).rejects.toMatchObject({ code: "INVALID_REGISTRATION" });
    }
  });

  it("uses the same normalized classes and frozen source snapshot for preview and prepare", async () => {
    const base = await fixture();
    const received: Array<{ classList: string; context: TailwindCompilerContext }> = [];
    const registered = await registerTrustedTarget({
      ...base.config,
      tailwindCompiler: {
        sourceFileIds: ["tailwind.theme"],
        compile: (classList, context) => {
          received.push({ classList, context });
          expect(Object.isFrozen(context)).toBe(true);
          expect(Object.isFrozen(context.sources)).toBe(true);
          expect(Object.isFrozen(context.sourceVersions)).toBe(true);
          expect(context).toMatchObject({
            projectId: "demo",
            sources: { "tailwind.theme": "@theme { --color-brand-panel: #123456; }\n" },
          });
          expect(context.sourceVersions["tailwind.theme"]).toMatch(/^[a-f0-9]{64}$/);
          expect(() => Object.assign(context.sources, { arbitrary: "unsafe" })).toThrow();
          return ".bg-brand-panel{background-color:#123456}";
        },
      },
    });
    const service = new EditService(registered);

    await expect(service.execute({ type: "compile-tailwind", value: "  bg-brand-panel   " })).resolves.toEqual({
      value: "bg-brand-panel",
      css: ".bg-brand-panel{background-color:#123456}",
    });
    const snapshot = await service.read("edit.card.surface");
    await expect(service.prepare("edit.card.surface", "bg-brand-panel", snapshot.version)).resolves.toMatchObject({
      editTargetId: "edit.card.surface",
    });
    expect(received.map(({ classList }) => classList)).toEqual(["bg-brand-panel", "bg-brand-panel"]);
    expect(new Set(received.map(({ context }) => context.sourceVersions["tailwind.theme"])).size).toBe(1);
  });

  it("rejects a save when a registered Tailwind source changes after preparation", async () => {
    const base = await fixture();
    const registered = await registerTrustedTarget({
      ...base.config,
      tailwindCompiler: {
        sourceFileIds: ["tailwind.theme"],
        compile: (_classList, context) => context.sources["tailwind.theme"],
      },
    });
    const service = new EditService(registered);
    const snapshot = await service.read("edit.card.surface");
    const prepared = await service.prepare("edit.card.surface", "bg-brand-panel", snapshot.version);

    await writeFile(base.themePath, ".bg-brand-panel{background:#654321}\n", "utf8");
    await expect(service.save(prepared.challengeId)).rejects.toMatchObject({ code: "STALE_SOURCE" });
    expect(await readFile(base.componentPath, "utf8")).toContain('"rounded-xl p-4"');
  });
});
