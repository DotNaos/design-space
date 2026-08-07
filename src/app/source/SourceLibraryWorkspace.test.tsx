import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceLibraryCatalog, RuntimeSourceWorkspaceEntry, SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { SourceLibraryExplorer } from "./SourceLibraryExplorer";
import { SourceLibraryCanvas, SourceLibrarySidebar } from "./SourceLibraryWorkspace";
import { findSourceLibraryLayerOwner } from "./source-library-selection";

afterEach(cleanup);

const entry: RuntimeSourceWorkspaceEntry = {
  id: "source.entry.button",
  label: "Button",
  area: "components",
  device: "desktop",
  fileId: "source.file.button",
  relativePath: "src/shared/button/index.ts",
  exportName: "Button",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 10 },
  component: () => null,
  design: {
    fileId: "source.file.button-design",
    relativePath: "src/shared/button/index.design.tsx",
    load: async () => ({
      component: () => null,
      defaults: {},
      initialCase: "default",
      isStateful: false,
      cases: { default: {} },
      render: () => <button>Button preview</button>,
    }),
  },
};

const library: SourceWorkspaceLibrary = {
  packageName: "@dotnaos/react-ui",
  version: "^0.0.5",
  mode: "release",
  editable: false,
  components: [
    { name: "Button", evidence: "package-export", category: "primitive" },
    { name: "Card", evidence: "package-export", category: "component" },
  ],
};

const catalog: RuntimeSourceLibraryCatalog = {
  packageName: "@dotnaos/react-ui",
  development: {
    runtime: "react",
    sourceRoot: "src",
    entries: [entry],
    devices: [],
    styles: [],
  },
  release: { version: "0.0.5", entries: [entry], styles: [] },
};

