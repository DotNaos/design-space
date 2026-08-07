import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, it } from "vitest";

import { registerSourceProject } from "./source-project-registration";
import { DESIGN_SPACE_TARGET_MODULE_ID, designSpaceTargetPlugin } from "./virtual-target-plugin";

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
  expect(target.sourceComponentStore).toMatchObject({
    directory: { displayName: "src/app/components" },
    fileName: "desktop.tsx",
  });
});

it("registers configured monorepo source files as editable", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "design-space-monorepo-registration-"));
  try {
    await symlink(resolve(process.cwd(), "node_modules"), resolve(root, "node_modules"), "dir");
    await mkdir(resolve(root, "apps", "production", "src", "components"), { recursive: true });
    await writeFile(resolve(root, ".designspace.ts"), "export default {};\n");
    await writeFile(resolve(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(resolve(root, "apps", "production", "src", "App.tsx"), "export function App() { return <main />; }\n");
    await writeFile(resolve(root, "apps", "production", "src", "components", "Toolbar.tsx"), "export function Toolbar() { return <nav />; }\n");

    const target = await registerSourceProject(root, {
      project: { id: "monorepo-registration", label: "Monorepo registration" },
      devices: { mode: "responsive" },
      source: { layout: "apps/production/src/App.tsx" },
    });
    const toolbar = [...target.files.values()].find((file) => file.displayName === "apps/production/src/components/Toolbar.tsx");

    expect(toolbar).toBeDefined();
    expect(target.editableFileIds?.has(toolbar!.id)).toBe(true);
    expect(target.sourceComponentStore).toMatchObject({
      directory: { displayName: "apps/production/src/components" },
      fileName: "index.tsx",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("keeps colocated component creation for a configured src app layout", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "design-space-src-app-registration-"));
  try {
    await symlink(resolve(process.cwd(), "node_modules"), resolve(root, "node_modules"), "dir");
    await mkdir(resolve(root, "src", "app", "components"), { recursive: true });
    await writeFile(resolve(root, ".designspace.ts"), "export default {};\n");
    await writeFile(resolve(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(resolve(root, "src", "app", "App.tsx"), "export function App() { return <main />; }\n");

    const target = await registerSourceProject(root, {
      project: { id: "src-app-registration", label: "Src app registration" },
      devices: { mode: "responsive" },
      source: { layout: "src/app/App.tsx" },
    });

    expect(target.sourceComponentStore).toMatchObject({
      directory: { displayName: "src/app/components" },
      fileName: "index.tsx",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("indexes a selected library checkout without requiring its own Design Space config", async () => {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "design-space-library-fallback-"));
  const appRoot = resolve(temporaryRoot, "app");
  const libraryRoot = resolve(temporaryRoot, "ui", "packages", "react-ui");

  try {
    await mkdir(resolve(appRoot, "src", "app"), { recursive: true });
    await mkdir(resolve(libraryRoot, "src", "components", "actions"), { recursive: true });
    await writeFile(resolve(appRoot, ".designspace.ts"), "export default {};\n");
    await writeFile(resolve(appRoot, "package.json"), JSON.stringify({
      name: "fallback-test-app",
      dependencies: { "@dotnaos/react-ui": "workspace:*" },
    }));
    await writeFile(
      resolve(appRoot, "src", "app", "App.tsx"),
      "export function App() { return <main />; }\n",
    );
    await writeFile(resolve(libraryRoot, "package.json"), JSON.stringify({
      name: "@dotnaos/react-ui",
    }));
    await writeFile(
      resolve(libraryRoot, "src", "components", "actions", "Button.tsx"),
      "export function Button() { return <button type=\"button\" />; }\n",
    );
    await writeFile(resolve(libraryRoot, "src", "components", "actions", ".sparkles.lucide-icon"), "");

    const target = await registerSourceProject(appRoot, {
      project: { id: "library-fallback-test", label: "Library fallback test" },
      devices: { mode: "responsive" },
      library: {
        package: "@dotnaos/react-ui",
        development: { root: libraryRoot },
      },
    });

    expect(target.sourceLibrary?.development).toMatchObject({
      root: await realpath(libraryRoot),
      manifest: {
        sourceRoot: "src",
        entries: [
          expect.objectContaining({
            label: "Button",
            relativePath: "src/components/actions/Button.tsx",
          }),
        ],
      },
    });
    const runtimeSource = await (designSpaceTargetPlugin(target).load as Function)(
      `\0${DESIGN_SPACE_TARGET_MODULE_ID}`,
    ) as string;
    expect(runtimeSource).not.toContain('"label":"Button.tsx"');
    expect(runtimeSource).not.toContain('"files":[{"id":"library.source.');
    expect(runtimeSource).toContain('folderIcons: [{"directory":"src/components/actions","name":"sparkles"}]');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
