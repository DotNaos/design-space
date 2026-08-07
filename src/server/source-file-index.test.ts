import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { indexAppManifestWorkspace, indexSourceWorkspace } from "./source-file-index";
import { parseAppManifest } from "./app-manifest";

describe("TypeScript-first source index", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  it("discovers device-first app paths and component-first variants with truthful fallbacks", async () => {
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
      { label: "DesktopLayout", area: "layout", device: "desktop", path: "src/app/desktop/layout.tsx" },
      { label: "MobileLayout", area: "layout", device: "mobile", path: "src/app/mobile/layout.tsx" },
      { label: "GeneratedHome", area: "pages", device: "desktop", path: "src/app/desktop/pages/GeneratedHome.tsx" },
      { label: "MobileHome", area: "pages", device: "mobile", path: "src/app/mobile/pages/MobileHome.tsx" },
      { label: "AppShell", area: "components", device: "desktop", path: "src/app/components/AppShell/desktop.tsx" },
      { label: "ProjectSummary", area: "components", device: "desktop", path: "src/app/components/ProjectSummary/desktop.tsx" },
      { label: "StatusNotice", area: "components", device: "desktop", path: "src/app/components/StatusNotice/desktop.tsx" },
      { label: "ToolbarAction", area: "components", device: "desktop", path: "src/app/components/ToolbarAction/desktop.tsx" },
    ]);
    expect(result.manifest.devices).toContainEqual({
      area: "pages",
      device: "tablet",
      path: "src/app/tablet/pages",
      state: "fallback",
      fallback: "desktop",
    });
    const summary = result.manifest.entries.find((entry) => entry.label === "ProjectSummary");
    expect(summary?.props).toEqual([
      expect.objectContaining({ name: "label", type: "string", required: true, kind: "string" }),
      expect.objectContaining({ name: "ready", required: false, kind: "boolean", values: [false, true] }),
    ]);
    expect(summary?.design).toMatchObject({ relativePath: "src/app/components/ProjectSummary/desktop.design.tsx" });
    expect(summary?.slots).toEqual([]);
    expect(summary?.findings).toEqual([]);
    const shell = result.manifest.entries.find((entry) => entry.label === "AppShell");
    expect(shell?.slots).toEqual([
      expect.objectContaining({ name: "notice", accepts: ["StatusNotice"], min: 1, max: 1 }),
      expect.objectContaining({ name: "content", accepts: ["GeneratedHome"], min: 1, max: 1 }),
      expect.objectContaining({ name: "actions", accepts: ["ToolbarAction"], min: 0, max: 2 }),
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
    expect(result.manifest.library?.components).toEqual(expect.arrayContaining([
      { name: "Scrollable", evidence: "package-export", category: "primitive" },
    ]));
  });

  it("discovers nested and flat component folders without inventing entries for empty or non-component directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-nested-components-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "src", "app", "desktop"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Agents", "AgentCard"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Git", "AgentCard"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "FlatButton"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Empty"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Notes"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Mobile"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "src", "app", "desktop", "layout.tsx"), "export function Layout() { return <main />; }\n");
    await writeFile(join(root, "src", "app", "components", "Agents", "AgentCard", "desktop.tsx"), "export function AgentCard() { return <article />; }\n");
    await writeFile(join(root, "src", "app", "components", "Agents", ".bot.lucide-icon"), "");
    await writeFile(join(root, "src", "app", "components", "Agents", "package.json"), JSON.stringify({ name: "@demo/agents" }) + "\n");
    await writeFile(join(root, "src", "app", "components", "Git", "AgentCard", "desktop.tsx"), "export function AgentCard() { return <article />; }\n");
    await writeFile(join(root, "src", "app", "components", "Git", ".git-commit.lucide-icon"), "");
    await writeFile(join(root, "src", "app", "components", "FlatButton", "desktop.tsx"), "export function FlatButton() { return <button />; }\n");
    await writeFile(join(root, "src", "app", "components", "Empty", "README.md"), "No components here.\n");
    await writeFile(join(root, "src", "app", "components", "Empty", ".archive.lucide-icon"), "");
    await writeFile(join(root, "src", "app", "components", "Notes", "helper.tsx"), "export const meaning = 42;\n");
    await writeFile(join(root, "src", "app", "components", "Mobile", "Navigation.tsx"), "export function Navigation() { return <nav />; }\n");

    const result = await indexSourceWorkspace(root, {
      project: { id: "nested-components", label: "Nested components" },
    });

    expect(result.manifest.entries.map(({ label, relativePath }) => ({ label, relativePath }))).toEqual([
      { label: "Layout", relativePath: "src/app/desktop/layout.tsx" },
      { label: "AgentCard", relativePath: "src/app/components/Agents/AgentCard/desktop.tsx" },
      { label: "FlatButton", relativePath: "src/app/components/FlatButton/desktop.tsx" },
      { label: "AgentCard", relativePath: "src/app/components/Git/AgentCard/desktop.tsx" },
      { label: "Navigation", relativePath: "src/app/components/Mobile/Navigation.tsx" },
    ]);
    expect(result.manifest.entries.find((entry) => entry.label === "Navigation")?.device).toBe("desktop");
    expect(result.manifest.folderIcons).toEqual([
      { directory: "src/app/components/Agents", name: "bot" },
      { directory: "src/app/components/Empty", name: "archive" },
      { directory: "src/app/components/Git", name: "git-commit" },
    ]);
    expect(result.manifest.packageDirectories).toEqual([
      "src/app/components/Agents",
    ]);
    expect(result.manifest.packages).toEqual([
      { directory: "src/app/components/Agents", name: "@demo/agents" },
    ]);
    expect(result.files.map((file) => file.relativePath)).toContain("src/app/components/Agents/.bot.lucide-icon");
  });

  it("falls back safely when folder icon markers are invalid or ambiguous", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-folder-icons-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "src", "app", "components", "Actions"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "Navigation"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "src", "app", "components", "Actions", "Button.tsx"), "export function Button() { return <button />; }\n");
    await writeFile(join(root, "src", "app", "components", "Actions", ".mouse-pointer.lucide-icon"), "");
    await writeFile(join(root, "src", "app", "components", "Actions", ".zap.lucide-icon"), "");
    await writeFile(join(root, "src", "app", "components", "Navigation", "Link.tsx"), "export function Link() { return <a />; }\n");
    await writeFile(join(root, "src", "app", "components", "Navigation", ".Not Valid.lucide-icon"), "");

    const result = await indexSourceWorkspace(root, {
      project: { id: "folder-icons", label: "Folder icons" },
      source: { layout: "src/app.tsx" },
    });

    expect(result.manifest.entries.map((entry) => entry.label)).toEqual(["Button", "Link"]);
    expect(result.manifest.folderIcons).toEqual([]);
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

  it("indexes exact manifest targets, explicit devices, and shared roots without fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-app-manifest-index-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "clients", "web", "src", "app-roots"), { recursive: true });
    await mkdir(join(root, "clients", "web", "src", "components"), { recursive: true });
    await mkdir(join(root, "clients", "mobile", "src", "app-roots"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "clients", "web", "src", "main.tsx"), "export {};\n");
    await writeFile(join(root, "clients", "mobile", "index.ts"), "export {};\n");
    await writeFile(join(root, "clients", "web", "src", "web.css"), ":root { --brand: web; }\n");
    await writeFile(join(root, "clients", "mobile", "src", "native.css"), ":root { --brand: native; }\n");
    await writeFile(join(root, "clients", "web", "src", "app-roots", "App.tsx"), [
      'import { SharedPanel } from "../components/SharedPanel";',
      "export function App() { return <main><SharedPanel /></main>; }",
    ].join("\n"));
    await writeFile(join(root, "clients", "web", "src", "components", "SharedPanel.tsx"), "export function SharedPanel() { return <section />; }\n");
    await writeFile(join(root, "clients", "web", "src", "components", ".panels-top-left.lucide-icon"), "");
    await writeFile(join(root, "clients", "mobile", "src", "app-roots", "App.mobile.tsx"), "export default function AppMobile() { return <main />; }\n");

    const result = await indexAppManifestWorkspace(root, parseAppManifest({
      version: 1,
      app: { id: "manifest-app", displayName: "Manifest App" },
      targets: {
        web: {
          runtime: "react",
          sourceRoot: "clients/web",
          entrypoint: "clients/web/src/main.tsx",
          devices: {
            desktop: { root: { source: "clients/web/src/app-roots/App.tsx", export: "App" } },
            tablet: { root: { source: "clients/web/src/app-roots/App.tsx", export: "App" } },
          },
        },
        native: {
          runtime: "react-native",
          sourceRoot: "clients/mobile",
          entrypoint: "clients/mobile/index.ts",
          devices: {
            mobile: { root: { source: "clients/mobile/src/app-roots/App.mobile.tsx", export: "default" } },
          },
        },
      },
    }));

    expect(result.manifest.adapter).toBe("app-manifest");
    expect(result.manifest.devices).toEqual([]);
    expect(result.manifest.targets?.map(({ id, devices }) => ({
      id,
      devices: devices.map(({ id: device }) => device),
      roots: devices.map(({ entryId }) => entryId),
    }))).toEqual([
      { id: "web", devices: ["desktop", "tablet"], roots: [expect.any(String), expect.any(String)] },
      { id: "native", devices: ["mobile"], roots: [expect.any(String)] },
    ]);
    expect(result.manifest.targets?.[0]?.devices[0]?.entryId).toBe(result.manifest.targets?.[0]?.devices[1]?.entryId);
    expect(result.manifest.entries.find((entry) => entry.label === "App" && entry.targetId === "web")?.manifestDevices)
      .toEqual(["desktop", "tablet"]);
    expect(result.manifest.entries.find((entry) => entry.label === "AppMobile")?.manifestDevices).toEqual(["mobile"]);
    expect(result.manifest.folderIcons).toEqual([
      { directory: "clients/web/src/components", name: "panels-top-left" },
    ]);
    expect(result.targetStylePaths?.get("web")).toEqual([
      expect.stringMatching(/clients\/web\/src\/web\.css$/),
    ]);
    expect(result.targetStylePaths?.get("native")).toEqual([
      expect.stringMatching(/clients\/mobile\/src\/native\.css$/),
    ]);
  });

  it("indexes exported React pages and components from a real src tree without a generated manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-inferred-source-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "src", "design-space"), { recursive: true });
    await mkdir(join(root, "src", "pages"), { recursive: true });
    await mkdir(join(root, "src", "components"), { recursive: true });
    await mkdir(join(root, "src", "app", "components", "StatusBadge"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "src", "design-space", "app.tsx"), "export function ProjectPreview() { return <main />; }\n");
    await writeFile(join(root, "src", "pages", "SettingsPage.tsx"), "export function SettingsPage() { return <main />; }\n");
    await writeFile(join(root, "src", "components", "Navigation.tsx"), "export function Navigation() { return <nav />; }\n");
    await writeFile(join(root, "src", "components", "Navigation.design.tsx"), [
      'import { Navigation } from "./Navigation";',
      "export default defineComponentDesign(Navigation, {});",
    ].join("\n"));
    await writeFile(join(root, "src", "components", "Navigation.test.tsx"), "export function TestOnly() { return <nav />; }\n");
    await writeFile(join(root, "src", "app", "components", "StatusBadge", "index.tsx"), "export function StatusBadge() { return <span />; }\n");

    const result = await indexSourceWorkspace(root, {
      project: { id: "real-project", label: "Real project" },
      devices: { mode: "responsive" },
      source: { layout: "src/design-space/app.tsx" },
    });

    expect(result.manifest.entries.map(({ area, label, relativePath }) => ({ area, label, relativePath }))).toEqual([
      { area: "layout", label: "ProjectPreview", relativePath: "src/design-space/app.tsx" },
      { area: "pages", label: "SettingsPage", relativePath: "src/pages/SettingsPage.tsx" },
      { area: "components", label: "StatusBadge", relativePath: "src/app/components/StatusBadge/index.tsx" },
      { area: "components", label: "Navigation", relativePath: "src/components/Navigation.tsx" },
    ]);
    expect(result.manifest.devices).toContainEqual(expect.objectContaining({ device: "mobile", state: "responsive" }));
    expect(result.manifest.entries.find((entry) => entry.label === "Navigation")?.design).toMatchObject({
      relativePath: "src/components/Navigation.design.tsx",
    });
    expect(result.manifest.entries.some((entry) => entry.label === "NavigationDesign")).toBe(false);
  });

  it("indexes a configured monorepo app without requiring component design files", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-monorepo-source-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "apps", "production", "src", "components"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "apps", "production", "src", "App.tsx"), "export function App() { return <main />; }\n");
    await writeFile(join(root, "apps", "production", "src", "components", "Toolbar.tsx"), "export function Toolbar() { return <nav />; }\n");
    await writeFile(join(root, "src", "Unrelated.tsx"), "export function Unrelated() { return <aside />; }\n");

    const result = await indexSourceWorkspace(root, {
      project: { id: "monorepo-project", label: "Monorepo project" },
      devices: { mode: "responsive" },
      source: { layout: "./apps/production/src/App.tsx" },
    });

    expect(result.manifest.sourceRoot).toBe("apps/production/src");
    expect(result.manifest.entries.map(({ area, label, relativePath, design }) => ({
      area,
      label,
      relativePath,
      design,
    }))).toEqual([
      { area: "layout", label: "App", relativePath: "apps/production/src/App.tsx", design: undefined },
      { area: "components", label: "Toolbar", relativePath: "apps/production/src/components/Toolbar.tsx", design: undefined },
    ]);
    expect(result.files.map((file) => file.relativePath)).toEqual(expect.arrayContaining([
      "apps/production/src/App.tsx",
      "apps/production/src/components/Toolbar.tsx",
    ]));
  });

  it("binds a colocated design only to the component export passed to defineComponentDesign", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-design-binding-"));
    roots.push(root);
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    await mkdir(join(root, "src", "components", "Workspace"), { recursive: true });
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx", module: "ESNext", moduleResolution: "Bundler" } }));
    await writeFile(join(root, "src", "components", "Workspace", "index.tsx"), [
      "export function Workspace() { return <main />; }",
      "export function WorkspaceStatus() { return <span />; }",
    ].join("\n"));
    await writeFile(join(root, "src", "components", "Workspace", "index.design.tsx"), [
      'import { Workspace as Preview } from ".";',
      "export default defineComponentDesign(Preview, {});",
    ].join("\n"));

    const result = await indexSourceWorkspace(root, {
      project: { id: "bound-design", label: "Bound design" },
      devices: { mode: "responsive" },
    });

    expect(result.manifest.entries.find((entry) => entry.label === "Workspace")?.design).toMatchObject({
      relativePath: "src/components/Workspace/index.design.tsx",
    });
    expect(result.manifest.entries.find((entry) => entry.label === "WorkspaceStatus")?.design).toBeUndefined();
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
      components: [],
    });

    await writeFile(join(root, "package.json"), JSON.stringify({
      dependencies: { "@dotnaos/react-ui": "workspace:*" },
    }));
    const development = await indexSourceWorkspace(root, { project: { id: "dev-app", label: "Dev app" } });
    expect(development.manifest.library).toMatchObject({ mode: "development", editable: false });
  });

  it("uses real installed package exports for the component catalog", async () => {
    const root = await mkdtemp(join(tmpdir(), "design-space-library-exports-"));
    roots.push(root);
    const packageRoot = join(root, "node_modules", "@dotnaos", "react-ui");
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(root, ".designspace.ts"), "export default {};\n");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { "@dotnaos/react-ui": "^0.0.5" } }));
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { moduleResolution: "Bundler", module: "ESNext" } }));
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "@dotnaos/react-ui", version: "0.0.5", types: "index.d.ts" }));
    await writeFile(join(packageRoot, "index.d.ts"), [
      "export declare function Button(): unknown;",
      "export declare const Scrollable: () => unknown;",
      "declare function StrictUiDevTools(): unknown;",
      "export { StrictUiDevTools, StrictUiDevTools as UiDevTools };",
      "export interface ButtonProps { disabled?: boolean }",
      "export declare function getCatalog(): unknown;",
    ].join("\n"));

    const result = await indexSourceWorkspace(root, { project: { id: "catalog-app", label: "Catalog app" } });
    expect(result.manifest.library?.components).toEqual([
      { name: "Button", evidence: "package-export" },
      { name: "Scrollable", evidence: "package-export" },
      { name: "StrictUiDevTools", evidence: "package-export" },
    ]);
  });
});
