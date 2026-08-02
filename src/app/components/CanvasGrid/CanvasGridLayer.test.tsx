import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { canvasGridPresentation } from "../PreviewCanvas/canvas-overlay-geometry";
import { CanvasGridLayer } from "./CanvasGridLayer";

afterEach(cleanup);

describe("CanvasGridLayer", () => {
  it("turns a deeply zoomed canvas into a dim one-world-pixel grid above the preview", () => {
    render(
      <CanvasGridLayer
        grid={canvasGridPresentation(32, { x: 32, y: 48 })}
        layoutGrid={{ color: "#22D3EE", enabled: false, size: 8 }}
        mode="dots"
        scale={32}
        visible
      />,
    );

    const grid = screen.getByTestId("canvas-grid");
    expect(grid.dataset.gridMode).toBe("pixels");
    expect(grid.dataset.worldStep).toBe("1");
    expect(grid.style.backgroundSize).toBe("32px 32px");
    expect(grid.style.backgroundImage).toContain("rgba(226, 232, 240, 0.12)");
    expect(grid.className).toContain("z-[8]");
  });

  it("keeps the configurable layout grid above UI and fades it across canvas background", () => {
    const { container } = render(
      <CanvasGridLayer
        grid={canvasGridPresentation(2, { x: 40, y: 60 })}
        layoutGrid={{ color: "#34D399", enabled: true, size: 8 }}
        mode="lines"
        rootRect={{ left: 40, top: 60, width: 320, height: 180 }}
        scale={2}
        visible={false}
      />,
    );

    const fade = container.querySelector<HTMLElement>('[data-layout-grid-layer="fade"]')!;
    const ui = container.querySelector<HTMLElement>('[data-layout-grid-layer="ui"]')!;
    expect(fade.dataset.layoutGridStep).toBe("8");
    expect(fade.style.backgroundSize).toBe("16px 16px");
    expect(fade.style.maskImage).toContain("radial-gradient");
    expect(fade.className).toContain("z-[8]");
    expect(ui.className).toContain("z-[9]");
    expect(ui.style.backgroundImage).toContain("rgba(52, 211, 153, 0.48)");
    expect(ui.style.left).toBe("40px");
    expect(ui.style.width).toBe("320px");
    expect(screen.queryByTestId("canvas-grid")).not.toBeInTheDocument();
  });
});
