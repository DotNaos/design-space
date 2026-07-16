import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SlotCatalogPanel } from "./SlotCatalogPanel";

const entries = [
  { id: "card", label: "Card", group: "Surfaces", slotCount: 3 },
  { id: "button", label: "Button", group: "Actions", slotCount: 0 },
];

describe("SlotCatalogPanel", () => {
  it("keeps only compatible supplied entries searchable and selectable", async () => {
    const onSelect = vi.fn();
    render(<SlotCatalogPanel slotLabel="Footer" entries={entries} onClose={() => undefined} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Search compatible components" }), "button");
    expect(screen.queryByText("Card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Button, no children" }));
    expect(onSelect).toHaveBeenCalledWith("button");
  });
});
