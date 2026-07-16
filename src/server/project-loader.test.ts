import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DESIGN_SPACE_CONFIG_FILE, loadRegisteredProject, TARGET_REGISTRATION_FILE } from "./project-loader";

describe("target project discovery", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))));

  it("loads only the fixed server registration from the selected server-side project root", async () => {
    const root = await mkdtemp(join(process.cwd(), ".design-space-test-project-"));
    roots.push(root);
    await writeFile(join(root, "target.tsx"), "export const target = {};\n");
    await writeFile(join(root, "Card.tsx"), 'const className = "p-4";\n');
    await writeFile(join(root, "home.design.json"), '{"schemaVersion":2}\n');
    await writeFile(join(root, TARGET_REGISTRATION_FILE), `
      export const registration = {
        project: { id: "external-app", label: "External app" },
        targetModule: "target.tsx",
        files: { "card.source": "Card.tsx", "home.document": "home.design.json" },
        editTargets: { "card.surface": { fileId: "card.source", marker: "className = " } },
        documentRegistration: {
          version: "external.v1",
          tailwindClassList: () => "",
          documents: {
            "screen.home": {
              sourceFileIds: ["home.document"],
              writeFileIds: ["home.document"],
              load: (sources) => JSON.parse(sources["home.document"]),
              materialize: (document) => ({ "home.document": JSON.stringify(document) }),
            },
          },
        },
      };
    `);

    const target = await loadRegisteredProject(root);
    expect(target.root).toBe(await realpath(root));
    expect(target.project).toEqual({ id: "external-app", label: "External app" });
    expect(target.files.get("card.source")?.displayName).toBe("Card.tsx");
    expect(target.documentRegistration?.version).toBe("external.v1");
    expect(target.documentRegistration?.documents.get("screen.home")?.writeFileIds).toEqual(["home.document"]);
  });

  it("does not accept a project without the fixed registration file", async () => {
    const root = await mkdtemp(join(process.cwd(), ".design-space-test-unregistered-"));
    roots.push(root);
    await expect(loadRegisteredProject(root)).rejects.toBeDefined();
  });

  it("prefers the minimal frontend-root config and derives the target from TypeScript", async () => {
    const root = resolve(import.meta.dirname, "../../examples/source-target");
    const target = await loadRegisteredProject(root);

    expect(target.registrationPath).toBe(join(root, DESIGN_SPACE_CONFIG_FILE));
    expect(target.project.label).toBe("Generated Project Template Web");
    expect(target.sourceWorkspace?.manifest.entries.map((entry) => entry.label)).toEqual([
      "DesktopLayout",
      "MobileLayout",
      "GeneratedHome",
      "MobileHome",
      "ProjectSummary",
    ]);
    expect([...target.files.values()].map((file) => file.displayName)).toEqual(expect.arrayContaining([
      "Dockerfile",
      "src/app.tsx",
      "src/app/mobile/pages/MobileHome.tsx",
    ]));
    expect(target.documentRegistration).toBeUndefined();
  });
});
