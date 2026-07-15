import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SlotCatalogDialog } from "./SlotCatalogDialog";

afterEach(cleanup);

const entries = [
  { id: "card", label: "Card", group: "Surfaces", slotCount: 3 },
  { id: "button", label: "Button", group: "Actions", slotCount: 0 },
];

describe("SlotCatalogDialog", () => {
  it("searches only the compatible entries supplied by the selected slot", async () => {
    const onSelect = vi.fn();
    render(<SlotCatalogDialog open slotLabel="Footer" entries={entries} onClose={() => undefined} onSelect={onSelect} />);

    expect(await screen.findByRole("dialog", { name: "Add to Footer slot" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Search compatible components" }), "button");
    expect(screen.queryByText("Card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Button"));
    expect(onSelect).toHaveBeenCalledWith("button");
  });
});
