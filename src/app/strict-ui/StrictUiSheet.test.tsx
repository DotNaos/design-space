import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StrictUiSheet } from "./StrictUiSheet";

afterEach(cleanup);

describe("Strict UI sheet", () => {
  it("uses modal semantics, closes with Escape, and restores focus", async () => {
    const onRecheck = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open Strict UI</button>
          <StrictUiSheet
            open={open}
            liveViolations={[]}
            checking={false}
            onClose={() => setOpen(false)}
            onSelect={vi.fn()}
            onRecheck={onRecheck}
          />
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open Strict UI" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Strict UI" });
    fireEvent.click(screen.getByRole("button", { name: "Check current document" }));
    expect(onRecheck).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Strict UI" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
