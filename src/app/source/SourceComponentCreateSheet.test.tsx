import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { SourceComponentCreateSheet } from "./SourceComponentCreateSheet";

afterEach(cleanup);

it("prepares only a valid PascalCase TypeScript component name", async () => {
  const onPrepare = vi.fn();
  render(
    <SourceComponentCreateSheet
      open
      busy={false}
      onClose={() => undefined}
      onPrepare={onPrepare}
    />,
  );

  const input = screen.getByRole("textbox", { name: "Component name" });
  const review = screen.getByRole("button", { name: "Review source" });
  await userEvent.type(input, "status badge");
  expect(review).toBeDisabled();
  expect(screen.getByText(/Start with a capital letter/)).toBeVisible();

  await userEvent.clear(input);
  await userEvent.type(input, "StatusBadge");
  await userEvent.click(review);
  expect(onPrepare).toHaveBeenCalledWith("StatusBadge");
});

it("shows safe operation failures without hiding the form", async () => {
  render(
    <SourceComponentCreateSheet
      open
      busy={false}
      error="The component destination already exists"
      onClose={() => undefined}
      onPrepare={() => undefined}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("already exists");
});
