import { expect, it } from "vitest";

import type {
  RuntimeSourceLibraryCatalog,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLibrary,
} from "../../shared/source-workspace";
import { filterSourceCatalog, sourceCatalogComponents } from "./source-library-catalog";

const entry = (
  options: Partial<RuntimeSourceWorkspaceEntry> & Pick<RuntimeSourceWorkspaceEntry, "id" | "label">,
): RuntimeSourceWorkspaceEntry => ({
  area: "components",
  component: () => null,
  device: "desktop",
  exportName: options.label,
  fileId: `file.${options.id}`,
  findings: [],
  props: [],
  relativePath: `src/app/components/${options.label}/index.tsx`,
  slots: [],
  source: { end: 10, start: 0 },
  ...options,
});

const design = (id: string): NonNullable<RuntimeSourceWorkspaceEntry["design"]> => ({
  fileId: `${id}-design`,
  relativePath: `src/components/${id}.design.tsx`,
  load: async () => ({
    component: () => null,
    defaults: {},
    initialCase: "default",
    isStateful: false,
    cases: { default: {} },
    render: () => null,
  }),
});

it("flattens logical app components without repeating device implementations", () => {
  const desktop = entry({ id: "summary.desktop", label: "ProjectSummary" });
  const mobile = entry({
    id: "summary.mobile",
    label: "ProjectSummary",
    device: "mobile",
    relativePath: "src/app/components/ProjectSummary/mobile.tsx",
  });
  const workspace: RuntimeSourceWorkspace = {
    devices: [],
    entries: [desktop, mobile, entry({ area: "layout", id: "shell", label: "WorkspaceShell" })],
    runtime: "react",
    sourceRoot: "src/app",
    styles: [],
  };

  const components = sourceCatalogComponents({
    appWorkspace: workspace,
    device: "desktop",
    kind: "app",
    mode: "release",
  });

  expect(components.map((component) => component.label)).toEqual(["WorkspaceShell", "ProjectSummary"]);
  expect(components.find((component) => component.label === "ProjectSummary")?.path).toEqual(["ProjectSummary"]);
});

it("derives nested app catalog paths from component source files", () => {
  const components = sourceCatalogComponents({
    appWorkspace: {
      devices: [],
      entries: [
        entry({
          id: "agent-card",
          label: "AgentCard",
          relativePath: "src/app/components/Agents/AgentCard/AgentCard.tsx",
        }),
        entry({
          id: "tool-call",
          label: "ToolCall",
          relativePath: "src/app/components/Agents/Tools/ToolCall.tsx",
        }),
        entry({
          id: "flat-button",
          label: "Button",
          relativePath: "src/app/components/Button.tsx",
        }),
      ],
      packageDirectories: ["src/app/components/Agents"],
      runtime: "react",
      sourceRoot: "src/app",
      styles: [],
    },
    device: "desktop",
    kind: "app",
    mode: "development",
  });

  expect(components.map(({ label, path }) => ({ label, path }))).toEqual([
    { label: "AgentCard", path: ["Agents", "AgentCard"] },
    { label: "ToolCall", path: ["Agents", "Tools", "ToolCall"] },
    { label: "Button", path: ["Button"] },
  ]);

  expect(components.find((component) => component.label === "AgentCard")?.packagePaths).toEqual([["Agents"]]);
});

it("uses the configured component roots instead of exposing package implementation folders", () => {
  const components = sourceCatalogComponents({
    catalog: {
      packageName: "@dotnaos/react-ui",
      development: {
        componentRoots: ["components/react-ui/src/components"],
        devices: [],
        entries: [entry({
          id: "action-button",
          label: "ActionButton",
          relativePath: "components/react-ui/src/components/actions/ActionButton/render.tsx",
          design: design("action-button"),
        }), entry({
          id: "app-layout",
          label: "AppLayout",
          relativePath: "components/react-ui/src/web/layouts/app-layout/render.tsx",
        })],
        packages: [{ directory: "components/react-ui", name: "@dotnaos/react-ui" }],
        runtime: "react",
        sourceRoot: ".",
        styles: [],
      },
    } satisfies RuntimeSourceLibraryCatalog,
    device: "desktop",
    kind: "library",
    library: { packageName: "@dotnaos/react-ui", version: "workspace:*", mode: "development", editable: false, components: [] },
    mode: "development",
  });

  expect(components.map((component) => component.label)).toEqual(["ActionButton", "AppLayout"]);
  expect(components[0]?.path).toEqual(["react-ui", "actions", "ActionButton"]);
});

