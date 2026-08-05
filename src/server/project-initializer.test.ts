import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { initializeDesignSpaceProject } from "./project-initializer";
import { loadRegisteredProject } from "./project-loader";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("initializeDesignSpaceProject", () => {
  it("creates config and package script for a pnpm frontend", async () => {
    const root = await temporaryProject({ name: "@example/customer-portal", scripts: { dev: "vite" } });
    await mkdir(resolve(root, "src"), { recursive: true });
    await writeFile(resolve(root, "src/App.tsx"), "export function App() { return <main />; }\n");

    const result = await initializeDesignSpaceProject(root);

    expect(result).toMatchObject({ configCreated: true, packageScriptUpdated: true, projectId: "customer-portal" });
    const config = await readFile(resolve(root, ".designspace.ts"), "utf8");
    expect(config).toContain('layout: "src/App.tsx"');
    expect(config).not.toContain("@dotnaos/design-space");
    await expect(loadRegisteredProject(root)).resolves.toMatchObject({
      project: { id: "customer-portal", label: "Customer Portal" },
      sourceWorkspace: {
        manifest: { entries: [expect.objectContaining({ exportName: "App" })] },
      },
    });
    expect(JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))).toMatchObject({
      scripts: { dev: "vite", "design-space": "design-space" },
    });
  });

  it("creates a valid project identity for package names that start with a number", async () => {
    const root = await temporaryProject({ name: "3d-showroom" });

    const result = await initializeDesignSpaceProject(root);

    expect(result.projectId).toBe("app-3d-showroom");
    await expect(loadRegisteredProject(root)).resolves.toMatchObject({
      project: { id: "app-3d-showroom" },
    });
  });

  it("creates a browsable config for a Next app-router project", async () => {
    const root = await temporaryProject({ name: "next-dashboard" });
    await mkdir(resolve(root, "app"), { recursive: true });
    await writeFile(resolve(root, "app/layout.tsx"), [
      "export default function RootLayout() {",
      "  return <html><body><main /></body></html>;",
      "}",
      "",
    ].join("\n"));

    await initializeDesignSpaceProject(root);

    expect(await readFile(resolve(root, ".designspace.ts"), "utf8")).toContain('layout: "app/layout.tsx"');
    await expect(loadRegisteredProject(root)).resolves.toMatchObject({
      sourceWorkspace: {
        manifest: {
          sourceRoot: "app",
          entries: [expect.objectContaining({ exportName: "default", relativePath: "app/layout.tsx" })],
        },
      },
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
