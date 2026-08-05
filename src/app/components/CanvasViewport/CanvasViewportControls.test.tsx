import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultCanvasLayoutGrid } from "../CanvasGrid/canvas-grid-types";
import { CanvasViewportControls } from "./CanvasViewportControls";

afterEach(cleanup);

describe("CanvasViewportControls", () => {
  it("docks canvas navigation above the zoom-independent controls", () => {
    render(
      <CanvasViewportControls
        gridMode="dots"
        gridVisible={false}
        headerContent={<nav aria-label="Canvas ancestry">Path</nav>}
        interactionMode="select"
        layoutGrid={defaultCanvasLayoutGrid}
        leadingContent={<span>Viewport picker</span>}
        scale={1}
        onFit={vi.fn()}
        onGridModeChange={vi.fn()}
        onGridVisibleChange={vi.fn()}
        onLayoutGridChange={vi.fn()}
        onReset={vi.fn()}
        onToggleInteractionMode={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-fixed-header")).toContainElement(
      screen.getByRole("navigation", { name: "Canvas ancestry" }),
    );
    expect(screen.getByTestId("canvas-viewport-toolbar")).toHaveStyle({ top: "48px" });
  });

  it("nests narrow viewport and canvas actions under two toolbar tabs", async () => {
    render(
      <CanvasViewportControls
        gridMode="dots"
        gridVisible={false}
        interactionMode="select"
        layoutGrid={defaultCanvasLayoutGrid}
        leadingContent={<span>Mobile viewport actions</span>}
        narrow
        scale={1.03}
        onFit={vi.fn()}
        onGridModeChange={vi.fn()}
        onGridVisibleChange={vi.fn()}
        onLayoutGridChange={vi.fn()}
        onReset={vi.fn()}
        onToggleInteractionMode={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-viewport-toolbar")).toHaveAttribute("data-layout", "nested");
    expect(screen.getByRole("navigation", { name: "Canvas toolbar sections" })).toHaveClass("justify-center", "rounded-full");
    expect(screen.getByRole("button", { name: "Viewport" })).toHaveClass("bg-[#303239]", "text-white", "rounded-full");
    expect(screen.getByTestId("canvas-toolbar-actions")).toHaveClass("justify-center", "rounded-full");
    expect(screen.getByText("Mobile viewport actions")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Fit canvas" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Canvas" }));
    expect(screen.getByRole("button", { name: "Canvas" })).toHaveClass("bg-[#303239]", "text-white");
    expect(screen.getByRole("button", { name: "Fit canvas" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset zoom to 100%" })).toBeVisible();
    expect(screen.queryByText("Mobile viewport actions")).not.toBeInTheDocument();
  });

  it("opens component signing as its own toolbar section", async () => {
    render(
      <CanvasViewportControls
        gridMode="dots"
        gridVisible={false}
        interactionMode="select"
        layoutGrid={defaultCanvasLayoutGrid}
        leadingContent={<span>Viewport actions</span>}
        scale={1}
        signingContent={<section aria-label="Component signing">WorkspaceStatus fingerprint</section>}
        onFit={vi.fn()}
        onGridModeChange={vi.fn()}
        onGridVisibleChange={vi.fn()}
        onLayoutGridChange={vi.fn()}
        onReset={vi.fn()}
        onToggleInteractionMode={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-viewport-toolbar")).toHaveAttribute("data-layout", "nested");
    expect(screen.queryByLabelText("Component signing")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Signing" }));
    expect(screen.getByLabelText("Component signing")).toHaveTextContent("WorkspaceStatus fingerprint");
    expect(screen.queryByText("Viewport actions")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Viewport" }));
    expect(screen.getByText("Viewport actions")).toBeVisible();
  });
});
