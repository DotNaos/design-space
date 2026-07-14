import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SlotInspector } from "./SlotInspector";

describe("SlotInspector", () => {
  it("shows the slot contract and routes insert and clear actions", async () => {
    const onInsert = vi.fn();
    const onClear = vi.fn();
    render(<SlotInspector authoredDefinition={false} slot={{ id: "footer", selectionId: "slot:card:footer", label: "Footer", count: 1, max: 2, accepts: ["button"], acceptedLabels: ["Button"], acceptsText: false, childLabel: "Button" }} onInsert={onInsert} onClear={onClear} />);
    expect(screen.getByText("1 of 2 used")).toBeInTheDocument();
    expect(screen.getAllByText("Button")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Insert into Footer" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear slot" }));
    expect(onInsert).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("blocks clearing required content and dependent authored definitions", () => {
    render(<SlotInspector authoredDefinition dependencyMessage="Used by Dashboard" slot={{ id: "body", selectionId: "outlet:body", label: "Body", count: 1, min: 1 }} onInsert={() => undefined} onClear={() => undefined} onRemoveDefinition={() => undefined} />);
    expect(screen.getByRole("button", { name: "Required content" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove slot definition" })).toBeDisabled();
  });
});
