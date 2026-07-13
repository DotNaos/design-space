import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffSheet } from "./DiffSheet";

afterEach(cleanup);

describe("DiffSheet", () => {
  it("presents the prepared diff as a dismissable modal", async () => {
    const onClose = vi.fn();
    render(<DiffSheet diff="-old\n+new\n" onClose={onClose} />);

    expect(await screen.findByRole("dialog", { name: "Exact source diff" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close diff" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
