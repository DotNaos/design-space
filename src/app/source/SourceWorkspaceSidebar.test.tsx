import { cleanup, render, screen, within } from "@testing-library/react";
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

it("offers parent and exit navigation only while designing a component", async () => {
  const onExit = vi.fn();
  const onOpenParent = vi.fn();
  const view = render(
    <SourceWorkspaceSidebar
      {...callbacks}
      designNavigation={{
        parentLabel: "Dashboard",
        onExit,
        onOpenParent,
      }}
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Open parent Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Exit component design" }));
  expect(onOpenParent).toHaveBeenCalledOnce();
  expect(onExit).toHaveBeenCalledOnce();

  view.rerender(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: "Open parent Dashboard" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Exit component design" })).not.toBeInTheDocument();
});

it("keeps exit available at the top of the component hierarchy", () => {
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      designNavigation={{ onExit: vi.fn() }}
      workspace={workspace}
    />,
  );

  expect(screen.getByRole("button", { name: "Exit component design" })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Open parent/ })).not.toBeInTheDocument();
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

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  const section = screen.getByRole("treeitem", { name: "<section>" });
  await userEvent.hover(section);
  expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({
    kind: "html",
    layerId: "dashboard-section",
  }));
  expect(onSelect).not.toHaveBeenCalled();

  await userEvent.unhover(section);
  expect(onHover).toHaveBeenLastCalledWith(undefined);
});

it("mutes layers owned by a different source file", async () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  const section = screen.getByRole("treeitem", { name: "<section>" });
  expect(section).toHaveAttribute("data-source-file-scope", "current");
  expect(section).not.toHaveClass("opacity-40");

  await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
  const summary = screen.getAllByRole("treeitem", { name: "ProjectSummary" })[0]!;
  expect(summary).toHaveAttribute("data-source-file-scope", "external");
  expect(summary).toHaveClass("opacity-40");

  await userEvent.click(within(summary).getByRole("button", { name: "Expand ProjectSummary" }));
  const article = screen.getByRole("treeitem", { name: "<article>" });
  expect(article).toHaveAttribute("data-source-file-scope", "external");
  expect(article).toHaveClass("opacity-40");
});

it("selects a nested component without replacing the canvas, then opens it explicitly", async () => {
  const onFocus = vi.fn();
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onFocus={onFocus} onSelect={onSelect} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
  const summary = screen.getAllByRole("button", { name: "ProjectSummary" })[0]!;
  await userEvent.click(summary);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    device: "desktop",
    nodeId: expect.stringContaining("ProjectSummary"),
    kind: "component",
  }));
  expect(onFocus).not.toHaveBeenCalled();
  await userEvent.dblClick(summary);
  expect(onFocus).toHaveBeenCalledWith(expect.stringContaining("pages:Dashboard"), expect.objectContaining({
    device: "desktop",
    nodeId: expect.stringContaining("ProjectSummary"),
    kind: "component",
  }));
  expect(onFocus.mock.calls[0]?.[1]).not.toHaveProperty("layerId");
  expect(onFocus.mock.calls[0]?.[1]).toHaveProperty("sourceNodeId", expect.stringContaining("ProjectSummary"));
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
    await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
    await userEvent.click(screen.getByRole("button", { name: "Expand content" }));
    await userEvent.dblClick(screen.getAllByRole("button", { name: "ProjectSummary" })[0]!);

    expect(await screen.findByRole("treeitem", { name: "<article>" })).toBeVisible();
    expect(screen.getByRole("treeitem", { name: "ProjectSummary" }))
      .toHaveAttribute("data-source-file-scope", "current");
    expect(screen.getByRole("button", { name: "Collapse ProjectSummary" }))
      .toHaveAttribute("aria-expanded", "true");
    for (const parentLabel of ["DesktopLayout", "Dashboard", "content"]) {
      const parent = screen.getByRole("treeitem", { name: parentLabel });
      expect(parent).toHaveAttribute("data-source-active-path", "true");
      expect(parent).toHaveClass("opacity-70");
      expect(parent).not.toHaveClass("opacity-40");
    }
    expect(screen.getByRole("treeitem", { name: "ProjectSummary" }))
      .not.toHaveAttribute("data-source-active-path");
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

