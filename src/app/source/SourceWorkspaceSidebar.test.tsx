import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type {
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceDeviceState,
} from "../../shared/source-workspace";
import { initialFocusOccurrence, sourceFocusGraph } from "./source-focus-tree";
import { sourceTreeNodes } from "./source-workspace-tree";
import { SourceWorkspaceSidebar, type SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

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

const directSlotWorkspace: RuntimeSourceWorkspace = {
  ...workspace,
  entries: [{
    ...desktopLayout,
    id: "slot-root",
    label: "SlotRoot",
    uses: ["ProjectSummary"],
    layers: [{
      id: "root-content",
      label: "content",
      kind: "slot",
      source: { start: 2, end: 5 },
      children: [{
        id: "root-summary",
        label: "ProjectSummary",
        kind: "component",
        source: { start: 3, end: 4 },
        children: [],
      }],
      slot: {
        contract: {
          name: "content",
          type: "ComponentSlot<typeof ProjectSummary>",
          required: true,
          multiple: false,
          accepts: ["ProjectSummary"],
          min: 1,
          max: 1,
        },
        validity: "full",
        received: ["ProjectSummary"],
        edit: { kind: "single", insertAt: 2, value: { start: 3, end: 4 } },
      },
    }],
  }, summaryDesktop],
};

const callbacks = {
  onFocus: vi.fn(),
  onApplySlot: vi.fn(),
  onSelect: vi.fn(),
};

async function revealDashboard() {
  await userEvent.click(screen.getByRole("button", { name: "Expand DesktopLayout" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand <main>" }));
  return screen.getByRole("button", { name: "Dashboard" });
}

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

it("offers a clear return to the full app tree while drilling into a component", async () => {
  const onExit = vi.fn();
  const onOpenParent = vi.fn();
  const onCreateComponent = vi.fn();
  const view = render(
    <SourceWorkspaceSidebar
      {...callbacks}
      designNavigation={{
        parentLabel: "Dashboard",
        onExit,
        onOpenParent,
      }}
      onCreateComponent={onCreateComponent}
      workspace={workspace}
    />,
  );

  const returnAction = screen.getByRole("button", { name: "Return to full app tree" });
  const header = returnAction.closest("header")!;
  const headerActions = within(header).getAllByRole("button");
  expect(headerActions[0]).toBe(returnAction);
  expect(headerActions[1]).toHaveAccessibleName("Create component");
  expect(headerActions[2]).toHaveAccessibleName(/Show approval checklist/);

  await userEvent.click(returnAction);
  expect(onOpenParent).not.toHaveBeenCalled();
  expect(onExit).toHaveBeenCalledOnce();

  view.rerender(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: "Return to full app tree" })).not.toBeInTheDocument();
});

it("does not show a return action while already at the app root", () => {
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      designNavigation={{ onExit: vi.fn() }}
      workspace={workspace}
    />,
  );

  expect(screen.queryByRole("button", { name: "Return to full app tree" })).not.toBeInTheDocument();
});

it("reveals the cryptographic approval checklist without replacing the source tree", async () => {
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      workspace={{
        ...workspace,
        approvals: {
          status: "not-configured",
          reason: "Cryptographic component approvals are not configured.",
          components: {},
        },
      }}
    />,
  );

  const toggle = screen.getByRole("button", { name: /Show approval checklist/ });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryAllByRole("img", { name: /Unreviewed/ })).toHaveLength(0);
  expect(screen.queryByRole("region", { name: "Approval review" })).not.toBeInTheDocument();

  await userEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("tree", { name: "Source tree" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Approval review" })).toHaveTextContent("0 / 5 approved");
  expect(screen.getByRole("region", { name: "Approval review" })).toHaveTextContent("5 to review");
  expect(screen.getAllByRole("img", { name: /Unreviewed · approvals not configured/ }).length).toBeGreaterThan(0);
  expect(
    within(screen.getByRole("button", { name: "DesktopLayout" }))
      .getByRole("img", { name: "Unreviewed · approvals not configured" }),
  ).toBeVisible();
});

it("reports approval review mode changes to the canvas owner", async () => {
  const onApprovalReviewChange = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      approvalReview={false}
      onApprovalReviewChange={onApprovalReviewChange}
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Show approval checklist/ }));
  expect(onApprovalReviewChange).toHaveBeenCalledWith(true);
});

