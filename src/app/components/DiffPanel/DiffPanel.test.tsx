import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffPanel } from "./DiffPanel";

afterEach(cleanup);

describe("DiffPanel", () => {
  it("renders a reviewable inline diff with close and save actions", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<DiffPanel diff={"@@ -1 +1 @@\n-old\n+new"} saving={false} onClose={onClose} onSave={onSave} />);

    expect(screen.getByRole("region", { name: "Exact source diff" })).toBeInTheDocument();
    expect(screen.getByText("-old")).toBeInTheDocument();
    expect(screen.getByText("+new")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await userEvent.click(screen.getByRole("button", { name: "Close diff" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables saving while a save is in progress", () => {
    render(<DiffPanel diff={"-old\n+new"} saving onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
