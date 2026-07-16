import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexSourceWorkspace } from "./source-file-index";

describe("TypeScript-first source index", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  it("discovers real exports below category then device and derives truthful fallbacks", async () => {
    const root = resolve(import.meta.dirname, "../../examples/source-target");
    const result = await indexSourceWorkspace(root, {
      project: { id: "generated-project-template-web", label: "Generated Project Template Web" },
      tablet: { fallback: "desktop" },
    });

    expect(result.manifest.entries.map((entry) => ({
      label: entry.label,
      area: entry.area,
      device: entry.device,
      path: entry.relativePath,
    }))).toEqual([
      { label: "DesktopRoot", area: "root", device: "desktop", path: "src/app/root/desktop/index.tsx" },
      { label: "MobileRoot", area: "root", device: "mobile", path: "src/app/root/mobile/index.tsx" },
      { label: "GeneratedHome", area: "pages", device: "desktop", path: "src/app/pages/desktop/GeneratedHome.tsx" },
      { label: "MobileHome", area: "pages", device: "mobile", path: "src/app/pages/mobile/MobileHome.tsx" },
      { label: "ProjectSummary", area: "components", device: "desktop", path: "src/app/components/desktop/ProjectSummary.tsx" },
    ]);
    expect(result.manifest.devices).toContainEqual({
      area: "pages",
      device: "tablet",
      path: "src/app/pages/tablet",
      state: "fallback",
      fallback: "desktop",
    });
    const summary = result.manifest.entries.find((entry) => entry.label === "ProjectSummary");
    expect(summary?.props).toEqual([
      expect.objectContaining({ name: "label", type: "string", required: true, slot: false, kind: "string" }),
      expect.objectContaining({ name: "ready", required: false, slot: false, kind: "boolean" }),
      expect.objectContaining({ name: "children", required: false, slot: true }),
    ]);
    expect(result.files.map((file) => file.relativePath)).toEqual(expect.arrayContaining([
      "Dockerfile",
      "nginx.conf",
      "package.json",
      "project-template-origin.json",
      "src/app.tsx",
      "src/auth/clerk-provider.tsx",
    ]));
    expect(result.manifest.library).toMatchObject({
      packageName: "@dotnaos/react-ui",
      mode: "release",
      editable: false,
    });
  });

  it("indexes safe project source but excludes dependencies, secrets and symlinks", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-source-index-"));
    roots.push(root);
    await mkdir(join(root, "src", "notes"), { recursive: true });
    await mkdir(join(root, "node_modules", "leak"), { recursive: true });
    await writeFile(join(root, ".designspace.ts"), "export default {};\n");
    await writeFile(join(root, "Dockerfile"), "FROM nginx:alpine\n");
    await writeFile(join(root, "nginx.conf"), "events {}\n");
    await writeFile(join(root, "src", "notes", "readme.md"), "safe\n");
    await writeFile(join(root, "src", ".env"), "TOKEN=secret\n");
    await writeFile(join(root, "node_modules", "leak", "index.ts"), "export const secret = true;\n");
    await symlink(join(root, "src", "notes", "readme.md"), join(root, "src", "notes", "linked.md"));

    const result = await indexSourceWorkspace(root, { project: { id: "safe-project", label: "Safe project" } });
    expect(result.files.map((file) => file.relativePath)).toEqual([
      ".designspace.ts",
      "Dockerfile",
      "nginx.conf",
      "src/notes/readme.md",
    ]);
  });

  it("derives release and development connections without claiming unregistered write access", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-index-"));
    roots.push(root);
    await writeFile(join(root, ".designspace.ts"), "export default {};\n");
    await writeFile(join(root, "package.json"), JSON.stringify({
      dependencies: { "@dotnaos/react-ui": "^0.0.5" },
    }));

    const release = await indexSourceWorkspace(root, { project: { id: "release-app", label: "Release app" } });
    expect(release.manifest.library).toEqual({
      packageName: "@dotnaos/react-ui",
      version: "^0.0.5",
      mode: "release",
      editable: false,
    });

    await writeFile(join(root, "package.json"), JSON.stringify({
      dependencies: { "@dotnaos/react-ui": "workspace:*" },
    }));
    const development = await indexSourceWorkspace(root, { project: { id: "dev-app", label: "Dev app" } });
    expect(development.manifest.library).toMatchObject({ mode: "development", editable: false });
  });
});