it("shows verified component approvals in checklist mode", async () => {
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      workspace={{
        ...workspace,
        approvals: {
          status: "verified",
          policyId: "ui-components",
          components: {
            [desktopLayout.id]: {
              scopeId: "component:src/app/desktop/layout.tsx#default",
              label: "DesktopLayout",
              state: "approved",
              attestation: "SHA256:verified",
            },
          },
        },
      }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: /Show approval checklist/ }));
  expect(screen.getByRole("region", { name: "Approval review" })).toHaveTextContent("1 / 5 approved");
  expect(screen.getByRole("img", { name: "Approved · DesktopLayout" })).toBeVisible();
});

it("shows the full app tree, selects on click, and drills down on double-click", async () => {
  const onFocus = vi.fn();
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} onSelect={onSelect} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Source tree" });
  const root = within(tree).getByRole("treeitem", { name: "DesktopLayout" });
  expect(root).toHaveAttribute("aria-level", "1");
  expect(root).toHaveAttribute("aria-selected", "false");
  expect(within(tree).queryByRole("button", { name: "DesktopLayout, focused" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Source implementation" })).not.toBeInTheDocument();
  expect(within(tree).queryByRole("treeitem", { name: "Dashboard" })).not.toBeInTheDocument();

  const dashboard = await revealDashboard();
  expect(within(tree).getByRole("treeitem", { name: "Dashboard" })).toHaveAttribute("aria-level", "3");
  expect(within(tree).getByRole("button", { name: "Expand Dashboard" })).toBeVisible();

  await userEvent.click(dashboard);
  expect(within(tree).getByRole("treeitem", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true");
  expect(dashboard).toHaveClass("bg-white/[0.06]");
  expect(dashboard).not.toHaveClass("bg-sky-500/15");
  expect(screen.queryByRole("group", { name: "Source implementation" })).not.toBeInTheDocument();
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    kind: "component",
    nodeId: expect.stringContaining("Dashboard"),
  }));
  expect(onFocus).not.toHaveBeenCalled();

  await userEvent.dblClick(dashboard);
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("Dashboard"), expect.objectContaining({
    kind: "component",
    nodeId: expect.stringContaining("Dashboard"),
  }));
});

it("keeps deeply nested tree labels readable through horizontal scrolling", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Source tree" });
  const scrollViewport = tree.parentElement;
  const label = within(tree).getByText("DesktopLayout");

  expect(scrollViewport).toHaveAttribute("data-source-tree-scroll");
  expect(scrollViewport).toHaveClass("overflow-auto");
  expect(tree).toHaveClass("min-w-max");
  expect(label).toHaveClass("whitespace-nowrap");
  expect(label).not.toHaveClass("truncate");
});

it("reports the hovered tree layer without changing the selection", async () => {
  const onHover = vi.fn();
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      onHover={onHover}
      onSelect={onSelect}
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand DesktopLayout" }));
  const main = screen.getByRole("treeitem", { name: "<main>" });
  await userEvent.hover(main);
  expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: "html",
    layerId: "layout-main",
  }));
  expect(onSelect).not.toHaveBeenCalled();

  await userEvent.unhover(main);
  expect(onHover).toHaveBeenLastCalledWith(undefined);
});

it("keeps the tree fully visible until component hover previews its ownership", async () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  await revealDashboard();
  const root = screen.getByRole("treeitem", { name: "DesktopLayout" });
  const dashboard = screen.getByRole("treeitem", { name: "Dashboard" });
  expect(root.className).not.toMatch(/opacity-/);
  expect(dashboard.className).not.toMatch(/opacity-/);

  await userEvent.hover(dashboard);
  expect(root).toHaveClass("opacity-35");
  expect(dashboard).not.toHaveClass("opacity-35");

  await userEvent.unhover(dashboard);
  expect(root.className).not.toMatch(/opacity-/);
  expect(dashboard.className).not.toMatch(/opacity-/);
});

