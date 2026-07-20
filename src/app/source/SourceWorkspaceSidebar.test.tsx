import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type {
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceDeviceState,
} from "../../shared/source-workspace";
import { SourceWorkspaceSidebar, type SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

afterEach(cleanup);

const desktopLayout: RuntimeSourceWorkspaceEntry = {
  id: "layout-desktop",
  label: "DesktopLayout",
  area: "layout",
  device: "desktop",
  fileId: "file-layout-desktop",
  relativePath: "src/app/desktop/layout.tsx",
  exportName: "default",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 1 },
  uses: ["Dashboard"],
  layers: [{
    id: "layout-main",
    label: "main",
    kind: "html",
    source: { start: 1, end: 2 },
    children: [{
      id: "layout-dashboard",
      label: "Dashboard",
      kind: "component",
      source: { start: 2, end: 3 },
      children: [{
        id: "layout-dashboard-content",
        label: "content",
        kind: "slot",
        source: { start: 3, end: 4 },
        children: [{ id: "layout-summary", label: "ProjectSummary", kind: "component", source: { start: 4, end: 5 }, children: [] }],
        slot: {
          contract: { name: "content", type: "ComponentSlot<typeof ProjectSummary>", required: true, multiple: false, accepts: ["ProjectSummary"], min: 1, max: 1 },
          validity: "full",
          received: ["ProjectSummary"],
          edit: { kind: "single", insertAt: 3, value: { start: 4, end: 5 } },
        },
      }],
    }],
  }],
  component: () => null,
};

const desktopPage: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "page-dashboard-desktop",
  label: "Dashboard",
  area: "pages",
  fileId: "file-dashboard-desktop",
  relativePath: "src/app/desktop/pages/Dashboard.tsx",
  exportName: "Dashboard",
  uses: ["ProjectSummary"],
  layers: [{
    id: "dashboard-section",
    label: "section",
    kind: "html",
    source: { start: 1, end: 2 },
    children: [{ id: "dashboard-summary", label: "ProjectSummary", kind: "component", source: { start: 2, end: 3 }, children: [] }],
  }],
};

const mobileLayout: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "layout-mobile",
  label: "MobileLayout",
  device: "mobile",
  fileId: "file-layout-mobile",
  relativePath: "src/app/mobile/layout.tsx",
};

const summaryDesktop: RuntimeSourceWorkspaceEntry = {
  ...desktopLayout,
  id: "summary-desktop",
  label: "ProjectSummary",
  area: "components",
  fileId: "file-summary-desktop",
  relativePath: "src/app/components/ProjectSummary/desktop.tsx",
  exportName: "ProjectSummary",
  layers: [{
    id: "summary-article",
    label: "article",
    kind: "html",
    source: { start: 1, end: 2 },
    children: [{ id: "summary-title", label: "h2", kind: "html", source: { start: 2, end: 3 }, children: [] }],
  }],
};

const summaryMobile: RuntimeSourceWorkspaceEntry = {
  ...summaryDesktop,
  id: "summary-mobile",
  device: "mobile",
  fileId: "file-summary-mobile",
  relativePath: "src/app/components/ProjectSummary/mobile.tsx",
};

const states: readonly SourceWorkspaceDeviceState[] = [
  { area: "layout", device: "desktop", path: "src/app/desktop/layout.tsx", state: "configured" },
  { area: "layout", device: "tablet", path: "src/app/tablet/layout.tsx", state: "fallback", fallback: "desktop" },
  { area: "layout", device: "mobile", path: "src/app/mobile/layout.tsx", state: "configured" },
  { area: "pages", device: "desktop", path: "src/app/desktop/pages", state: "configured" },
  { area: "pages", device: "tablet", path: "src/app/tablet/pages", state: "fallback", fallback: "desktop" },
  { area: "pages", device: "mobile", path: "src/app/mobile/pages", state: "missing" },
  { area: "components", device: "desktop", path: "src/app/components/*/desktop.tsx", state: "configured" },
  { area: "components", device: "tablet", path: "src/app/components/*/tablet.tsx", state: "fallback", fallback: "desktop" },
  { area: "components", device: "mobile", path: "src/app/components/*/mobile.tsx", state: "configured" },
];

const workspace: RuntimeSourceWorkspace = {
  runtime: "react",
  sourceRoot: "src/app",
  devices: states,
  entries: [desktopLayout, mobileLayout, desktopPage, summaryDesktop, summaryMobile],
  styles: [],
  capabilities: { createComponents: true },
};

const callbacks = {
  onFocus: vi.fn(),
  onApplySlot: vi.fn(),
  onSelect: vi.fn(),
};

