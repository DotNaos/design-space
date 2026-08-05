import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResizableWorkspacePanels } from "./ResizableWorkspacePanels";
import { workspacePanelStorageKey, workspacePanelVisibilityStorageKey } from "./workspace-panel-state";

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  window.localStorage.clear();
  installMatchMedia(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  document.documentElement.style.cursor = "";
  document.body.style.userSelect = "";
});

describe("ResizableWorkspacePanels", () => {
  it("renders accessible left and right desktop separators with bounded defaults", () => {
    renderWorkspace();

    expect(screen.getByRole("region", { name: "Project panel" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Inspector panel" })).toBeVisible();
    expect(screen.getByText("Canvas")).toBeVisible();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    expect(left).toHaveAttribute("aria-valuenow", "260");
    expect(left).toHaveAttribute("aria-valuetext", "260 pixels");
    expect(left).toHaveAttribute("aria-controls", screen.getByRole("region", { name: "Project panel" }).id);
    expect(screen.getByRole("separator", { name: "Resize Inspector panel" })).toHaveAttribute("aria-valuenow", "300");
  });

  it("collapses each panel independently and restores the state for the same document", async () => {
    const first = renderWorkspace();
    const hideProject = screen.getByRole("button", { name: "Hide Project panel" });
    expect(hideProject.closest("[data-workspace-panel='left']")).not.toBeNull();
    await fireEvent.click(hideProject);

    const showProject = screen.getByRole("button", { name: "Show Project panel" });
    expect(document.getElementById(showProject.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
    expect(showProject).toHaveAttribute("aria-expanded", "false");
    expect(showProject.closest("[data-workspace-panel='left']")).toHaveAttribute("data-workspace-panel-collapsed", "true");
    expect(screen.getByRole("region", { name: "Inspector panel" })).toHaveAttribute("aria-hidden", "false");

    const key = workspacePanelVisibilityStorageKey({ projectId: "demo", documentId: "home" });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(key) ?? "{}")).toMatchObject({
      version: 1,
      left: false,
      right: true,
    }));

    first.unmount();
    renderWorkspace();
    expect(screen.getByRole("button", { name: "Show Project panel" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide Inspector panel" }));
    const showInspector = screen.getByRole("button", { name: "Show Inspector panel" });
    expect(document.getElementById(showInspector.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
  });

  it("can place the left panel toggle in a full-height panel header without a separate rail", () => {
    render(
      <ResizableWorkspacePanels
        namespace={{ projectId: "demo", documentId: "header" }}
        left={{
          label: "Project panel",
          content: ({ controls, visible, onToggle }) => (
            <div>
              <button aria-controls={controls} aria-expanded={visible} onClick={onToggle}>Inline project header</button>
              Project
            </div>
          ),
          defaultWidth: 260,
          minWidth: 200,
          maxWidth: 400,
        }}
        leftHeader={({ controls, visible, onToggle }) => (
          visible ? null : <button aria-controls={controls} aria-expanded={visible} onClick={onToggle}>Collapsed project header</button>
        )}
        right={{ label: "Inspector panel", content: <div>Inspector</div>, defaultWidth: 300, minWidth: 240, maxWidth: 460 }}
      >
        <div>Canvas</div>
      </ResizableWorkspacePanels>,
    );

    const headerToggle = screen.getByRole("button", { name: "Inline project header" });
    expect(headerToggle.closest("[data-workspace-panel='left']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Hide Project panel" })).not.toBeInTheDocument();
    fireEvent.click(headerToggle);
    const collapsedToggle = screen.getByRole("button", { name: "Collapsed project header" });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(collapsedToggle.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
  });

  it("can place the right panel toggle in a full-height panel header without a separate rail", () => {
    render(
      <ResizableWorkspacePanels
        namespace={{ projectId: "demo", documentId: "right-header" }}
        left={{ label: "Project panel", content: <div>Project</div> }}
        right={{ label: "Inspector panel", content: <div>Inspector</div> }}
        rightHeader={({ controls, visible, onToggle }) => (
          visible ? <button aria-controls={controls} aria-expanded={visible} onClick={onToggle}>Inline inspector header</button> : null
        )}
      >
        {({ right }) => (
          <div>
            {!right.visible ? <button aria-controls={right.controls} aria-expanded={right.visible} onClick={right.onToggle}>Collapsed inspector header</button> : null}
            Canvas
          </div>
        )}
      </ResizableWorkspacePanels>,
    );

    const headerToggle = screen.getByRole("button", { name: "Inline inspector header" });
    expect(headerToggle.closest("[data-workspace-panel='right']")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Hide Inspector panel" })).not.toBeInTheDocument();
    fireEvent.click(headerToggle);
    const collapsedToggle = screen.getByRole("button", { name: "Collapsed inspector header" });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(collapsedToggle.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes external controls without reserving collapsed panel rails", () => {
    render(
      <ResizableWorkspacePanels
        externalPanelControls
        namespace={{ projectId: "demo", documentId: "external-controls" }}
        left={{ label: "Project panel", content: <div>Project</div> }}
        right={{ label: "Inspector panel", content: <div>Inspector</div> }}
      >
        {({ left, right }) => (
          <div>
            <button aria-controls={left.controls} onClick={left.onToggle}>{left.visible ? "Hide project" : "Show project"}</button>
            <button aria-controls={right.controls} onClick={right.onToggle}>{right.visible ? "Hide inspector" : "Show inspector"}</button>
            Canvas
          </div>
        )}
      </ResizableWorkspacePanels>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide project" }));

    expect(screen.getByRole("button", { name: "Show project" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Show Project panel" })).not.toBeInTheDocument();
    expect(screen.getByText("Canvas").closest("[data-workspace-panel-layout]")).toHaveStyle({
      gridTemplateColumns: "0px 1px minmax(320px, 1fr) 1px 320px",
    });
  });

  it("snaps a panel closed when it is dragged beyond its minimum width", () => {
    renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });

    dispatchPointer(left, "pointerdown", 1, 260);
    dispatchPointer(window, "pointermove", 1, 180);
    expect(left).toHaveAttribute("aria-valuenow", "200");
    expect(left).toHaveAttribute("data-workspace-panel-snap", "resist-collapse");
    expect(screen.getByRole("button", { name: "Hide Project panel" })).toBeVisible();
    dispatchPointer(window, "pointermove", 1, 130);
    expect(left).toHaveAttribute("data-workspace-panel-snap", "collapse");
    const showProject = screen.getByRole("button", { name: "Show Project panel" });
    expect(showProject).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(showProject.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
    expect(left).toHaveAttribute("aria-valuetext", "Collapsed");
    dispatchPointer(window, "pointerup", 1, 130);
  });

  it("resists at the maximum before expanding and restores after an inward drag", () => {
    renderWorkspace();
    const layout = screen.getByText("Canvas").closest("[data-workspace-panel-layout]")!;
    const left = screen.getByRole("separator", { name: "Resize Project panel" });

    dispatchPointer(left, "pointerdown", 1, 260);
    dispatchPointer(window, "pointermove", 1, 440);
    expect(left).toHaveAttribute("aria-valuenow", "400");
    expect(left).toHaveAttribute("data-workspace-panel-snap", "resist-expand");
    expect(layout).not.toHaveAttribute("data-workspace-panel-expanded");

    dispatchPointer(window, "pointermove", 1, 470);
    expect(left).toHaveAttribute("data-workspace-panel-snap", "expand");
    expect(layout).toHaveAttribute("data-workspace-panel-expanded", "left");
    expect(left).toHaveAttribute("aria-valuetext", "Full width");
    expect(left).toHaveAttribute("aria-valuenow", "1440");
    expect(screen.getByText("Canvas").parentElement).toHaveAttribute("aria-hidden", "true");
    const inspectorToggle = screen.getByRole("button", { name: "Hide Inspector panel" });
    expect(document.getElementById(inspectorToggle.getAttribute("aria-controls")!)).toHaveAttribute("aria-hidden", "true");
    dispatchPointer(window, "pointerup", 1, 470);

    dispatchPointer(left, "pointerdown", 2, 1400);
    dispatchPointer(window, "pointermove", 2, 1360);
    expect(left).toHaveAttribute("data-workspace-panel-snap", "resist-restore");
    dispatchPointer(window, "pointerup", 2, 1360);
    expect(layout).toHaveAttribute("data-workspace-panel-expanded", "left");

    dispatchPointer(left, "pointerdown", 3, 1400);
    dispatchPointer(window, "pointermove", 3, 1320);
    expect(left).toHaveAttribute("data-workspace-panel-snap", "restore");
    expect(layout).not.toHaveAttribute("data-workspace-panel-expanded");
    expect(left).toHaveAttribute("aria-valuenow", "400");
    dispatchPointer(window, "pointerup", 3, 1320);
  });

  it("can clamp panel resizing without allowing a full-width takeover", async () => {
    const namespace = { projectId: "demo", documentId: "bounded-panels" };
    const visibilityKey = workspacePanelVisibilityStorageKey(namespace);
    window.localStorage.setItem(visibilityKey, JSON.stringify({
      version: 1,
      left: true,
      right: true,
      expanded: "left",
    }));

    render(
      <ResizableWorkspacePanels
        allowPanelExpansion={false}
        namespace={namespace}
        left={{ label: "Project panel", content: <div>Project</div>, defaultWidth: 260, minWidth: 200, maxWidth: 400 }}
        right={{ label: "Inspector panel", content: <div>Inspector</div>, defaultWidth: 300, minWidth: 240, maxWidth: 460 }}
      >
        <div>Canvas</div>
      </ResizableWorkspacePanels>,
    );

    const layout = screen.getByText("Canvas").closest("[data-workspace-panel-layout]")!;
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    expect(layout).not.toHaveAttribute("data-workspace-panel-expanded");
    expect(screen.getByText("Canvas").parentElement).toHaveAttribute("aria-hidden", "false");

    dispatchPointer(left, "pointerdown", 1, 260);
    dispatchPointer(window, "pointermove", 1, 1000);
    expect(left).toHaveAttribute("aria-valuenow", "400");
    expect(left).not.toHaveAttribute("data-workspace-panel-snap");
    expect(layout).not.toHaveAttribute("data-workspace-panel-expanded");
    expect(screen.getByText("Canvas").parentElement).toHaveAttribute("aria-hidden", "false");
    dispatchPointer(window, "pointerup", 1, 1000);

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(visibilityKey) ?? "{}")).toMatchObject({
      expanded: null,
    }));
  });

  it("resizes both panels by pointer and clamps them to their limits", () => {
    renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    const right = screen.getByRole("separator", { name: "Resize Inspector panel" });

    dispatchPointer(left, "pointerdown", 1, 200);
    dispatchPointer(window, "pointermove", 1, 370);
    expect(left).toHaveAttribute("aria-valuenow", "400");
    dispatchPointer(window, "pointerup", 1, 370);

    dispatchPointer(right, "pointerdown", 2, 700);
    dispatchPointer(window, "pointermove", 2, 500);
    expect(right).toHaveAttribute("aria-valuenow", "460");
    dispatchPointer(window, "pointerup", 2, 500);
  });

  it("supports arrow, Home, End, shifted steps, and double-click reset", () => {
    renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    const right = screen.getByRole("separator", { name: "Resize Inspector panel" });

    fireEvent.keyDown(left, { key: "ArrowRight" });
    expect(left).toHaveAttribute("aria-valuenow", "276");
    fireEvent.keyDown(left, { key: "ArrowLeft", shiftKey: true });
    expect(left).toHaveAttribute("aria-valuenow", "228");
    fireEvent.keyDown(left, { key: "Home" });
    expect(left).toHaveAttribute("aria-valuenow", "200");
    fireEvent.keyDown(left, { key: "End" });
    expect(left).toHaveAttribute("aria-valuenow", "400");
    fireEvent.doubleClick(left);
    expect(left).toHaveAttribute("aria-valuenow", "260");

    fireEvent.keyDown(right, { key: "ArrowLeft" });
    expect(right).toHaveAttribute("aria-valuenow", "316");
    fireEvent.doubleClick(right);
    expect(right).toHaveAttribute("aria-valuenow", "300");
  });

  it("persists widths for the same project document and isolates another document", async () => {
    const first = renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    fireEvent.keyDown(left, { key: "ArrowRight" });
    fireEvent.keyDown(left, { key: "ArrowRight" });

    const key = workspacePanelStorageKey({ projectId: "demo", documentId: "home" });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(key) ?? "{}")).toMatchObject({
      version: 1,
      left: 292,
      right: 300,
    }));

    first.unmount();
    renderWorkspace();
    expect(screen.getByRole("separator", { name: "Resize Project panel" })).toHaveAttribute("aria-valuenow", "292");

    cleanup();
    renderWorkspace("settings");
    expect(screen.getByRole("separator", { name: "Resize Project panel" })).toHaveAttribute("aria-valuenow", "260");
  });

  it("renders only the supplied mobile layout without desktop panels or splitters", () => {
    installMatchMedia(false);
    renderWorkspace();

    expect(screen.getByText("Mobile workspace")).toBeVisible();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Project panel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Inspector panel" })).not.toBeInTheDocument();
  });

  it("reserves at least 320 pixels for the canvas at the laptop breakpoint", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    const right = screen.getByRole("separator", { name: "Resize Inspector panel" });

    fireEvent.keyDown(left, { key: "End" });
    fireEvent.keyDown(right, { key: "End" });

    const totalPanelWidth = Number(left.getAttribute("aria-valuenow")) + Number(right.getAttribute("aria-valuenow"));
    expect(totalPanelWidth).toBeLessThanOrEqual(1024 - 320 - 2);
  });
});

function renderWorkspace(documentId = "home") {
  return render(
    <ResizableWorkspacePanels
      namespace={{ projectId: "demo", documentId }}
      left={{ label: "Project panel", content: <div>Project</div>, defaultWidth: 260, minWidth: 200, maxWidth: 400 }}
      right={{ label: "Inspector panel", content: <div>Inspector</div>, defaultWidth: 300, minWidth: 240, maxWidth: 460 }}
      mobile={<div>Mobile workspace</div>}
    >
      <div>Canvas</div>
    </ResizableWorkspacePanels>,
  );
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
}

function dispatchPointer(target: Element | Window, type: string, pointerId: number, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  fireEvent(target, event);
}