it("selects a nested component on click and opens it on double-click or Enter", async () => {
  const onFocus = vi.fn();
  const onOpenComponent = vi.fn();
  const onSelect = vi.fn();
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      onFocus={onFocus}
      onOpenComponent={onOpenComponent}
      onSelect={onSelect}
      workspace={workspace}
    />,
  );

  const dashboard = await revealDashboard();
  await userEvent.click(dashboard);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "component" }));
  expect(onFocus).not.toHaveBeenCalled();

  await userEvent.dblClick(dashboard);
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("Dashboard"), expect.objectContaining({
    kind: "component",
  }));
  expect(onOpenComponent).not.toHaveBeenCalled();

  onFocus.mockClear();
  dashboard.focus();
  await userEvent.keyboard("{Enter}");
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("Dashboard"), expect.objectContaining({
    kind: "component",
  }));
});

it("opens a same-file component definition without requiring design evidence", async () => {
  const onFocus = vi.fn();
  const onOpenComponent = vi.fn();
  const localWorkspace: RuntimeSourceWorkspace = {
    ...workspace,
    entries: [{
      ...desktopLayout,
      id: "local-root",
      label: "LocalRoot",
      uses: [],
      layers: [{
        id: "local-section",
        label: "section",
        kind: "html",
        source: { start: 20, end: 90 },
        children: [{
          id: "local-control-section",
          label: "ControlSection",
          kind: "component",
          source: { start: 42, end: 60 },
          definition: { start: 4, end: 18 },
          children: [{
            id: "local-control-html",
            label: "section",
            kind: "html",
            source: { start: 8, end: 17 },
            children: [],
          }],
        }],
      }],
    }],
  };
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      onFocus={onFocus}
      onOpenComponent={onOpenComponent}
      workspace={localWorkspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand LocalRoot" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand <section>" }));
  const localComponent = screen.getByRole("button", { name: "ControlSection" });
  await userEvent.dblClick(localComponent);

  expect(onFocus).not.toHaveBeenCalled();
  expect(onOpenComponent).toHaveBeenCalledWith({
    selection: expect.objectContaining({
      device: "desktop",
      layerId: "local-control-section",
      kind: "component",
    }),
    source: { start: 4, end: 18 },
  });
});

it("uses the same drill-down interaction when a component has design evidence", async () => {
  const onFocus = vi.fn();
  const onOpenComponent = vi.fn();
  const designedSummary = {
    ...summaryDesktop,
    design: {
      fileId: "summary-design",
      relativePath: "src/app/components/ProjectSummary/desktop.design.tsx",
      load: async () => ({
        component: summaryDesktop.component,
        defaults: {},
        initialCase: "default",
        isStateful: false,
        cases: { default: {} },
        render: () => null,
      }),
    },
  };
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      onFocus={onFocus}
      onOpenComponent={onOpenComponent}
      workspace={{
        ...workspace,
        entries: workspace.entries.map((entry) => entry.id === summaryDesktop.id ? designedSummary : entry),
      }}
    />,
  );

  await userEvent.dblClick(await revealDashboard());

  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("Dashboard"), expect.objectContaining({
    kind: "component",
  }));
  expect(onOpenComponent).not.toHaveBeenCalled();
});

it("expands and scrolls to an explicitly opened component", async () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

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
        onSelect={setSelected}
      />
    );
  }

  try {
    render(<ControlledTree />);
    await userEvent.dblClick(await revealDashboard());
    expect(await screen.findByRole("treeitem", { name: "Dashboard" })).toHaveAttribute("aria-level", "1");
    expect(screen.queryByRole("treeitem", { name: "DesktopLayout" })).not.toBeInTheDocument();

    await userEvent.dblClick(screen.getByRole("button", { name: "ProjectSummary" }));

    expect(await screen.findByRole("treeitem", { name: "ProjectSummary" })).toHaveAttribute("aria-level", "1");
    expect(screen.queryByRole("treeitem", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(await screen.findByRole("treeitem", { name: "<article>" })).toBeVisible();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  } finally {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  }
});

it("does not expose a separate Layers mode", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Source tree views" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Show (component layers|composition tree)/ })).not.toBeInTheDocument();
});

it("keeps the source tree header focused on its local content", () => {
  render(<SourceWorkspaceSidebar {...callbacks} headerLeading={<button>Workspace</button>} workspace={workspace} />);

  expect(screen.getByRole("heading", { name: "Source tree" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Workspace" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Workspace source/ })).not.toBeInTheDocument();
  expect(screen.getByRole("tree", { name: "Source tree" })).toBeVisible();
});

it("does not expose the old collapse-outside control", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: "Collapse outside active component" })).not.toBeInTheDocument();
});

