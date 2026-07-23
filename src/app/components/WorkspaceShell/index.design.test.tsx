import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import design from "./index.design";

describe("WorkspaceShell design", () => {
  it("leaves the content slot empty for the typed preview slot marker", () => {
    render(<>{design.render(design.defaults)}</>);

    expect(design.defaults.slots.content).toBeUndefined();
    expect(screen.queryByText("Workspace content")).not.toBeInTheDocument();
    expect(screen.queryByText("Source tree")).not.toBeInTheDocument();
  });
});