it("keeps manifest target folders and mixed-case marker roots scoped to the selected target", () => {
  const workspace: RuntimeSourceWorkspace = {
    devices: [],
    entries: [
      entry({
        id: "web-card",
        label: "AgentCard",
        manifestDevices: ["desktop"],
        relativePath: "clients/web/src/Components/Agents/AgentCard.tsx",
        targetId: "web",
      }),
      entry({
        id: "native-card",
        label: "AgentCard",
        manifestDevices: ["mobile"],
        relativePath: "clients/native/src/components/Agents/AgentCard.tsx",
        targetId: "native",
      }),
    ],
    folderIcons: [
      { directory: "clients/web/src/Components/Agents", name: "globe" },
      { directory: "clients/native/src/components/Agents", name: "smartphone" },
    ],
    runtime: "react",
    sourceRoot: "clients/web",
    styles: [],
    targets: [
      {
        id: "web",
        devices: [{ id: "desktop", entryId: "web-card", root: { export: "AgentCard", source: "clients/web/src/Components/Agents/AgentCard.tsx" } }],
        entrypoint: "clients/web/src/main.tsx",
        runtime: "react",
        sourceRoot: "clients/web",
      },
      {
        id: "native",
        devices: [{ id: "mobile", entryId: "native-card", root: { export: "AgentCard", source: "clients/native/src/components/Agents/AgentCard.tsx" } }],
        entrypoint: "clients/native/index.ts",
        runtime: "react-native",
        sourceRoot: "clients/native",
      },
    ],
  };

  const web = sourceCatalogComponents({
    appTargetId: "web",
    appWorkspace: workspace,
    device: "desktop",
    kind: "app",
    mode: "development",
  });
  const native = sourceCatalogComponents({
    appTargetId: "native",
    appWorkspace: workspace,
    device: "mobile",
    kind: "app",
    mode: "development",
  });

  expect(web).toMatchObject([{ entry: { id: "web-card" }, folderIcons: [{ name: "globe", path: ["Agents"] }] }]);
  expect(native).toMatchObject([{ entry: { id: "native-card" }, folderIcons: [{ name: "smartphone", path: ["Agents"] }] }]);
});

it("categorizes and filters external library components", () => {
  const button = entry({
    id: "button",
    label: "Button",
    relativePath: "src/primitives/Button/index.tsx",
  });
  const chat = entry({ id: "chat", label: "AiChat" });
  const catalog: RuntimeSourceLibraryCatalog = {
    packageName: "@dotnaos/react-ui",
    release: { entries: [button, chat], styles: [], version: "0.0.5" },
  };
  const library: SourceWorkspaceLibrary = {
    components: [
      { category: "primitive", evidence: "package-export", name: "Button" },
      { category: "component", evidence: "package-export", name: "AiChat" },
    ],
    editable: false,
    mode: "release",
    packageName: "@dotnaos/react-ui",
    version: "0.0.5",
  };
  const components = sourceCatalogComponents({
    catalog,
    device: "desktop",
    kind: "library",
    library,
    mode: "release",
  });

  expect(filterSourceCatalog(components, "", "primitive").map((component) => component.label)).toEqual(["Button"]);
  expect(filterSourceCatalog(components, "chat", "all").map((component) => component.label)).toEqual(["AiChat"]);
});

