import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileNavigation } from "./MobileNavigation";

afterEach(cleanup);

describe("MobileNavigation", () => {
  it("exposes every primary mobile workspace with Preview selected", () => {
    render(<MobileNavigation active="preview" onChange={() => undefined} />);

    expect(screen.getByRole("navigation", { name: "Mobile workspace" })).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Tree",
      "Files",
      "Preview",
      "Catalog",
      "Inspect",
    ]);
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-current", "page");
  });

  it("changes to a single requested workspace", async () => {
    const onChange = vi.fn();
    render(<MobileNavigation active="preview" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(onChange).toHaveBeenCalledWith("tree");
  });
});
