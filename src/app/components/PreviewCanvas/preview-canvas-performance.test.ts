import { describe, expect, it } from "vitest";

import { applyCanvasCamera, canvasWorldTransform } from "./preview-canvas-performance";

describe("preview canvas performance helpers", () => {
  it("does not rewrite camera attributes when the camera did not change", () => {
    const world = document.createElement("div");
    const observer = new MutationObserver(() => undefined);
    observer.observe(world, { attributes: true });
    const camera = { x: 24, y: 48, scale: 1.25 };

    applyCanvasCamera(world, camera);
    expect(observer.takeRecords().map((record) => record.attributeName)).toEqual([
      "data-canvas-scale",
      "style",
    ]);

    applyCanvasCamera(world, camera);
    expect(observer.takeRecords()).toHaveLength(0);
    expect(world.style.transform).toBe(canvasWorldTransform(camera));
  });
});
