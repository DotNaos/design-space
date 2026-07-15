import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRegisteredProject, TARGET_REGISTRATION_FILE } from "./project-loader";

describe("target project discovery", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))));

  it("loads only the fixed server registration from the selected server-side project root", async () => {
    const root = await mkdtemp(join(process.cwd(), ".design-space-test-project-"));
    roots.push(root);
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(root, "Card.tsx"), 'const className = "p-4";\n');
    await writeFile(join(root, TARGET_REGISTRATION_FILE), `
      export const registration = {
        project: { id: "external-app", label: "External app" },
        targetModule: "target.tsx",
        files: { "card.source": "Card.tsx" },
        editTargets: { "card.surface": { fileId: "card.source", marker: "className = " } },
      };
    `);

    const target = await loadRegisteredProject(root);
    expect(target.root).toBe(await realpath(root));
    expect(target.project).toEqual({ id: "external-app", label: "External app" });
    expect(target.files.get("card.source")?.displayName).toBe("Card.tsx");
  });

  it("does not accept a project without the fixed registration file", async () => {
    const root = await mkdtemp(join(process.cwd(), ".design-space-test-unregistered-"));
    roots.push(root);
    await expect(loadRegisteredProject(root)).rejects.toBeDefined();
  });
});