it("collapses outside the active component without closing its path", async () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  await userEvent.click(screen.getByRole("button", {
    name: "Collapse outside active component",
  }));

  expect(screen.getByRole("button", { name: "Collapse Dashboard" }))
    .toHaveAttribute("aria-expanded", "true");
});

it("uses indentation without vertical guide borders", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);

  const tree = screen.getByRole("tree", { name: "Source tree" });
  expect(tree.querySelector("span.absolute.border-l")).toBeNull();
});

it("shows missing design evidence inline without an audit menu", () => {
  render(<SourceWorkspaceSidebar {...callbacks} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: /design file audit/i })).not.toBeInTheDocument();
  expect(screen.getAllByLabelText(/design missing$/).length).toBeGreaterThan(0);
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
  await userEvent.dblClick(screen.getAllByRole("button", { name: "ProjectSummary" })[1]!);
  expect(onFocus).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
    kind: "component",
    nodeId: expect.stringContaining("ProjectSummary"),
  }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
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

it("reveals and highlights a layer selected from the canvas", async () => {
  const graph = sourceFocusGraph(sourceTreeNodes(workspace), "desktop");
  const occurrenceId = initialFocusOccurrence(graph)!;
  const occurrence = graph.occurrences.get(occurrenceId)!;
  render(
    <SourceWorkspaceSidebar
      {...callbacks}
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
  const graph = sourceFocusGraph(sourceTreeNodes(repeatedWorkspace), "desktop");
  const occurrenceId = graph.roots[0]!;
  const occurrence = graph.occurrences.get(occurrenceId)!;

  const renderSidebar = (renderedLayerOccurrence: number) => (
    <SourceWorkspaceSidebar
      {...callbacks}
      selected={{
        device: "desktop",
        kind: "component",
        layerId: repeatedButton.id,
        nodeId: occurrence.node.id,
        occurrenceId,
        renderedLayerOccurrence,
        sourceNodeId: occurrence.node.id,
      }}
      workspace={repeatedWorkspace}
    />
  );
  const view = render(renderSidebar(0));

  expect(screen.getByRole("treeitem", { name: "Button" })).toHaveAttribute("aria-selected", "true");

  view.rerender(renderSidebar(1));
  const buttons = screen.getAllByRole("treeitem", { name: "Button" });
  expect(buttons).toHaveLength(2);
  expect(buttons[0]).toHaveAttribute("aria-selected", "false");
  expect(buttons[1]).toHaveAttribute("aria-selected", "true");
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

it("restores expanded branches after the tree remounts", async () => {
  const first = render(
    <SourceWorkspaceSidebar
      {...callbacks}
      treeStateKey="project:app:desktop"
      workspace={workspace}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  expect(screen.getByRole("treeitem", { name: "content" })).toBeVisible();
  first.unmount();

  render(
    <SourceWorkspaceSidebar
      {...callbacks}
      treeStateKey="project:app:desktop"
      workspace={workspace}
    />,
  );

  expect(screen.getByRole("button", { name: "Collapse Dashboard" }))
    .toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("treeitem", { name: "content" })).toBeVisible();
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

it("selects a slot row without opening its component picker", async () => {
  const onSelect = vi.fn();
  render(<SourceWorkspaceSidebar {...callbacks} onSelect={onSelect} workspace={workspace} />);

  await userEvent.click(screen.getByRole("button", { name: "Expand Dashboard" }));
  const slot = screen.getByRole("button", { name: "content" });
  await userEvent.click(slot);

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    kind: "slot",
    layerId: "layout-dashboard-content",
    slotName: "content",
  }));
  expect(screen.queryByRole("listbox", { name: "Compatible components" })).not.toBeInTheDocument();
});