it("uses indentation without vertical guide borders", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Source tree" });
  expect(tree.querySelector("span.absolute.border-l")).toBeNull();
});

it("keeps missing design evidence out of the navigation tree", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: /design file audit/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/design missing$/)).not.toBeInTheDocument();
});

it("drills into components and still selects HTML layers", async () => {
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

  await userEvent.dblClick(await revealDashboard());
  expect(onFocus).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    kind: "component",
    nodeId: expect.stringContaining("Dashboard"),
  }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: "component" }));
});

it("replaces the visible tree when a component is opened", async () => {
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
  await userEvent.dblClick(await revealDashboard());

  expect(await screen.findByRole("treeitem", { name: "Dashboard" })).toHaveAttribute("aria-level", "1");
  expect(screen.queryByRole("treeitem", { name: "DesktopLayout" })).not.toBeInTheDocument();
});

it("reveals and highlights a layer selected from the canvas", async () => {
  const graph = sourceFocusGraph(sourceTreeNodes(workspace), "desktop");
  const occurrenceId = initialFocusOccurrence(graph)!;
  const occurrence = graph.occurrences.get(occurrenceId)!;
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      focusId={occurrenceId}
      selected={{
        device: "desktop",
        kind: "html",
        layerId: "dashboard-section",
        nodeId: occurrence.node.id,
        occurrenceId,
        sourceNodeId: occurrence.node.id,
      }}
      workspace={workspace}
    />,
  );

  const selectedLayer = await screen.findByRole("treeitem", { name: "<section>" });
  expect(selectedLayer).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Collapse Dashboard" })).toHaveAttribute("aria-expanded", "true");
});

it("keeps a canvas selection highlighted in the full app tree", async () => {
  const graph = sourceFocusGraph(sourceTreeNodes(workspace), "desktop");
  const occurrence = [...graph.occurrences.values()].find(({ node }) => node.label === "Dashboard")!;
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      selected={{
        device: "desktop",
        kind: "component",
        nodeId: occurrence.node.id,
        occurrenceId: occurrence.id,
        sourceNodeId: occurrence.node.id,
      }}
      workspace={workspace}
    />,
  );

  expect(await screen.findByRole("treeitem", { name: "Dashboard" }))
    .toHaveAttribute("aria-selected", "true");
});

it("does not cover a visible selection with a locate control", () => {
  const graph = sourceFocusGraph(sourceTreeNodes(workspace), "desktop");
  const occurrenceId = initialFocusOccurrence(graph)!;
  const occurrence = graph.occurrences.get(occurrenceId)!;
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      focusId={occurrenceId}
      selected={{
        device: "desktop",
        kind: "html",
        layerId: "dashboard-section",
        nodeId: occurrence.node.id,
        occurrenceId,
        sourceNodeId: occurrence.node.id,
      }}
      workspace={workspace}
    />,
  );
  expect(screen.queryByRole("button", { name: /Scroll to current selection/ })).not.toBeInTheDocument();
  expect(screen.getByRole("treeitem", { name: "<section>" })).toHaveAttribute("aria-selected", "true");
});

it("switches device implementations from the drilldown header", async () => {
  const onDeviceChange = vi.fn();
  function ControlledTree() {
    const [focusId, setFocusId] = useState<string>();
    const [selected, setSelected] = useState<SourceWorkspaceSelection>();
    return (
      <SourceWorkspaceSidebar
        {...callbacks}
        focusId={focusId}
        selected={selected}
        workspace={workspace}
        onDeviceChange={onDeviceChange}
        onFocus={(nextFocusId, nextSelection) => {
          setFocusId(nextFocusId);
          setSelected(nextSelection);
        }}
        onSelect={setSelected}
      />
    );
  }

  render(<ControlledTree />);
  expect(screen.queryByRole("group", { name: "Source implementation" })).not.toBeInTheDocument();
  await userEvent.dblClick(await revealDashboard());

  const switcher = screen.getByRole("group", { name: "Source implementation" });
  expect(switcher).toHaveClass("h-7");
  expect(switcher.closest("header")).not.toBeNull();
  expect(screen.getByRole("treeitem", { name: "Dashboard" })).not.toContainElement(switcher);
  await userEvent.click(within(switcher).getByRole("button", { name: /Mobile implementation/ }));
  expect(onDeviceChange).toHaveBeenCalledWith("mobile");
});