it("offers target-owned component creation from the focused tree", async () => {
  const onCreateComponent = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      workspace={workspace}
      onCreateComponent={onCreateComponent}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Create component" }));
  expect(onCreateComponent).toHaveBeenCalledOnce();
});

it("shows composition, typed slots, components, and HTML in one expandable tree", async () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Source tree" });
  expect(within(tree).getByRole("treeitem", { name: "DesktopLayout" })).toHaveAttribute("aria-level", "1");
  expect(within(tree).getByRole("button", { name: "Dashboard, focused" })).toBeVisible();
  expect(within(tree).queryByRole("treeitem", { name: "content" })).not.toBeInTheDocument();
  await userEvent.click(within(tree).getByRole("button", { name: "Expand Dashboard" }));
  expect(within(tree).getByRole("treeitem", { name: "content" })).toHaveAttribute("aria-level", "4");
  expect(within(tree).getByRole("treeitem", { name: "<section>" })).toHaveAttribute("aria-level", "4");
  await userEvent.click(within(tree).getByRole("button", { name: "Expand content" }));
  await userEvent.click(within(tree).getByRole("button", { name: "Expand <section>" }));
  expect(within(tree).getAllByRole("treeitem", { name: "ProjectSummary" })).toHaveLength(2);
  expect(screen.queryByText("Shared components")).not.toBeInTheDocument();
});

it("moves focus to a child and preserves the direct parent path", async () => {
  const onFocus = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
  await userEvent.click(screen.getAllByRole("button", { name: "ProjectSummary" })[0]!);
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("pages:Dashboard"), expect.objectContaining({
    device: "desktop",
    nodeId: expect.stringContaining("ProjectSummary"),
    kind: "component",
  }));
  expect(onFocus.mock.calls[0]?.[1]).not.toHaveProperty("layerId");
  expect(onFocus.mock.calls[0]?.[1]).not.toHaveProperty("sourceNodeId");
});

it("does not expose a separate Layers mode", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Source tree views" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Show (component layers|composition tree)/ })).not.toBeInTheDocument();
});

it("drills into local components and selects HTML in the same tree", async () => {
  const onFocus = vi.fn();
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      onFocus={onFocus}
      onSelect={onSelect}
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand <section>" }));
  await userEvent.click(screen.getAllByRole("button", { name: "ProjectSummary" })[1]!);
  expect(onFocus).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    kind: "component",
    nodeId: expect.stringContaining("ProjectSummary"),
  }));
  expect(onSelect).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "<section>" }));
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: "html",
    layerId: "dashboard-section",
    sourceNodeId: expect.stringContaining("Dashboard"),
  }));
});

it("keeps the visible tree in place when a component is selected", async () => {
  function ControlledTree() {
    const [focusId, setFocusId] = useState<string>();
    const [selected, setSelected] = useState<SourceWorkspaceSelection>();
    return (
      <SourceWorkspaceSidebar
        {...callbacks}
        focusId={focusId}
        selected={selected}
        workspace={workspace}
        onFocus={(nextFocusId, nextSelection) => {
          setFocusId(nextFocusId);
          setSelected(nextSelection);
        }}
      />
    );
  }

  render(<ControlledTree />);
  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
  const tree = screen.getByRole("tree", { name: "Source tree" });
  const labelsBefore = within(tree).getAllByRole("treeitem").map((item) => item.getAttribute("aria-label"));

  await userEvent.click(screen.getAllByRole("button", { name: "ProjectSummary" })[0]!);

  expect(within(tree).getAllByRole("treeitem").map((item) => item.getAttribute("aria-label"))).toEqual(labelsBefore);
  expect(screen.getByRole("button", { name: "Collapse Dashboard" })).toHaveAttribute("aria-expanded", "true");
});

it("changes branch visibility only from the chevron", async () => {
  const onFocus = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  expect(screen.getByRole("treeitem", { name: "content" })).toBeVisible();
  expect(onFocus).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Collapse Dashboard" }));
  expect(screen.queryByRole("treeitem", { name: "content" })).not.toBeInTheDocument();
  expect(onFocus).not.toHaveBeenCalled();
});

it("keeps a visible slot picker usable without selecting the slot row", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onSelect={onSelect} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  const picker = screen.getByRole("button", { name: "Replace content in content slot" });
  expect(picker).toBeVisible();

  await userEvent.click(picker);
  expect(await screen.findByRole("listbox", { name: "Compatible components" })).toBeVisible();
  expect(onSelect).not.toHaveBeenCalled();
});
