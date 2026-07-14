import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResizableWorkspacePanels } from "./ResizableWorkspacePanels";
import { workspacePanelStorageKey } from "./workspace-panel-state";

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

  it("resizes both panels by pointer and clamps them to their limits", () => {
    renderWorkspace();
    const left = screen.getByRole("separator", { name: "Resize Project panel" });
    const right = screen.getByRole("separator", { name: "Resize Inspector panel" });

    dispatchPointer(left, "pointerdown", 1, 200);
    dispatchPointer(window, "pointermove", 1, 1000);
    expect(left).toHaveAttribute("aria-valuenow", "400");
    dispatchPointer(window, "pointerup", 1, 1000);

    dispatchPointer(right, "pointerdown", 2, 700);
    dispatchPointer(window, "pointermove", 2, 100);
    expect(right).toHaveAttribute("aria-valuenow", "460");
    dispatchPointer(window, "pointerup", 2, 100);
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
