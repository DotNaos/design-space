import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { WorkspaceSidebar } from "./WorkspaceSidebar";

it("switches one contextual workspace without rendering parallel panels", async () => {
  const onChange = vi.fn();
  render(<WorkspaceSidebar active="tree" onChange={onChange}><p>Component rows</p></WorkspaceSidebar>);
  expect(screen.getByRole("button", { name: "Tree" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Component rows")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Files" }));
  expect(onChange).toHaveBeenCalledWith("files");
});
