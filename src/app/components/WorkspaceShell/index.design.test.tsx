import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import design from "./index.design";

describe("WorkspaceShell design", () => {
  it("uses an empty slot texture instead of starting another source workspace", () => {
    render(<>{design.render(design.defaults)}</>);

    expect(screen.getByRole("main", { name: "Empty content slot" })).toHaveClass("min-h-screen");
    expect(screen.getByRole("main", { name: "Empty content slot" })).toHaveAttribute("data-design-space-slot-texture", "content");
    expect(screen.queryByText("Workspace content")).not.toBeInTheDocument();
    expect(screen.queryByText("Source tree")).not.toBeInTheDocument();
  });
});
