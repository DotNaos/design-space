import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, expect, it } from "vitest";

import { loadSourceLibraryRepository } from "./source-library-repository";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

it("loads every designed package with repository-relative component identities", async () => {
  const root = await repositoryFixture();
  await writeFile(resolve(root, "package.json"), JSON.stringify({ name: "workspace", private: true }));
  await componentPackage(root, "packages/alpha", "@example/alpha", "Button", true);
  await componentPackage(root, "packages/beta", "@example/beta", "Button");
  await componentPackage(root, "packages/no-design", "@example/no-design", "Hidden", false, false);
  await mkdir(resolve(root, "ordinary", "src"), { recursive: true });
  await writeFile(resolve(root, "ordinary", "src", "NotAPackage.tsx"), "export function NotAPackage() { return <aside />; }\n");

  const workspace = await loadSourceLibraryRepository(root);

  expect(workspace.root).toBe(await realpath(root));
  expect(workspace.manifest.packages).toEqual([
    { directory: "packages/alpha", name: "@example/alpha" },
    { directory: "packages/beta", name: "@example/beta" },
  ]);
  const buttons = workspace.manifest.entries.filter((entry) => entry.label === "Button" && entry.design);
  expect(buttons).toHaveLength(2);
  expect(buttons.map((entry) => entry.relativePath)).toEqual([
    "packages/alpha/src/components/common/Button.tsx",
    "packages/beta/src/components/common/Button.tsx",
  ]);
  expect(new Set(buttons.map((entry) => entry.id)).size).toBe(2);
  expect(new Set(buttons.map((entry) => entry.fileId)).size).toBe(2);
  expect(workspace.manifest.entries.some((entry) => entry.label === "Hidden")).toBe(false);
  expect(workspace.manifest.entries.some((entry) => entry.label === "NotAPackage")).toBe(false);
}, 15_000);

it("keeps a flat single-package library valid", async () => {
  const root = await repositoryFixture();
  await componentPackage(root, ".", "@example/flat", "FlatCard");

  const workspace = await loadSourceLibraryRepository(root);

  expect(workspace.manifest.packages).toEqual([{ directory: ".", name: "@example/flat" }]);
  expect(workspace.manifest.entries).toEqual([
    expect.objectContaining({
      label: "FlatCard",
      relativePath: "src/components/common/FlatCard.tsx",
      design: expect.objectContaining({ relativePath: "src/components/common/FlatCard.design.tsx" }),
    }),
  ]);
});

it("rejects duplicate package names before building an ambiguous catalog", async () => {
  const root = await repositoryFixture();
  await componentPackage(root, "packages/one", "@example/duplicate", "OneCard");
  await componentPackage(root, "packages/two", "@example/duplicate", "TwoCard");

  await expect(loadSourceLibraryRepository(root)).rejects.toMatchObject({
    code: "INVALID_REGISTRATION",
    message: "Package name @example/duplicate is declared more than once",
  });
});

async function repositoryFixture(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "design-space-library-repository-"));
  temporaryRoots.push(root);
  await symlink(resolve(process.cwd(), "node_modules"), resolve(root, "node_modules"), "dir");
  await writeFile(resolve(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" },
  }));
  return root;
}

async function componentPackage(
  root: string,
  directory: string,
  name: string,
  componentName: string,
  configured = false,
  designed = true,
): Promise<void> {
  const packageRoot = directory === "." ? root : resolve(root, directory);
  const componentRoot = resolve(packageRoot, "src", "components", "common");
  await mkdir(componentRoot, { recursive: true });
  await writeFile(resolve(packageRoot, "package.json"), JSON.stringify({ name }));
  if (configured) {
    await writeFile(resolve(packageRoot, ".designspace.ts"), [
      "export default {",
      `  project: { id: ${JSON.stringify(`pkg-${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")}`)}, label: ${JSON.stringify(name)} },`,
      '  devices: { mode: "responsive" },',
      '  source: { layout: "src/components/common/LibraryRoot.tsx" },',
      "} as const;",
      "",
    ].join("\n"));
  }
  await writeFile(
    resolve(componentRoot, `${componentName}.tsx`),
    `export function ${componentName}() { return <section data-component=${JSON.stringify(componentName)} />; }\n`,
  );
  if (designed) {
    await writeFile(resolve(componentRoot, `${componentName}.design.tsx`), [
      `import { ${componentName} } from "./${componentName}";`,
      "const defineComponentDesign = (component: unknown, options: unknown) => ({ component, options });",
      `export default defineComponentDesign(${componentName}, {});`,
      "",
    ].join("\n"));
  }
}
