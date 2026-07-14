import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewCanvas } from "./PreviewCanvas";

afterEach(cleanup);

describe("PreviewCanvas direct interactions", () => {
  it("selects the most specific target on click and only opens editing on double click", () => {
    const onSelect = vi.fn();
    const onEditComponent = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={(
          <article data-design-space-instance-id="card.one">
            <button data-design-space-html-id="html:card.one:action">Action</button>
          </article>
        )}
        rootInstanceId="card.one"
        selectedComponentInstanceId="card.one"
        selection={{ kind: "component", id: "card.one" }}
        selectionLabel="Card"
        slots={[]}
        onEditComponent={onEditComponent}
        onSelect={onSelect}
      />,
    );

    const action = screen.getByRole("button", { name: "Action" });
    fireEvent.click(action);
    expect(onSelect).toHaveBeenCalledWith({
      kind: "html",
      id: "html:card.one:action",
      componentInstanceId: "card.one",
      nodeId: "action",
    });
    expect(onEditComponent).not.toHaveBeenCalled();

    fireEvent.doubleClick(action);
    expect(onEditComponent).toHaveBeenCalledWith("card.one");
  });

  it("selects a nested component slot even when another component is selected", () => {
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={(
          <main data-design-space-instance-id="root">
            <article data-design-space-instance-id="nested:card">
              <footer data-design-space-slot-id="slot:nested%3Acard:footer%20actions">Empty footer</footer>
            </article>
          </main>
        )}
        rootInstanceId="root"
        selectedComponentInstanceId="root"
        selection={{ kind: "component", id: "root" }}
        selectionLabel="Root"
        slots={[{ id: "body", selectionId: "slot:root:body", label: "Body", count: 1 }]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("Empty footer"));

    expect(onSelect).toHaveBeenCalledWith({
      kind: "slot",
      id: "slot:nested%3Acard:footer%20actions",
      componentInstanceId: "nested:card",
      slotId: "footer actions",
    });
  });

  it("blocks target actions in Select and lets them run in explicit Interact mode", () => {
    const targetAction = vi.fn();
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        preview={<button data-design-space-instance-id="action.one" onClick={targetAction}>Run action</button>}
        rootInstanceId="action.one"
        selectedComponentInstanceId="action.one"
        selection={{ kind: "component", id: "action.one" }}
        selectionLabel="Action"
        slots={[]}
        onSelect={onSelect}
      />,
    );
    const action = screen.getByRole("button", { name: "Run action" });

    fireEvent.click(action);
    expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "action.one" });
    expect(targetAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Switch to interact mode" }));
    fireEvent.click(action);
    expect(targetAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Switch to select mode" })).toBeInTheDocument();
  });

  it("uses wheel input to pan while a mouse drag leaves the camera alone", () => {
    renderCanvas();
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const world = screen.getByTestId("canvas-world");
    const initialTransform = world.style.transform;

    dispatchPointer(canvas, "pointerdown", "mouse", 1, 100, 100);
    dispatchPointer(canvas, "pointermove", "mouse", 1, 160, 140);
    dispatchPointer(canvas, "pointerup", "mouse", 1, 160, 140);
    expect(world.style.transform).toBe(initialTransform);

    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaX: 20,
      deltaY: 30,
    });
    act(() => canvas.dispatchEvent(wheel));

    expect(wheel.defaultPrevented).toBe(true);
    expect(world.style.transform).not.toBe(initialTransform);
    expect(world.style.transform).toContain("translate(-4px, 26px)");
  });

  it("renders a device-aligned dashed hover outline without selecting it", async () => {
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={(
          <article data-design-space-instance-id="card.one">
            <button data-design-space-html-id="html:card.one:action">Action</button>
          </article>
        )}
        rootInstanceId="card.one"
        selectedComponentInstanceId="card.one"
        selection={{ kind: "component", id: "card.one" }}
        hoveredSelection={{ kind: "html", id: "html:card.one:action", componentInstanceId: "card.one", nodeId: "action" }}
        selectionLabel="Card"
        slots={[]}
        onSelect={onSelect}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const card = canvas.querySelector<HTMLElement>('[data-design-space-instance-id="card.one"]')!;
    const action = screen.getByRole("button", { name: "Action" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 400, 300));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(rect(42.2, 68.2, 220, 120));
    vi.spyOn(action, "getBoundingClientRect").mockReturnValue(rect(54.2, 82.2, 100, 32));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("hover-outline")).toHaveStyle({
      left: "44px",
      top: "62px",
      width: "100px",
      height: "32px",
    }));

    expect(screen.getByTestId("hover-outline")).toHaveClass("border-dashed");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reports a typed context-menu request for the target under the pointer", () => {
    const onContextMenuRequest = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={<button data-design-space-instance-id="action.one">Action</button>}
        rootInstanceId="action.one"
        selectedComponentInstanceId="action.one"
        selection={{ kind: "component", id: "action.one" }}
        selectionLabel="Action"
        slots={[]}
        onContextMenuRequest={onContextMenuRequest}
        onSelect={() => undefined}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 400, 300));
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 75,
      clientY: 90,
    });

    act(() => screen.getByRole("button", { name: "Action" }).dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(onContextMenuRequest).toHaveBeenCalledWith({
      selection: { kind: "component", id: "action.one" },
      clientPosition: { x: 75, y: 90 },
      viewportPosition: { x: 65, y: 70 },
    });
  });

  it("opens the same target actions on a stationary touch long-press", () => {
    vi.useFakeTimers();
    try {
      const onContextMenuRequest = vi.fn();
      render(
        <PreviewCanvas
          compact
          preview={<button data-design-space-instance-id="action.one">Action</button>}
          rootInstanceId="action.one"
          selectedComponentInstanceId="action.one"
          selection={{ kind: "component", id: "action.one" }}
          selectionLabel="Action"
          slots={[]}
          onContextMenuRequest={onContextMenuRequest}
          onSelect={() => undefined}
        />,
      );
      const canvas = screen.getByRole("main", { name: "Preview canvas" });
      const action = screen.getByRole("button", { name: "Action" });
      Object.defineProperties(canvas, {
        setPointerCapture: { configurable: true, value: vi.fn() },
        hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
        releasePointerCapture: { configurable: true, value: vi.fn() },
      });
      vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 400, 300));

      dispatchPointer(action, "pointerdown", "touch", 1, 75, 90);
      act(() => vi.advanceTimersByTime(520));

      expect(onContextMenuRequest).toHaveBeenCalledWith({
        selection: { kind: "component", id: "action.one" },
        clientPosition: { x: 75, y: 90 },
        viewportPosition: { x: 65, y: 70 },
      });
      dispatchPointer(action, "pointerup", "touch", 1, 75, 90);

      onContextMenuRequest.mockClear();
      dispatchPointer(action, "pointerdown", "touch", 2, 75, 90);
      dispatchPointer(action, "pointermove", "touch", 2, 95, 90);
      act(() => vi.advanceTimersByTime(520));
      expect(onContextMenuRequest).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("anchors the adaptive world grid to the rendered root and keeps dots world-relative", async () => {
    renderCanvas();
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const root = screen.getByText("One");
    const grid = screen.getByTestId("canvas-grid");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 400, 300));
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(rect(42, 68, 220, 120));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(grid.style.backgroundPosition).toBe("32px 48px"));
    expect(Number(grid.dataset.dotRadius)).toBeCloseTo(2);
    expect(grid.dataset.worldStep).toBe("20");

    for (let step = 0; step < 8; step += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    }

    expect(canvasScale()).toBe(0.25);
    expect(Number(grid.dataset.dotRadius)).toBeCloseTo(0.5);
    expect(grid.dataset.worldStep).toBe("80");
    expect(grid.style.backgroundSize).toBe("20px 20px");
    expect(grid.style.opacity).toBe("0.72");
  });
});

function renderCanvas() {
  return render(
    <PreviewCanvas
      compact
      preview={<div data-design-space-instance-id="one">One</div>}
      rootInstanceId="one"
      selectedComponentInstanceId="one"
      selection={{ kind: "component", id: "one" }}
      selectionLabel="One"
      slots={[]}
      onSelect={() => undefined}
    />,
  );
}

function dispatchPointer(target: Element, type: string, pointerType: string, pointerId: number, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  });
  fireEvent(target, event);
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

function canvasScale(): number {
  const match = screen.getByTestId("canvas-world").style.transform.match(/scale\(([^)]+)\)/);
  if (!match) throw new Error("Canvas transform does not contain a scale");
  return Number(match[1]);
}
