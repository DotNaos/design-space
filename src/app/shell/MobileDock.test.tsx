import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileDock, mobileDestinationForPane } from "./MobileDock";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

describe("MobileDock", () => {
  it("floats three workspace tools over the canvas and toggles drawers", async () => {
    const onChange = vi.fn();
    render(<MobileDock active="canvas" onChange={onChange} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("navigation", { name: "Mobile workspace tools" })).toHaveClass("fixed", "rounded-2xl");
    await userEvent.click(screen.getByRole("button", { name: "Open Project" }));
    expect(onChange).toHaveBeenCalledWith("documents");
  });

  it.each(["documents", "files", "catalog"] as const)("maps %s into the Project destination", (pane) => {
    const onChange = vi.fn();
    render(<MobileDock active={pane} onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Close Project" })).toHaveAttribute("aria-pressed", "true");
    expect(mobileDestinationForPane(pane)).toBe("project");
  });

  it("returns to the canvas when the active HUD tool is pressed", async () => {
    const onChange = vi.fn();
    render(<MobileDock active="tree" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Close Tree" }));
    expect(onChange).toHaveBeenCalledWith("canvas");
  });

  it("does not render the mobile HUD on a laptop viewport", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });

    render(<MobileDock active="canvas" onChange={vi.fn()} />);

    expect(screen.queryByRole("navigation", { name: "Mobile workspace tools" })).not.toBeInTheDocument();
  });
});
