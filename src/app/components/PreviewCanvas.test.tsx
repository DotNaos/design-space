import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreviewCanvas } from "./PreviewCanvas";

afterEach(cleanup);

describe("preview canvas", () => {
  it("draws the selection from the measured target DOM rectangle", async () => {
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={<div data-design-space-instance-id="copy">Copy</div>}
        rootInstanceId="root"
        selectedComponentInstanceId="copy"
        selection={{ kind: "component", id: "copy" }}
        selectionLabel="Copy"
        slots={[]}
        onSelect={onSelect}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const copy = screen.getByText("Copy");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue(rect(42, 68, 120, 44));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("selection-outline")).toHaveStyle({
      left: "32px",
      top: "48px",
      width: "120px",
      height: "44px",
    }));

    fireEvent.click(copy);
    expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "copy" });
  });

  it("marks affected canvas elements and lets a marker navigate to its editor", async () => {
    const onSelect = vi.fn();
    const onEditComponent = vi.fn();
    render(
      <PreviewCanvas
        preview={(
          <div data-design-space-instance-id="root">
            <div data-design-space-instance-id="card.one" data-design-space-slot-id="slot:root:body">Card</div>
          </div>
        )}
        rootInstanceId="root"
        selectedComponentInstanceId="root"
        selection={{ kind: "component", id: "root" }}
        selectionLabel="Root"
        slots={[]}
        strictUiViolations={[
          { ruleId: "property.required", severity: "error", message: "Title is required.", location: { kind: "control", instanceId: "card.one", controlId: "title" } },
          { ruleId: "slot.minimum", severity: "warning", message: "Body needs content.", location: { kind: "slot", instanceId: "root", slotId: "body" } },
        ]}
        onEditComponent={onEditComponent}
        onSelect={onSelect}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const root = canvas.querySelector<HTMLElement>('[data-design-space-instance-id="root"]')!;
    const card = canvas.querySelector<HTMLElement>('[data-design-space-instance-id="card.one"]')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(rect(30, 50, 250, 180));
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(rect(42, 68, 120, 44));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getAllByTestId("strict-ui-canvas-marker")).toHaveLength(2));
    expect(screen.getAllByTestId("strict-ui-canvas-marker").map((marker) => marker.dataset.strictUiSeverity)).toEqual(expect.arrayContaining(["error", "warning"]));

    fireEvent.click(screen.getByRole("button", { name: /1 Strict UI error.*Title is required/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "card.one" });
    expect(onEditComponent).toHaveBeenCalledWith("card.one");

    fireEvent.click(screen.getByRole("button", { name: /1 Strict UI warning.*Body needs content/ }));
    expect(onSelect).toHaveBeenLastCalledWith({
      kind: "slot",
      id: "slot:root:body",
      componentInstanceId: "root",
      slotId: "body",
    });
  });

  it("measures an explicit slot outlet instead of the document root", async () => {
    render(
      <PreviewCanvas
        compact
        preview={(
          <div data-design-space-instance-id="root">
            <span data-design-space-outlet-id="body.outlet" />
          </div>
        )}
        rootInstanceId="root"
        selectedComponentInstanceId="root"
        selection={{ kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" }}
        selectionLabel="Body outlet"
        slots={[]}
        onSelect={() => undefined}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const outlet = canvas.querySelector<HTMLElement>('[data-design-space-outlet-id="body.outlet"]')!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(outlet, "getBoundingClientRect").mockReturnValue(rect(80, 120, 140, 2));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("selection-outline")).toHaveStyle({
      left: "70px",
      top: "100px",
      width: "140px",
      height: "2px",
    }));
  });

  it("selects and measures the real DOM element represented by an internal HTML tree row", async () => {
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={(
          <article data-design-space-instance-id="card-one">
            <header data-design-space-html-id="html:card-one:card.header">Header</header>
          </article>
        )}
        rootInstanceId="card-one"
        selectedComponentInstanceId="card-one"
        selection={{
          kind: "html",
          id: "html:card-one:card.header",
          componentInstanceId: "card-one",
          nodeId: "card.header",
        }}
        selectionLabel="<header>"
        slots={[]}
        onSelect={onSelect}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const header = screen.getByText("Header");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(38, 74, 160, 36));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("selection-outline")).toHaveStyle({
      left: "28px",
      top: "54px",
      width: "160px",
      height: "36px",
    }));

    fireEvent.click(header);
    expect(onSelect).toHaveBeenCalledWith({
      kind: "html",
      id: "html:card-one:card.header",
      componentInstanceId: "card-one",
      nodeId: "card.header",
    });
  });

  it("resets a moved camera when the document key changes", () => {
    const { rerender } = render(
      <PreviewCanvas
        cameraKey="screen.one"
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
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("canvas-world").style.transform).toContain("scale(1.1)");

    rerender(
      <PreviewCanvas
        cameraKey="screen.two"
        compact
        preview={<div data-design-space-instance-id="two">Two</div>}
        rootInstanceId="two"
        selectedComponentInstanceId="two"
        selection={{ kind: "component", id: "two" }}
        selectionLabel="Two"
        slots={[]}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByTestId("canvas-world").style.transform).toContain("scale(1)");
  });

  it("keeps the camera when the current document rerenders", () => {
    const { rerender } = render(
      <PreviewCanvas
        cameraKey="screen.one"
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
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByTestId("canvas-world").style.transform).toContain("scale(1.1)");

    rerender(
      <PreviewCanvas
        cameraKey="screen.one"
        compact
        preview={<div data-design-space-instance-id="one">One updated</div>}
        rootInstanceId="one"
        selectedComponentInstanceId="one"
        selection={{ kind: "component", id: "one" }}
        selectionLabel="One updated"
        slots={[]}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByTestId("canvas-world").style.transform).toContain("scale(1.1)");
  });

  it("pinches around two touch pointers and pans with one touch pointer", () => {
    render(
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
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    Object.defineProperties(canvas, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });

    dispatchPointer(canvas, "pointerdown", 1, 100, 100);
    dispatchPointer(canvas, "pointerdown", 2, 200, 100);
    dispatchPointer(canvas, "pointermove", 2, 300, 100);

    expect(screen.getByTestId("canvas-world").style.transform).toContain("scale(2)");

    dispatchPointer(canvas, "pointerup", 2, 300, 100);
    const beforePan = screen.getByTestId("canvas-world").style.transform;
    dispatchPointer(canvas, "pointermove", 1, 140, 130);
    expect(screen.getByTestId("canvas-world").style.transform).not.toBe(beforePan);
  });

  it("measures descendants of a display-contents adapter anchor", async () => {
    render(
      <PreviewCanvas
        compact
        preview={<span data-design-space-instance-id="fragment"><strong>Fragment child</strong></span>}
        rootInstanceId="fragment"
        selectedComponentInstanceId="fragment"
        selection={{ kind: "component", id: "fragment" }}
        selectionLabel="Fragment"
        slots={[]}
        onSelect={() => undefined}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const anchor = canvas.querySelector<HTMLElement>('[data-design-space-instance-id="fragment"]')!;
    const child = screen.getByText("Fragment child");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(rect(0, 0, 0, 0));
    vi.spyOn(child, "getBoundingClientRect").mockReturnValue(rect(30, 60, 180, 30));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("selection-outline")).toHaveStyle({
      left: "20px",
      top: "40px",
      width: "180px",
      height: "30px",
    }));
  });

  it("reports the observed component DOM hierarchy back to the tree model", async () => {
    const onDomSnapshot = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={<article data-design-space-instance-id="card"><div><button>Action</button></div></article>}
        rootInstanceId="card"
        selectedComponentInstanceId="card"
        selection={{ kind: "component", id: "card" }}
        selectionLabel="Card"
        slots={[]}
        onDomSnapshot={onDomSnapshot}
        onSelect={() => undefined}
      />,
    );

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(onDomSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      card: [expect.objectContaining({ tagName: "article", children: [expect.objectContaining({ tagName: "div" })] })],
    })));
  });
});

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

function dispatchPointer(target: Element, type: string, pointerId: number, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
  });
  fireEvent(target, event);
}
