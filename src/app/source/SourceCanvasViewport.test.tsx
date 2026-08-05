import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../components/PreviewCanvas/PreviewCanvas", () => ({
  PreviewCanvas: (props: {
    canvasHeader?: React.ReactNode;
    hud?: React.ReactNode;
    preview: React.ReactNode;
    selection?: unknown;
    showControls?: boolean;
    toolbar?: React.ReactNode;
    toolbarSigning?: React.ReactNode;
    worldFooter?: React.ReactNode;
  }) => (
    <div data-testid="preview-canvas" data-show-controls={String(props.showControls !== false)}>
      <div data-testid="fixed-canvas-header">{props.canvasHeader}</div>
      <div data-testid="preview-toolbar">{props.toolbar}</div>
      <div data-testid="preview-signing">{props.toolbarSigning}</div>
      {props.preview}
      <div data-testid="preview-hud">{props.hud}</div>
      <output data-testid="preview-selection">{props.selection ? "selected" : "none"}</output>
      <div data-testid="preview-footer">{props.worldFooter}</div>
    </div>
  ),
}));

import { SourceCanvasViewport } from "./SourceCanvasViewport";
import type { SourceTreeNode } from "./source-workspace-tree";

afterEach(cleanup);

const node: SourceTreeNode = {
  id: "app",
  area: "components",
  label: "App",
  entries: [],
  uses: [],
  implementations: {
    desktop: { requestedDevice: "desktop", sourceDevice: "desktop", state: "direct" },
    tablet: { requestedDevice: "tablet", sourceDevice: "desktop", state: "fallback" },
    mobile: { requestedDevice: "mobile", state: "missing" },
  },
};

it("renders a chrome-free review preview without hiding the component", () => {
  render(
    <SourceCanvasViewport
      ancestry={[{ id: "app", kind: "component", label: "App" }]}
      device="desktop"
      footer={<div>Selected file</div>}
      hud={<div>Comment composer</div>}
      node={node}
      showChrome={false}
      toolbarSigning={<div>Signing</div>}
      onDeviceChange={vi.fn()}
    >
      {() => <div>Component preview</div>}
    </SourceCanvasViewport>,
  );

  expect(screen.getByText("Component preview")).toBeVisible();
  expect(screen.getByTestId("preview-canvas")).toHaveAttribute("data-show-controls", "false");
  expect(screen.getByTestId("fixed-canvas-header")).toBeEmptyDOMElement();
  expect(screen.getByTestId("preview-toolbar")).toBeEmptyDOMElement();
  expect(screen.getByTestId("preview-signing")).toBeEmptyDOMElement();
  expect(screen.getByTestId("preview-hud")).toBeEmptyDOMElement();
  expect(screen.getByTestId("preview-footer")).toBeEmptyDOMElement();
  expect(screen.getByTestId("preview-selection")).toHaveTextContent("none");
});

