import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SlotCatalogDialog } from "./SlotCatalogDialog";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

const entries = [
  { id: "card", label: "Card", group: "Surfaces", slotCount: 3 },
  { id: "button", label: "Button", group: "Actions", slotCount: 0 },
];

describe("SlotCatalogDialog", () => {
  it("searches only the compatible entries supplied by the selected slot", async () => {
    const onSelect = vi.fn();
    const { container } = render(<SlotCatalogDialog open slotLabel="Footer" entries={entries} onClose={() => undefined} onSelect={onSelect} />);

    const dialog = await screen.findByRole("dialog", { name: "Add to Footer slot" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-slot", "drawer-dialog");
    expect(dialog.querySelector('[data-slot="drawer-handle"]')).toBeInTheDocument();
    expect(container).not.toContainElement(dialog);
    expect(dialog).toHaveClass("h-[52dvh]");
    expect(dialog).not.toHaveClass("modal__dialog--full");

    await userEvent.click(screen.getByRole("button", { name: "Expand component picker" }));
    expect(dialog).toHaveClass("h-[82dvh]");
    expect(screen.getByRole("button", { name: "Collapse component picker" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search compatible components"), "button");
    expect(screen.queryByText("Card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Button"));
    expect(onSelect).toHaveBeenCalledWith("button");
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<CatalogFocusHarness />);

    const opener = screen.getByRole("button", { name: "Open component picker" });
    await user.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Add to Footer slot" });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add to Footer slot" })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("does not mount its mobile backdrop on desktop", () => {
    mockDesktopViewport();

    render(<SlotCatalogDialog open slotLabel="Footer" entries={entries} onClose={() => undefined} onSelect={() => undefined} />);

    expect(screen.queryByRole("dialog", { name: "Add to Footer slot" })).not.toBeInTheDocument();
  });
});

function mockDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function CatalogFocusHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open component picker</button>
      <SlotCatalogDialog open={open} slotLabel="Footer" entries={entries} onClose={() => setOpen(false)} onSelect={() => undefined} />
    </>
  );
}
