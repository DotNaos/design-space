import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import design from "./index.design";

describe("WorkspaceShell design", () => {
  it("shows labeled design-only placeholders without rendering app children", () => {
    render(<>{design.render(design.defaults)}</>);

    expect(screen.getByRole("region", { name: "status slot" })).toHaveTextContent("Workspace state and connectivity");
    expect(screen.getByRole("region", { name: "content slot" })).toHaveTextContent("Primary workspace surface");
    expect(screen.getByRole("region", { name: "toolbar slot" })).toHaveTextContent("Optional workspace actions");
    expect(screen.queryByText("Source tree")).not.toBeInTheDocument();
  });
});