it("can leave device switching to the workspace sidebar", () => {
  render(
    <SourceCanvasViewport
      ancestry={[{ id: "app", kind: "component", label: "App" }]}
      device="desktop"
      node={node}
      showDeviceSwitcher={false}
      onDeviceChange={vi.fn()}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  expect(screen.queryByRole("group", { name: "Source implementation" })).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Canvas ancestry" })).toBeVisible();
});

it("switches between the selected screen and measured content bounds", async () => {
  render(
    <SourceCanvasViewport
      contentSize={{ height: 420, width: 360 }}
      device="desktop"
      onDeviceChange={vi.fn()}
    >
      {(frame) => <output>{`${frame.width} × ${frame.height}`}</output>}
    </SourceCanvasViewport>,
  );

  const screenFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(screenFrame).toHaveAttribute("data-preview-frame-mode", "screen");
  expect(screenFrame).toHaveClass("overflow-hidden");
  expect(screenFrame).toHaveStyle({ height: "800px", width: "1280px" });
  expect(screen.getByText("1280 × 800")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Clip preview to selected screen" }));

  const contentFrame = document.querySelector<HTMLElement>("[data-preview-frame-mode]");
  expect(contentFrame).toHaveAttribute("data-preview-frame-mode", "content");
  expect(contentFrame).toHaveClass("overflow-visible");
  expect(contentFrame).toHaveStyle({ height: "420px", width: "360px" });
  expect(screen.getByText("360 × 420")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hug preview content" })).toBeVisible();
});

it("wraps the selected screen in a device mockup without changing its viewport", async () => {
  render(
    <SourceCanvasViewport device="mobile" onDeviceChange={vi.fn()}>
      {(frame) => <output>{`${frame.width} × ${frame.height}`}</output>}
    </SourceCanvasViewport>,
  );

  expect(screen.queryByLabelText("phone device frame")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show device mockup" }));
  expect(screen.getByLabelText("phone device frame")).toBeVisible();
  expect(screen.getByText("390 × 844")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hide device mockup" })).toBeVisible();
});

it("attaches an interactive ancestry path to the canvas", async () => {
  const onSelectAncestry = vi.fn();
  const onSelectSlot = vi.fn();
  render(
    <SourceCanvasViewport
      ancestry={[
        { id: "app", kind: "component", label: "App" },
        { id: "shell", kind: "component", label: "WorkspaceShell" },
        { id: "content", kind: "slot", label: "slot:content" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectAncestry={onSelectAncestry}
      onSelectSlot={onSelectSlot}
      slotOwnerLabel="WorkspaceShell"
      slotTabs={[
        { active: false, id: "status", label: "status", scope: "tree" },
        { active: true, id: "content", label: "content", scope: "tree" },
        { active: false, id: "toolbar", label: "toolbar", scope: "shared" },
      ]}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const ancestry = screen.getByRole("navigation", { name: "Canvas ancestry" });
  expect(screen.getByTestId("fixed-canvas-header")).toContainElement(ancestry);
  expect(ancestry).not.toHaveTextContent("From root");
  expect(ancestry).toHaveTextContent("App");
  expect(ancestry).toHaveTextContent("WorkspaceShell");
  expect(ancestry).toHaveTextContent("slot:content");
  const appCrumb = within(ancestry).getByRole("button", { name: "App" });
  expect(appCrumb).toHaveClass("rounded-full");
  expect(appCrumb.querySelector("[aria-hidden='true']")).toHaveClass("rounded-full");
  expect(screen.getByText("slot:content").closest("[aria-current]"))
    .toHaveAttribute("aria-current", "location");
  expect(screen.getByText("slot:content").closest("[aria-current]")).toHaveClass("rounded-full");
  expect(screen.getByText("slot:content").previousElementSibling).not.toHaveClass("ring-1");
  expect(document.querySelector("[data-preview-frame-mode]")).not.toHaveClass("shadow-2xl");

  await userEvent.click(screen.getByRole("button", { name: /App/ }));
  expect(onSelectAncestry).toHaveBeenCalledWith({ id: "app", kind: "component", label: "App" });

  expect(screen.getByRole("button", { name: "slot:content" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "slot:content" })).toHaveClass("rounded-full");
  expect(screen.getByRole("button", { name: "slot:toolbar" })).toHaveAttribute("data-slot-scope", "shared");
  await userEvent.click(screen.getByRole("button", { name: "slot:status" }));
  expect(onSelectSlot).toHaveBeenCalledWith({ active: false, id: "status", label: "status", scope: "tree" });
});

it("reveals the real component subtree from a breadcrumb hover and navigates from it", async () => {
  const onSelectAncestry = vi.fn();
  const toolbar = { children: [], id: "toolbar", label: "Toolbar", slotLabel: "toolbar" };
  const status = { children: [], id: "status", label: "WorkspaceStatus", slotLabel: "status" };
  const shell = { children: [status, toolbar], id: "shell", label: "WorkspaceShell", slotLabel: "content" };
  render(
    <SourceCanvasViewport
      ancestry={[
        { children: [shell], id: "app", kind: "component", label: "App" },
        { children: [status, toolbar], id: "shell", kind: "component", label: "WorkspaceShell" },
        { id: "status", kind: "component", label: "WorkspaceStatus" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectAncestry={onSelectAncestry}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const ancestry = screen.getByRole("navigation", { name: "Canvas ancestry" });
  const currentCrumb = within(ancestry).getByText("WorkspaceStatus").closest("[aria-current]");
  expect(currentCrumb).not.toBeNull();
  expect(currentCrumb).toHaveClass("rounded-full", "bg-purple-500", "!px-2.5", "text-[8px]", "text-white");
  expect(currentCrumb?.querySelector("[aria-hidden='true']")).toHaveClass("rounded-full", "bg-white/20", "text-white");

  await userEvent.hover(screen.getByRole("button", { name: "App" }));
  const tree = await screen.findByRole("tree", { name: "App component tree" });
  expect(tree).toHaveClass("overflow-auto");
  expect(within(tree).getByRole("treeitem", { name: "App" }).parentElement).toHaveClass("text-fuchsia-300");
  expect(within(tree).getByRole("treeitem", { name: /WorkspaceShell/ }).parentElement).toHaveClass("text-fuchsia-300");
  expect(within(tree).getByRole("treeitem", { name: "WorkspaceStatus" })).toHaveAttribute("aria-current", "location");
  expect(within(tree).getByRole("treeitem", { name: "WorkspaceStatus" })).toHaveAttribute("data-slot-label", "status");
  expect(within(tree).getByRole("treeitem", { name: "WorkspaceStatus" })).toHaveClass("min-w-max", "whitespace-nowrap");
  expect(within(tree).getAllByTestId("source-canvas-tree-component-icon")).toHaveLength(4);
  expect(within(tree).getByRole("treeitem", { name: "Toolbar" })).not.toHaveAttribute("aria-current");

  await userEvent.click(within(tree).getByRole("button", { name: "Collapse WorkspaceShell" }));
  expect(within(tree).queryByRole("treeitem", { name: "WorkspaceStatus" })).not.toBeInTheDocument();
  await userEvent.click(within(tree).getByRole("button", { name: "Expand WorkspaceShell" }));

  await userEvent.click(within(tree).getByRole("treeitem", { name: "Toolbar" }));
  expect(onSelectAncestry).toHaveBeenCalledWith({
    children: [],
    id: "toolbar",
    kind: "component",
    label: "Toolbar",
  });
});

it("dismisses the breadcrumb tree when pressing outside it", async () => {
  const shell = { children: [], id: "shell", label: "WorkspaceShell", slotLabel: "content" };
  render(
    <SourceCanvasViewport
      ancestry={[
        { children: [shell], id: "app", kind: "component", label: "App" },
        { id: "shell", kind: "component", label: "WorkspaceShell" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
    >
      {() => <button type="button">Outside the tree</button>}
    </SourceCanvasViewport>,
  );

  await userEvent.hover(screen.getByRole("button", { name: "App" }));
  expect(await screen.findByRole("tree", { name: "App component tree" })).toBeVisible();

  await userEvent.click(screen.getByText("Outside the tree"));
  await waitFor(() => {
    expect(screen.queryByRole("tree", { name: "App component tree" })).not.toBeInTheDocument();
  });
});

it("collapses dense sibling slots into a compact picker", async () => {
  const onSelectSlot = vi.fn();
  render(
    <SourceCanvasViewport
      ancestry={[{ id: "workspace", kind: "component", label: "SourceWorkspace" }]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectSlot={onSelectSlot}
      slotOwnerLabel="SourceWorkspace"
      slotTabs={[
        { active: false, id: "sidebar", label: "sourceWorkspaceSidebar", scope: "tree" },
        { active: false, id: "canvas", label: "sourceCodeCanvas", scope: "tree" },
        { active: false, id: "browser", label: "projectFileBrowser", scope: "tree" },
        { active: false, id: "library", label: "sourceLibraryExplorer", scope: "tree" },
        { active: false, id: "overlay", label: "sourceWorkspaceCodeOverlay", scope: "shared" },
      ]}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const picker = screen.getByRole("button", { name: "Choose child slot of SourceWorkspace · 5 slots" });
  expect(picker).toHaveTextContent("Slots5");
  expect(screen.queryByRole("menuitemradio", { name: /sourceWorkspaceCodeOverlay/ })).not.toBeInTheDocument();

  await userEvent.click(picker);
  const sharedSlot = await screen.findByRole("menuitemradio", { name: /sourceWorkspaceCodeOverlay/ });
  expect(sharedSlot).toHaveTextContent("Shared");
  await userEvent.click(sharedSlot);
  expect(onSelectSlot).toHaveBeenCalledWith({
    active: false,
    id: "overlay",
    label: "sourceWorkspaceCodeOverlay",
    scope: "shared",
  });
});

it("shows parent approval status only when supplied by approval review mode", () => {
  render(
    <SourceCanvasViewport
      ancestry={[
        {
          approval: { label: "Approved · App", tone: "approved" },
          id: "app",
          kind: "component",
          label: "App",
        },
        {
          approval: { label: "Awaiting approval · WorkspaceShell", tone: "pending" },
          id: "shell",
          kind: "component",
          label: "WorkspaceShell",
        },
        { id: "content", kind: "slot", label: "slot:content" },
      ]}
      device="desktop"
      onDeviceChange={vi.fn()}
      onSelectAncestry={vi.fn()}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  expect(screen.getByRole("button", { name: "App · Approved · App" }))
    .toHaveAttribute("data-approval-tone", "approved");
  expect(screen.getByRole("button", { name: "WorkspaceShell · Awaiting approval · WorkspaceShell" }))
    .toHaveAttribute("data-approval-tone", "pending");
  expect(screen.getByText("slot:content").closest("[data-approval-tone]"))
    .not.toBeInTheDocument();
});

it("keeps the review graph inside the zoomable canvas while switching layouts", async () => {
  render(
    <SourceCanvasViewport
      device="desktop"
      onDeviceChange={vi.fn()}
      reviewGraph={{
        caseNames: ["default", "alternate path"],
        componentLabel: "Layout",
        isStateful: false,
        properties: [],
        selectedCase: "default",
        slots: [],
        onCaseChange: vi.fn(),
      }}
    >
      {() => <div>Preview</div>}
    </SourceCanvasViewport>,
  );

  const stage = screen.getByTestId("source-review-graph-stage");
  expect(screen.getByTestId("source-review-graph-world")).toContainElement(stage);
  expect(screen.queryByTestId("source-review-graph-overlay")).not.toBeInTheDocument();
  expect(stage).toHaveAttribute("data-review-graph-layout", "vertical");

  await userEvent.click(screen.getByRole("button", { name: "Inputs left, outputs right" }));
  expect(stage).toHaveAttribute("data-review-graph-layout", "horizontal");

  await userEvent.click(screen.getByRole("button", { name: "Focus on the current design" }));
  expect(stage).toHaveAttribute("data-review-graph-layout", "focus");
  expect(screen.queryByText("Properties")).not.toBeInTheDocument();
  expect(screen.queryByText("Slots")).not.toBeInTheDocument();
  expect(screen.getByTestId("source-review-case-carousel")).toHaveTextContent("default");
});
