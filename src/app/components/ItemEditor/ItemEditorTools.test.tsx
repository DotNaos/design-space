import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ItemEditorTools } from "./ItemEditorTools";

afterEach(cleanup);

describe("item editor tools", () => {
  it("shares target properties and slots behind accessible desktop tool tabs", () => {
    const onControlChange = vi.fn();
    const onSelectSlot = vi.fn();
    render(
      <ItemEditorTools
        mode="desktop"
        controls={[
          { id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" },
          { id: "copy", label: "Content", kind: "text", prop: "children" },
        ]}
        values={{ className: "flex p-4", children: "Planning" }}
        slots={[{ id: "body", selectionId: "slot:card:body", label: "Body", count: 0 }]}
        onControlChange={onControlChange}
        onSelectSlot={onSelectSlot}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Item editor tools" })).toHaveAttribute("aria-orientation", "vertical");
    const designTab = screen.getByRole("tab", { name: "Design" });
    designTab.focus();
    fireEvent.keyDown(designTab, { key: "ArrowDown" });
    expect(screen.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "Content" }), { target: { value: "Updated" } });
    expect(onControlChange).toHaveBeenCalledWith("children", "Updated");

    fireEvent.click(screen.getByRole("tab", { name: "Slots" }));
    fireEvent.click(screen.getByRole("button", { name: "Body slot, empty" }));
    expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({ id: "body" }));
  });

  it("keeps one class field while switching between multiple target-owned Tailwind properties", async () => {
    const user = userEvent.setup();
    const onControlChange = vi.fn();
    render(
      <ItemEditorTools
        mode="mobile"
        controls={[
          { id: "surface", label: "Surface classes", kind: "tailwind", prop: "surfaceClasses" },
          { id: "content", label: "Content classes", kind: "tailwind", prop: "contentClasses" },
        ]}
        values={{ surfaceClasses: "rounded-lg", contentClasses: "text-sm" }}
        slots={[]}
        onControlChange={onControlChange}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Classes" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const propertyPicker = screen.getByRole("button", { name: /Tailwind property/ });
    await user.click(propertyPicker);
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByRole("option", { name: "Content classes" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Content classes" }), { target: { value: "text-lg" } });
    expect(onControlChange).toHaveBeenCalledWith("contentClasses", "text-lg");
  });
});
