import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SourceTreeAnchorControls } from "./SourceTreeAnchorControls";

afterEach(cleanup);

it("only offers a selection jump when the selection is outside the viewport", async () => {
  const onScrollToSelected = vi.fn();
  const view = render(
    <SourceTreeAnchorControls
      onScrollToActive={vi.fn()}
      onScrollToSelected={onScrollToSelected}
    />,
  );
  expect(screen.queryByRole("button", { name: /Scroll to current selection/ })).not.toBeInTheDocument();

  view.rerender(
    <SourceTreeAnchorControls
      selectedDirection="below"
      onScrollToActive={vi.fn()}
      onScrollToSelected={onScrollToSelected}
    />,
  );
  const button = screen.getByRole("button", { name: "Scroll to current selection below" });
  expect(button.parentElement).toHaveClass("bottom-3");
  await userEvent.click(button);
  expect(onScrollToSelected).toHaveBeenCalledOnce();
});
