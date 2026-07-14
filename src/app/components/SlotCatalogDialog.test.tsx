import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    render(<SlotCatalogDialog open slotLabel="Footer" entries={entries} onClose={() => undefined} onSelect={onSelect} />);

    const dialog = await screen.findByRole("dialog", { name: "Add to Footer slot" });
    expect(dialog).toHaveClass("h-[52dvh]");
    expect(dialog).not.toHaveClass("modal__dialog--full");

    await userEvent.click(screen.getByRole("button", { name: "Expand component picker" }));
    expect(dialog).toHaveClass("h-[82dvh]");
    expect(screen.getByRole("button", { name: "Collapse component picker" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Search compatible components" }), "button");
    expect(screen.queryByText("Card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Button"));
    expect(onSelect).toHaveBeenCalledWith("button");
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
