import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { initializeDesignSpaceProject } from "./project-initializer";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("initializeDesignSpaceProject", () => {
  it("creates config and package script for a pnpm frontend", async () => {
    const root = await temporaryProject({ name: "@example/customer-portal", scripts: { dev: "vite" } });
    await mkdir(resolve(root, "src"), { recursive: true });
    await writeFile(resolve(root, "src/App.tsx"), "export function App() { return null; }\n");

    const result = await initializeDesignSpaceProject(root);

    expect(result).toMatchObject({ configCreated: true, packageScriptUpdated: true, projectId: "customer-portal" });
    expect(await readFile(resolve(root, ".designspace.ts"), "utf8")).toContain('layout: "src/App.tsx"');
    expect(JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))).toMatchObject({
      scripts: { dev: "vite", "design-space": "design-space" },
    });
  });

  it("does not overwrite an existing config", async () => {
    const root = await temporaryProject({ name: "existing-app" });
    await writeFile(resolve(root, ".designspace.ts"), "// keep me\n");

    const result = await initializeDesignSpaceProject(root);

    expect(result.configCreated).toBe(false);
    expect(await readFile(resolve(root, ".designspace.ts"), "utf8")).toBe("// keep me\n");
  });

  it("explains when init is run outside a package root", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "design-space-init-empty-"));
    temporaryDirectories.push(root);

    await expect(initializeDesignSpaceProject(root)).rejects.toThrow(
      "The current directory has no package.json. Run init from the frontend project root.",
    );
  });
});

async function temporaryProject(packageJson: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "design-space-init-"));
  temporaryDirectories.push(root);
  await writeFile(resolve(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  return root;
}
