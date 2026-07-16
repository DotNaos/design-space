import { resolve } from "node:path";

import { expect, it } from "vitest";

import { registerSourceProject } from "./source-project-registration";

it("allows trusted TypeScript source files to use the code editor", async () => {
  const root = resolve(import.meta.dirname, "../../examples/source-target");
  const target = await registerSourceProject(root, {
    project: { id: "source-edit-test", label: "Source edit test" },
    tablet: { fallback: "desktop" },
  });
  const files = [...target.files.values()];
  const editable = (displayName: string) => {
    const file = files.find((candidate) => candidate.displayName === displayName);
    expect(file, `${displayName} should be registered`).toBeDefined();
    return target.editableFileIds?.has(file!.id) ?? false;
  };

  expect(editable("src/app/components/ProjectSummary/desktop.tsx")).toBe(true);
  expect(editable("src/generated-modules.d.ts")).toBe(true);
  expect(editable("src/styles.css")).toBe(false);
  expect(editable("package.json")).toBe(false);
  expect(editable(".designspace.ts")).toBe(false);
});
