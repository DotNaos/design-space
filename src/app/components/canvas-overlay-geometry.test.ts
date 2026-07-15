import { afterEach, describe, expect, it } from "vitest";

import {
  canvasGridPresentation,
  layoutEmptySlotOverlays,
  measureCanvasSelector,
  placeCanvasOverlayLabels,
  type ViewRect,
} from "./canvas-overlay-geometry";

afterEach(() => {
  document.body.replaceChildren();
});

describe("canvas overlay geometry", () => {
  it("snaps measured overlay edges to physical pixels", () => {
    const world = document.createElement("div");
    const target = document.createElement("div");
    target.dataset.designSpaceInstanceId = "card";
    world.append(target);
    document.body.append(world);
    target.getBoundingClientRect = () => domRect(42.35, 68.2, 120.4, 44.3);

    expect(measureCanvasSelector(
      world,
      '[data-design-space-instance-id="card"]',
      domRect(10.1, 20.1, 400, 300),
      2,
    )).toEqual({ left: 32.5, top: 48, width: 120, height: 44.5 });
  });

  it("changes grid detail while capping the dot radius at strong zoom", () => {
    const far = canvasGridPresentation(0.25, { x: 10.2, y: 20.2 });
    const normal = canvasGridPresentation(1, { x: 10.2, y: 20.2 });
    const near = canvasGridPresentation(4, { x: 10.2, y: 20.2 });
    const closer = canvasGridPresentation(8, { x: 10.2, y: 20.2 });
    const pixelReady = canvasGridPresentation(32, { x: 10.2, y: 20.2 });

    expect(far.worldStep).toBe(80);
    expect(far.screenStep).toBe(20);
    expect(normal.worldStep).toBe(20);
    expect(near.worldStep).toBe(5);
    expect(closer.worldStep).toBe(4);
    expect(pixelReady.worldStep).toBe(1);
    expect(far.dotRadius).toBe(0.5);
    expect(normal.dotRadius).toBe(2);
    expect(near.dotRadius).toBe(3);
  });

  it("keeps a dot centered on the component edge when grid detail changes", () => {
    for (const scale of [1, 0.7, 0.5, 0.25]) {
      const grid = canvasGridPresentation(scale, { x: 32, y: 48 });

      expect(grid.backgroundPositionX + grid.screenStep / 2).toBe(32);
      expect(grid.backgroundPositionY + grid.screenStep / 2).toBe(48);
    }
  });

  it("caps synthetic empty-slot height before the next slot begins", () => {
    const result = layoutEmptySlotOverlays([
      { id: "header", rect: viewRect(20, 40, 180, 0) },
      { id: "body", rect: viewRect(20, 54, 180, 20) },
    ], 1, 2);

    expect(result.header).toEqual(viewRect(20, 40, 180, 13));
    expect(result.body).toEqual(viewRect(20, 54, 180, 32));
  });

  it("places neighboring labels without letting their boxes overlap", () => {
    const labels = placeCanvasOverlayLabels([
      { id: "selection", text: "Card", anchor: viewRect(20, 40, 180, 80), placement: "selection" },
      { id: "slot-a", text: "Header · empty", anchor: viewRect(20, 42, 180, 8), placement: "slot" },
      { id: "slot-b", text: "Body · empty", anchor: viewRect(20, 52, 180, 8), placement: "slot" },
    ], [], { width: 240, height: 180 });

    for (const [index, label] of labels.entries()) {
      expect(labels.slice(index + 1).every((other) => !overlaps(label, other))).toBe(true);
    }
  });

  it("keeps a fixed-size label outside a slot that became short at low zoom", () => {
    const anchor = viewRect(20, 80, 180, 8);
    const [label] = placeCanvasOverlayLabels([
      { id: "slot", text: "Footer · empty", anchor, placement: "slot" },
    ], [], { width: 240, height: 180 });

    expect(label.top + label.height <= anchor.top || label.top >= anchor.top + anchor.height).toBe(true);
  });
});

function viewRect(left: number, top: number, width: number, height: number): ViewRect {
  return { left, top, width, height };
}

function domRect(left: number, top: number, width: number, height: number): DOMRect {
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

function overlaps(first: ViewRect, second: ViewRect): boolean {
  return first.left < second.left + second.width
    && first.left + first.width > second.left
    && first.top < second.top + second.height
    && first.top + first.height > second.top;
}