it("groups library components by the nearest named package", () => {
  const components = sourceCatalogComponents({
    catalog: {
      packageName: "@dotnaos/ui",
      development: {
        devices: [],
        entries: [
          entry({ id: "base-button", label: "Button", relativePath: "src/components/base/Button.tsx", design: design("base-button") }),
          entry({ id: "layout-button", label: "Button", relativePath: "src/components/layout/Button.tsx", design: design("layout-button") }),
          entry({ id: "chat-message", label: "Message", relativePath: "src/components/chat/messages/Message.tsx", design: design("chat-message") }),
        ],
        packages: [
          { directory: "src/components/base", name: "@dotnaos/ui/base" },
          { directory: "src/components/layout", name: "@dotnaos/ui/layout" },
          { directory: "src/components/chat", name: "@dotnaos/ui/ai" },
        ],
        runtime: "react",
        sourceRoot: "src",
        styles: [],
      },
    },
    device: "desktop",
    kind: "library",
    library: {
      components: [
        { name: "Button", evidence: "package-export" },
        { name: "Button", evidence: "package-export" },
        { name: "Message", evidence: "package-export" },
      ],
      editable: true,
      mode: "development",
      packageName: "@dotnaos/ui",
      version: "0.0.0",
    },
    mode: "development",
  });

  expect(components.map(({ label, path }) => ({ label, path }))).toEqual([
    { label: "Button", path: ["base", "Button"] },
    { label: "Button", path: ["layout", "Button"] },
    { label: "Message", path: ["chat", "messages", "Message"] },
  ]);
  expect(components[0]?.packagePaths).toEqual([["base"]]);
});

it("uses the public component label as the leaf without repeating its source folder", () => {
  const action = entry({
    id: "action-button",
    label: "ActionButton",
    exportName: "ActionButton",
    relativePath: "src/components/actions/ActionButton/render.tsx",
    design: design("action-button"),
  });
  const components = sourceCatalogComponents({
    catalog: {
      packageName: "@dotnaos/react-ui",
      development: {
        devices: [],
        entries: [action],
        runtime: "react",
        sourceRoot: "src",
        styles: [],
      },
    },
    device: "desktop",
    kind: "library",
    library: {
      components: [{ evidence: "package-export", name: "ActionButton" }],
      editable: true,
      mode: "development",
      packageName: "@dotnaos/react-ui",
      version: "0.0.0",
    },
    mode: "development",
  });

  expect(components[0]?.path).toEqual(["actions", "ActionButton"]);
});

it("uses designed Development source entries instead of an older installed package catalog", () => {
  const button = entry({
    id: "button",
    label: "Button",
    relativePath: "src/primitives/Button/index.tsx",
    design: design("button"),
  });
  const internalButton = entry({
    id: "button-internal",
    label: "ButtonInternal",
    relativePath: "src/primitives/Button/ButtonInternal.tsx",
  });
  const sourceOnly = entry({
    id: "source-only",
    label: "SourceOnly",
    relativePath: "src/components/SourceOnly.tsx",
    design: design("source-only"),
  });
  const catalog: RuntimeSourceLibraryCatalog = {
    packageName: "@dotnaos/react-ui",
    development: {
      devices: [],
      entries: [button, internalButton, sourceOnly],
      runtime: "react",
      sourceRoot: "src",
      styles: [],
    },
  };
  const library: SourceWorkspaceLibrary = {
    components: [
      { category: "primitive", evidence: "package-export", name: "Button" },
      { category: "component", evidence: "package-export", name: "InstalledOnly" },
    ],
    editable: false,
    mode: "release",
    packageName: "@dotnaos/react-ui",
    version: "0.0.6",
  };

  const components = sourceCatalogComponents({
    catalog,
    device: "desktop",
    kind: "library",
    library,
    mode: "development",
  });

  expect(components.map((component) => component.label)).toEqual(["Button", "ButtonInternal", "SourceOnly"]);
  expect(components[0].entry).toBe(button);
  expect(components[1].entry).toBe(internalButton);
  expect(components[2].entry).toBe(sourceOnly);
});
