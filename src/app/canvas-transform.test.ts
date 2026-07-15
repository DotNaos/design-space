import { describe, expect, it } from "vitest";

import { fitCanvas, maximumCanvasScale, pinchCanvas, zoomCanvasAt } from "./canvas-transform";

describe("canvas camera math", () => {
  it("keeps the anchored world point fixed while zooming", () => {
    const camera = { x: 20, y: 40, scale: 1 };
    const next = zoomCanvasAt(camera, 2, { x: 120, y: 140 });
    expect(next).toEqual({ x: -80, y: -60, scale: 2 });
  });

  it("combines pinch zoom and moving-centroid pan", () => {
    const next = pinchCanvas(
      { x: 0, y: 0, scale: 1 },
      { x: 100, y: 100 },
      { x: 120, y: 130 },
      100,
      200,
    );
    expect(next).toEqual({ x: -80, y: -70, scale: 2 });
  });

  it("fits the whole world inside a portrait viewport", () => {
    const camera = fitCanvas({ width: 390, height: 680 }, { width: 620, height: 420 });
    expect(camera.scale).toBeCloseTo(358 / 620);
    expect(camera.x).toBeCloseTo(16);
    expect(camera.y).toBeGreaterThanOrEqual(48);
  });

  it("supports pixel-level inspection zoom while keeping a finite ceiling", () => {
    expect(maximumCanvasScale).toBe(256);
    expect(zoomCanvasAt({ x: 0, y: 0, scale: 1 }, 512, { x: 0, y: 0 }).scale).toBe(256);
  });
});