it("shows only the development source with a design coverage audit", () => {
  render(
    <SourceLibrarySidebar
      catalog={catalog}
      catalogKind="library"
      device="desktop"
      library={library}
      mode="development"
      onDeviceChange={vi.fn()}
      onCatalogKindChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByText("1/2")).toBeVisible();
  expect(screen.getByRole("group", { name: "Primitives" })).toBeVisible();
  expect(screen.queryByLabelText("Button design missing")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Button", pressed: true })).toHaveClass("rounded-full", "bg-violet-500/[0.14]", "text-violet-200");
  expect(screen.getByRole("button", { name: "Card" })).toBeVisible();
  expect(screen.getByLabelText("Card design missing")).toBeVisible();
  expect(screen.queryByText("Component")).not.toBeInTheDocument();
  expect(screen.queryByText("Primitive")).not.toBeInTheDocument();
  expect(screen.queryByText("Installed")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Installed library version" })).not.toBeInTheDocument();
});

it("searches the flat library catalog", async () => {
  const button = {
    ...entry,
    layers: [{
      id: "html.button",
      label: "button",
      kind: "html" as const,
      children: [],
      source: { start: 2, end: 8 },
    }],
  };
  const card: RuntimeSourceWorkspaceEntry = {
    ...entry,
    id: "source.entry.card",
    label: "Card",
    fileId: "source.file.card",
    relativePath: "src/shared/card/index.ts",
    exportName: "Card",
    layers: [{
      id: "html.article",
      label: "article",
      kind: "html",
      children: [],
      source: { start: 2, end: 8 },
    }],
  };
  render(
    <SourceLibrarySidebar
      catalog={{ ...catalog, development: { ...catalog.development!, entries: [button, card] } }}
      catalogKind="library"
      device="desktop"
      library={library}
      mode="development"
      selected="library.development.Button"
      onDeviceChange={vi.fn()}
      onCatalogKindChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  const search = screen.getByRole("textbox", { name: "Search components" });
  await userEvent.type(search, "Card");
  expect(screen.getByRole("button", { name: /Card/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /^Button/ })).not.toBeInTheDocument();
});

it("drills from the component catalog into its layers and back", async () => {
  const layeredEntry: RuntimeSourceWorkspaceEntry = {
    ...entry,
    layers: [{
      id: "html.button",
      label: "button",
      kind: "html",
      children: [],
      source: { start: 2, end: 8 },
    }],
  };
  render(
    <SourceLibraryExplorer
      catalog={{ ...catalog, development: { ...catalog.development!, entries: [layeredEntry] } }}
      catalogKind="library"
      code={<div>Editable component code</div>}
      codeOpen
      device="desktop"
      library={{ ...library, components: [{ name: "Button", evidence: "package-export" }] }}
      mode="development"
      selected="library.development.Button"
      onCatalogKindChange={vi.fn()}
      onCodeOpenChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  const componentButton = screen.getByRole("button", { name: /Button/, pressed: true });
  expect(componentButton).toBeVisible();
  expect(screen.queryByRole("region", { name: "Selected component layers" })).not.toBeInTheDocument();
  expect(screen.getByText("Editable component code")).toBeVisible();

  await userEvent.click(componentButton);
  expect(screen.getByRole("region", { name: "Selected component layers" })).toBeVisible();
  expect(screen.getByText("<button>")).toBeVisible();
  expect(screen.queryByRole("textbox", { name: "Search components" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Back to component catalog" }));
  expect(screen.getByRole("textbox", { name: "Search components" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Selected component layers" })).not.toBeInTheDocument();
});

it("can render app-built components without adding another source switch", () => {
  render(
    <SourceLibrarySidebar
      appWorkspace={{ ...catalog.development!, entries: [entry] }}
      catalog={catalog}
      catalogKind="app"
      device="desktop"
      library={library}
      mode="development"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /Button/ })).toBeVisible();
  expect(screen.queryByLabelText("Button design missing")).not.toBeInTheDocument();
  expect(screen.queryByText("src")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Component source" })).not.toBeInTheDocument();
});

it("mirrors nested app component folders and keeps duplicate leaf names selectable", async () => {
  const onSelect = vi.fn();
  const appEntries: RuntimeSourceWorkspaceEntry[] = [
    {
      ...entry,
      id: "agents-card",
      label: "AgentCard",
      exportName: "AgentCard",
      relativePath: "src/app/components/Agents/AgentCard/desktop.tsx",
    },
    {
      ...entry,
      id: "agents-tool-call",
      label: "ToolCall",
      exportName: "ToolCall",
      relativePath: "src/app/components/Agents/Tools/ToolCall.tsx",
    },
    {
      ...entry,
      id: "git-card",
      label: "AgentCard",
      exportName: "AgentCard",
      relativePath: "src/app/components/Git/AgentCard/desktop.tsx",
    },
    {
      ...entry,
      id: "flat-button",
      relativePath: "src/app/components/Button.tsx",
    },
  ];
  render(
    <SourceLibrarySidebar
      appWorkspace={{ ...catalog.development!, entries: appEntries }}
      catalogKind="app"
      device="desktop"
      mode="development"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={onSelect}
    />,
  );

  expect(screen.getByRole("button", { name: "Agents / AgentCard" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Git / AgentCard" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Agents / Tools / ToolCall" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Button" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Collapse folder Agents" }));
  expect(screen.queryByRole("button", { name: "Agents / AgentCard" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Git / AgentCard" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Expand folder Agents" }));
  await userEvent.click(screen.getByRole("button", { name: "Git / AgentCard" }));
  expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("components:implementation:Git/AgentCard:AgentCard"));
});

it("does not duplicate the library identity from the global workspace switch", () => {
  render(
    <SourceLibrarySidebar
      catalog={catalog}
      catalogKind="library"
      device="desktop"
      library={library}
      mode="development"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.queryByRole("heading", { name: "Library" })).not.toBeInTheDocument();
  expect(screen.queryByText("@dotnaos/react-ui")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Workspace source/ })).not.toBeInTheDocument();
  expect(screen.queryByText("Installed")).not.toBeInTheDocument();
});

it("keeps the compact category filter beside component search", () => {
  render(
    <SourceLibrarySidebar
      catalog={catalog}
      catalogKind="library"
      device="desktop"
      library={library}
      mode="development"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByRole("textbox", { name: "Search components" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Component category/ })).toHaveClass("size-9", "rounded-full");
});

it("fills the available canvas with its empty state", () => {
  render(
    <SourceLibraryCanvas
      catalog={{ ...catalog, development: { ...catalog.development!, entries: [] } }}
      catalogKind="library"
      device="desktop"
      mode="development"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "No component selected" }).parentElement?.parentElement)
    .toHaveClass("w-full", "flex-1");
});

it("shows selected library code in the shared Codex composer", async () => {
  render(
    <SourceLibraryCanvas
      catalog={catalog}
      catalogKind="library"
      codeContexts={[{
        endColumn: 20,
        endLine: 16,
        id: "src/shared/button/render.tsx:4-16",
        relativePath: "src/shared/button/render.tsx",
        selectedText: "export function Button() {}",
        startColumn: 1,
        startLine: 4,
      }]}
      device="desktop"
      library={library}
      mode="development"
      selected="library.development.Button"
      onCatalogKindChange={vi.fn()}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
    />,
  );

  expect(await screen.findByLabelText("Attached code context")).toHaveTextContent("render.tsx:4–16");
});

it("generates a missing design only for the attached development source", async () => {
  const onGenerateDesign = vi.fn();
  const missingEntry = { ...entry, design: undefined };
  render(
    <SourceLibraryCanvas
      catalog={{ ...catalog, development: { ...catalog.development!, entries: [missingEntry] } }}
      catalogKind="library"
      device="desktop"
      library={{ ...library, components: [{ name: "Button", evidence: "package-export" }] }}
      mode="development"
      selected="library.development.Button"
      onDeviceChange={vi.fn()}
      onCatalogKindChange={vi.fn()}
      onGenerateDesign={onGenerateDesign}
      onModeChange={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Generate design" }));
  expect(onGenerateDesign).toHaveBeenCalledWith(missingEntry);
});

it("explains when an installed export has no native design", () => {
  render(
    <SourceLibraryCanvas
      catalog={{ ...catalog, release: { version: "0.0.5", entries: [], styles: [] } }}
      catalogKind="library"
      device="desktop"
      library={{ ...library, components: [{ name: "Card", evidence: "package-export" }] }}
      mode="release"
      selected="library.release.Card"
      onDeviceChange={vi.fn()}
      onCatalogKindChange={vi.fn()}
      onModeChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "Design missing" })).toBeVisible();
  expect(screen.getByText(/does not include a colocated native design/)).toBeVisible();
});

it("resolves a selected rendered layer to the source entry that owns it", () => {
  const nestedOwner: RuntimeSourceWorkspaceEntry = {
    ...entry,
    id: "source.entry.button-container",
    label: "ButtonContainer",
    fileId: "source.file.button-container",
    relativePath: "src/shared/button/ButtonContainer.tsx",
    exportName: "ButtonContainer",
    design: undefined,
    layers: [{
      id: "jsx:button-container:12",
      label: "button",
      kind: "html",
      children: [],
      source: { start: 12, end: 42 },
    }],
  };

  expect(findSourceLibraryLayerOwner({ ...catalog.development!, entries: [entry, nestedOwner] }, "jsx:button-container:12"))
    .toBe(nestedOwner);
  expect(findSourceLibraryLayerOwner(catalog.development, "missing-layer")).toBeUndefined();
});
