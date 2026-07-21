import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { RuntimeSourceLibraryCatalog, RuntimeSourceWorkspaceEntry, SourceWorkspaceLibrary } from "../../shared/source-workspace";
import { SourceLibraryCanvas, SourceLibrarySidebar } from "./SourceLibraryWorkspace";

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
    { name: "Button", evidence: "package-export" },
    { name: "Card", evidence: "package-export" },
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
      device="desktop"
      library={library}
      mode="release"
      onDeviceChange={vi.fn()}
      onModeChange={change}
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByText("1/2")).toBeVisible();
  expect(screen.getByLabelText("Card design missing")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Development/ }));
  expect(change).toHaveBeenCalledWith("development");
});

it("generates a missing design only for the attached development source", async () => {
  const onGenerateDesign = vi.fn();
  const missingEntry = { ...entry, design: undefined };
  render(
    <SourceLibraryCanvas
      catalog={{ ...catalog, development: { ...catalog.development!, entries: [missingEntry] } }}
      device="desktop"
      library={{ ...library, components: [{ name: "Button", evidence: "package-export" }] }}
      mode="development"
      selected="library.development.Button"
      onDeviceChange={vi.fn()}
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
      device="desktop"
      library={{ ...library, components: [{ name: "Card", evidence: "package-export" }] }}
      mode="release"
      selected="library.release.Card"
      onDeviceChange={vi.fn()}
      onModeChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { name: "Design missing" })).toBeVisible();
  expect(screen.getByText(/does not include a colocated native design/)).toBeVisible();
});
