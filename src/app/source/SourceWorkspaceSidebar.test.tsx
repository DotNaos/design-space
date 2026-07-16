import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type {
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceDeviceState,
} from "../../shared/source-workspace";
import { SourceWorkspaceSidebar } from "./SourceWorkspaceSidebar";

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
    children: [{ id: "layout-dashboard", label: "Dashboard", kind: "component", source: { start: 2, end: 3 }, children: [] }],
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

it("offers target-owned component creation from the app tree", async () => {
  const onCreateComponent = vi.fn();
  render(
    <SourceWorkspaceSidebar
      workspace={workspace}
      onCreateComponent={onCreateComponent}
      onSelect={() => undefined}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Create component" }));
  expect(onCreateComponent).toHaveBeenCalledOnce();
});

it("shows one static composition tree from the root through pages and components", () => {
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={() => undefined} />);

  const tree = screen.getByRole("tree", { name: "App source tree" });
  expect(within(tree).queryByRole("region", { name: "Layout source" })).not.toBeInTheDocument();
  expect(within(tree).queryByRole("region", { name: "Pages source" })).not.toBeInTheDocument();
  expect(within(tree).queryByRole("region", { name: "Components source" })).not.toBeInTheDocument();
  expect(within(tree).getByRole("treeitem", { name: "DesktopLayout" })).toHaveAttribute("aria-level", "1");
  expect(within(tree).getByRole("treeitem", { name: "<main>" })).toHaveAttribute("aria-level", "2");
  expect(within(tree).getByRole("treeitem", { name: "Dashboard" })).toHaveAttribute("aria-level", "3");
  expect(within(tree).queryByRole("treeitem", { name: "ProjectSummary" })).not.toBeInTheDocument();
  expect(within(tree).getByRole("button", { name: "DesktopLayout" })).toBeVisible();
  expect(within(tree).getByRole("button", { name: "Dashboard" })).toBeVisible();
  expect(within(screen.getByRole("tree", { name: "Shared components" })).getByRole("treeitem", { name: "ProjectSummary" })).toHaveAttribute("aria-level", "1");
});

it("expands component branches and reveals their authored HTML layers", async () => {
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={() => undefined} />);

  expect(screen.queryByRole("treeitem", { name: "<section>" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  expect(screen.getByRole("treeitem", { name: "<section>" })).toBeVisible();
  const appTree = screen.getByRole("tree", { name: "App source tree" });
  const sharedTree = screen.getByRole("tree", { name: "Shared components" });
  expect(within(appTree).getByRole("treeitem", { name: "ProjectSummary" })).toBeVisible();
  expect(within(sharedTree).queryByRole("treeitem", { name: "<article>" })).not.toBeInTheDocument();
  await userEvent.click(within(sharedTree).getByRole("button", { name: "Expand ProjectSummary" }));
  expect(within(sharedTree).getByRole("treeitem", { name: "<article>" })).toBeVisible();
  expect(within(sharedTree).getByRole("treeitem", { name: "<h2>" })).toBeVisible();
  await userEvent.click(within(sharedTree).getByRole("button", { name: "Collapse ProjectSummary" }));
  expect(within(sharedTree).queryByRole("treeitem", { name: "<article>" })).not.toBeInTheDocument();
});

it("shows only missing dedicated platform implementations", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  const component = within(screen.getByRole("tree", { name: "App source tree" })).getByRole("button", { name: "ProjectSummary" });
  expect(within(component).getByRole("img", {
    name: "Tablet has no dedicated implementation and uses Desktop",
  })).toBeVisible();
  expect(within(component).getByRole("img").querySelectorAll("svg")).toHaveLength(1);
});

it("selects a logical node without changing the active canvas device", async () => {
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      selected={{ device: "tablet", nodeId: "layout:app" }}
      workspace={workspace}
      onSelect={onSelect}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  expect(onSelect).toHaveBeenCalledWith({ device: "tablet", nodeId: "pages:Dashboard" });
});

it("selects an authored HTML layer and keeps every JSX component on the same node kind", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar workspace={workspace} onSelect={onSelect} />);

  const pageButton = screen.getByRole("button", { name: "Dashboard" });
  expect(pageButton.querySelector("svg.lucide-component")).toBeInTheDocument();
  expect(pageButton.closest('[role="treeitem"]')).toHaveClass("min-h-10");

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "<section>" }));
  expect(onSelect).toHaveBeenLastCalledWith({
    device: "desktop",
    layerId: "dashboard-section",
    nodeId: "pages:Dashboard",
  });
});
