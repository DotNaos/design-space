import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import design from "./index.design";

describe("WorkspaceShell design", () => {
  it("uses an isolated fixture instead of starting another source workspace", () => {
    render(<>{design.render(design.defaults)}</>);

    expect(screen.getByText("Workspace content")).toBeInTheDocument();
    expect(screen.queryByText("Source tree")).not.toBeInTheDocument();
  });
});