it("highlights only the selected rendered instance of a repeated source layer", async () => {
  const repeatedButton = {
    id: "shared-button-body",
    label: "Button",
    kind: "component" as const,
    source: { start: 10, end: 20 },
    children: [],
  };
  const repeatedEntry: RuntimeSourceWorkspaceEntry = {
    ...desktopLayout,
    id: "repeated-layout",
    label: "RepeatedLayout",
    fileId: "file-repeated-layout",
    relativePath: "src/app/repeated/layout.tsx",
    uses: [],
    layers: [{
      id: "repeated-nav",
      label: "nav",
      kind: "html",
      source: { start: 1, end: 30 },
      children: [
        { id: "first-rail", label: "RailButton", kind: "component", source: { start: 2, end: 3 }, children: [repeatedButton] },
        { id: "second-rail", label: "RailButton", kind: "component", source: { start: 4, end: 5 }, children: [repeatedButton] },
      ],
    }],
  };
  const repeatedWorkspace: RuntimeSourceWorkspace = {
    ...workspace,
    entries: [repeatedEntry],
  };
  render(<SourceWorkspaceSidebar {...callbacks} workspace={repeatedWorkspace} />);
  await userEvent.click(screen.getByRole("button", { name: "Expand RepeatedLayout" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand <nav>" }));
  for (const expand of screen.getAllByRole("button", { name: "Expand RailButton" })) {
    await userEvent.click(expand);
  }

  const buttons = screen.getAllByRole("treeitem", { name: "Button" });
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toHaveAttribute("aria-selected", "false");
  expect(buttons[1]).toHaveAttribute("aria-selected", "false");

  await userEvent.click(within(buttons[0]!).getByRole("button", { name: "Button" }));
  expect(buttons[0]).toHaveAttribute("aria-selected", "true");
  expect(buttons[1]).toHaveAttribute("aria-selected", "false");

  await userEvent.click(within(buttons[1]!).getByRole("button", { name: "Button" }));
  expect(buttons[0]).toHaveAttribute("aria-selected", "false");
  expect(buttons[1]).toHaveAttribute("aria-selected", "true");
});

it("changes branch visibility only from the chevron", async () => {
  const onFocus = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand DesktopLayout" }));
  expect(screen.getByRole("treeitem", { name: "<main>" })).toBeVisible();
  expect(onFocus).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Collapse DesktopLayout" }));
  expect(screen.queryByRole("treeitem", { name: "<main>" })).not.toBeInTheDocument();
  expect(onFocus).not.toHaveBeenCalled();
});

it("restores expanded branches after the tree remounts", async () => {
  const first = render(
    <SourceWorkspaceSidebar
      {...callbacks}
      treeStateKey="project:app:desktop"
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand DesktopLayout" }));
  expect(screen.getByRole("treeitem", { name: "<main>" })).toBeVisible();
  first.unmount();

  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      treeStateKey="project:app:desktop"
      workspace={workspace}
    />,
  );

  expect(screen.getByRole("button", { name: "Collapse DesktopLayout" }))
    .toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("treeitem", { name: "<main>" })).toBeVisible();
});

it("keeps a visible slot picker usable without selecting the slot row", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onSelect={onSelect} workspace={directSlotWorkspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand SlotRoot" }));
  const picker = screen.getByRole("button", { name: "Replace content in content slot" });
  expect(picker).toBeVisible();

  await userEvent.click(picker);
  expect(await screen.findByRole("listbox", { name: "Compatible components" })).toBeVisible();
  expect(onSelect).not.toHaveBeenCalled();
});

it("selects a slot row without opening its component picker", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onSelect={onSelect} workspace={directSlotWorkspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand SlotRoot" }));
  const slot = screen.getByRole("button", { name: "content" });
  await userEvent.click(slot);

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    kind: "slot",
    layerId: "root-content",
    slotName: "content",
  }));
  expect(screen.queryByRole("listbox", { name: "Compatible components" })).not.toBeInTheDocument();
});
