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
  mode: "focus" as const,
  onFocus: vi.fn(),
  onModeChange: vi.fn(),
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

it("keeps the default view focused and hides internal HTML", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Focused source tree" });
  expect(within(tree).getByRole("treeitem", { name: "DesktopLayout" })).toHaveAttribute("aria-level", "1");
  expect(within(tree).getByRole("button", { name: "Dashboard, focused" })).toBeVisible();
  expect(within(tree).getByRole("treeitem", { name: "content" })).toHaveAttribute("aria-level", "3");
  expect(within(tree).getByRole("treeitem", { name: "ProjectSummary" })).toHaveAttribute("aria-level", "4");
  expect(within(tree).queryByRole("treeitem", { name: "<main>" })).not.toBeInTheDocument();
  expect(screen.queryByText("Shared components")).not.toBeInTheDocument();
});

it("moves focus to a child and preserves the direct parent path", async () => {
  const onFocus = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "ProjectSummary" }));
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("pages:Dashboard"), expect.objectContaining({
    device: "desktop",
    nodeId: expect.stringContaining("ProjectSummary"),
    kind: "component",
  }));
  expect(onFocus.mock.calls[0]?.[1]).not.toHaveProperty("layerId");
  expect(onFocus.mock.calls[0]?.[1]).not.toHaveProperty("sourceNodeId");
});

it("switches explicitly to Overview and Layers", async () => {
  const onModeChange = vi.fn();
  const { rerender } = render(<SourceWorkspaceSidebar {...callbacks} onModeChange={onModeChange} workspace={workspace} />);
  await userEvent.click(screen.getByRole("button", { name: "Open overview source tree" }));
  expect(onModeChange).toHaveBeenCalledWith("overview");

  rerender(<SourceWorkspaceSidebar {...callbacks} mode="layers" workspace={workspace} />);
  const layers = screen.getByRole("tree", { name: "Focused component layers" });
  expect(within(layers).getByRole("treeitem", { name: "<section>" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Return to focused source tree from Layers" })).toHaveAttribute("aria-pressed", "true");
});

it("selects local component and HTML layers without changing component focus", async () => {
  const onFocus = vi.fn();
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      mode="layers"
      onFocus={onFocus}
      onSelect={onSelect}
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "ProjectSummary" }));
  expect(onFocus).not.toHaveBeenCalled();
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: "component",
    layerId: "dashboard-summary",
    sourceNodeId: expect.stringContaining("Dashboard"),
  }));

  await userEvent.click(screen.getByRole("button", { name: "<section>" }));
  expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: "html",
    layerId: "dashboard-section",
    sourceNodeId: expect.stringContaining("Dashboard"),
  }));
});
