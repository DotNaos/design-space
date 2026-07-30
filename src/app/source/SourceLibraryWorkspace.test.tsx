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

it("shows native development and release sources with a design coverage audit", async () => {
  const change = vi.fn();
  render(
    <SourceLibrarySidebar
      catalog={catalog}
      catalogKind="library"
      device="desktop"
      library={library}
      mode="release"
      onDeviceChange={vi.fn()}
      onCatalogKindChange={vi.fn()}
      onModeChange={change}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByText("1/2")).toBeVisible();
  expect(screen.getByLabelText("Card design missing")).toBeVisible();
  expect(screen.queryByLabelText("Button design missing")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Button/, pressed: true })).toBeVisible();
  expect(screen.getByRole("button", { name: /Card/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Development/ }));
  expect(change).toHaveBeenCalledWith("development");
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

it("keeps the flat catalog, selected component layers, and code in one explorer", () => {
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

  expect(screen.getByRole("button", { name: /Button/, pressed: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "Selected component layers" })).toBeVisible();
  expect(screen.getByText("Editable component code")).toBeVisible();
  expect(screen.getByText("<button>")).toBeVisible();
});

it("shows app-built components as a separate flat catalog", async () => {
  const change = vi.fn();
  render(
    <SourceLibrarySidebar
      appWorkspace={{ ...catalog.development!, entries: [entry] }}
      catalog={catalog}
      catalogKind="app"
      device="desktop"
      library={library}
      mode="development"
      onCatalogKindChange={change}
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /Button/ })).toBeVisible();
  expect(screen.queryByLabelText("Button design missing")).not.toBeInTheDocument();
  expect(screen.getByText("src")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /UI library/ }));
  expect(change).toHaveBeenCalledWith("library");
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
