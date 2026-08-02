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

it("leaves a pinned canvas header untouched while the camera moves", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-canvas-world-chrome="header" data-canvas-world-chrome-pinned style="left:50%;top:56px;width:600px"></div>
    <div data-canvas-world-chrome="footer"></div>
  `;

  applyCanvasWorldChromeCamera(root, { scale: 2, x: -420, y: -180 }, {
    footerHeight: 32,
    headerHeight: 36,
    worldHeight: 800,
    worldWidth: 1280,
  });

  expect(root.querySelector('[data-canvas-world-chrome="header"]')).toHaveStyle({
    left: "50%",
    top: "56px",
    width: "600px",
  });
  expect(root.querySelector('[data-canvas-world-chrome="footer"]')).toHaveStyle({
    left: "-420px",
    top: "1420px",
    width: "2560px",
  });
});
