import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
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

it("indexes a selected library checkout without requiring its own Design Space config", async () => {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "design-space-library-fallback-"));
  const appRoot = resolve(temporaryRoot, "app");
  const libraryRoot = resolve(temporaryRoot, "ui", "packages", "react-ui");

  try {
    await mkdir(resolve(appRoot, "src", "app"), { recursive: true });
    await mkdir(resolve(libraryRoot, "src"), { recursive: true });
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
      resolve(libraryRoot, "src", "Button.tsx"),
      "export function Button() { return <button type=\"button\" />; }\n",
    );

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
            relativePath: "src/Button.tsx",
          }),
        ],
      },
    });
    const runtimeSource = await (designSpaceTargetPlugin(target).load as Function)(
      `\0${DESIGN_SPACE_TARGET_MODULE_ID}`,
    ) as string;
    expect(runtimeSource).not.toContain('"label":"Button.tsx"');
    expect(runtimeSource).not.toContain('"files":[{"id":"library.source.');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
