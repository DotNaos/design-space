import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SourceWorkspacePageNavigation } from "./SourceWorkspacePageNavigation";

afterEach(cleanup);

it("exposes Design and Preview as distinct workspace pages", async () => {
  const onChange = vi.fn();
  render(<SourceWorkspacePageNavigation mode="design" onChange={onChange} />);

  expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Preview" })).not.toHaveAttribute("aria-current");

  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(onChange).toHaveBeenCalledWith("preview");
});
