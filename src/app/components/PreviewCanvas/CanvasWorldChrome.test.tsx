import { expect, it } from "vitest";

import { applyCanvasWorldChromeCamera } from "./CanvasWorldChrome";

it("keeps canvas header and footer synchronized with an in-flight camera", () => {
  const root = document.createElement("div");
  root.innerHTML = '<div data-canvas-world-chrome="header"></div><div data-canvas-world-chrome="footer"></div>';

  applyCanvasWorldChromeCamera(root, { scale: 0.35, x: 24, y: 120 }, {
    footerHeight: 32,
    headerHeight: 64,
    worldHeight: 800,
    worldWidth: 1280,
  });

  expect(root.querySelector('[data-canvas-world-chrome="header"]')).toHaveStyle({
    height: "64px",
    left: "24px",
    top: "56px",
    width: "448px",
  });
  expect(root.querySelector('[data-canvas-world-chrome="footer"]')).toHaveStyle({
    height: "32px",
    left: "24px",
    top: "400px",
    width: "448px",
  });
});
