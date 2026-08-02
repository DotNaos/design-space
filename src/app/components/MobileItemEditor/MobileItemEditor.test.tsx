import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileItemEditor, replaceClassGroup } from "./MobileItemEditor";

afterEach(cleanup);

describe("mobile item editor", () => {
  it("keeps class replacement scoped to one property group", () => {
    expect(replaceClassGroup("p-4 text-sm bg-zinc-950", ["", "p-4", "p-6"], "p-6"))
      .toBe("text-sm bg-zinc-950 p-6");
  });

  it("exposes staged item actions and blocks Apply on compile errors", () => {
    const onCancel = vi.fn();
    const onControlChange = vi.fn();
    const onSelectSlot = vi.fn();
    render(
      <MobileItemEditor
        componentLabel="Text"
        controls={[
          { id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" },
          { id: "content", label: "Content", kind: "text", prop: "children" },
        ]}
        controlValues={{ className: "text-sm", children: "Planning" }}
        previewCss=""
        slots={[{ id: "body", selectionId: "slot:copy:body", label: "Body", count: 0 }]}
        compileError="Unknown Tailwind class"
        compilePending={false}
        sourceBacked={false}
        canMoveUp={false}
        canMoveDown
        canDuplicate
        canDelete
        onControlChange={onControlChange}
        onSelectSlot={onSelectSlot}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onCancel={onCancel}
        onApply={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Text" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-slot", "drawer-dialog");
    expect(dialog.querySelector('[data-slot="drawer-handle"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Properties" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Content" }), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("tab", { name: "Classes" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tailwind classes" }), { target: { value: "text-lg" } });
    expect(onControlChange).toHaveBeenCalledWith("children", "Updated");
    expect(onControlChange).toHaveBeenCalledWith("className", "text-lg");
    fireEvent.click(screen.getByRole("tab", { name: "Slots" }));
    fireEvent.click(screen.getByRole("button", { name: "Body slot, empty" }));
    expect(onSelectSlot).toHaveBeenCalledWith(expect.objectContaining({ id: "body", count: 0 }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses target-owned property names instead of assuming className and children", () => {
    const onControlChange = vi.fn();
    render(
      <MobileItemEditor
        componentLabel="Label"
        controls={[
          { id: "style", label: "Classes", kind: "tailwind", prop: "classes" },
          { id: "copy", label: "Label", kind: "text", prop: "label" },
        ]}
        controlValues={{ classes: "text-sm", label: "Target label" }}
        previewCss=""
        slots={[]}
        compilePending={false}
        sourceBacked={false}
        canMoveUp={false}
        canMoveDown={false}
        canDuplicate={false}
        canDelete
        onControlChange={onControlChange}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Properties" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("tab", { name: "Classes" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Classes" }), { target: { value: "text-lg" } });
    expect(onControlChange).toHaveBeenCalledWith("label", "Renamed");
    expect(onControlChange).toHaveBeenCalledWith("classes", "text-lg");
  });

  it("lets Escape close an open property menu before closing the editor", () => {
    const onCancel = vi.fn();
    render(
      <MobileItemEditor
        componentLabel="Stack"
        controls={[
          { id: "style", label: "Classes", kind: "tailwind", prop: "classes" },
          { id: "spacing", label: "Spacing", kind: "tailwind", prop: "spacing" },
        ]}
        controlValues={{ classes: "flex gap-3", spacing: "p-4" }}
        previewCss=""
        slots={[]}
        compilePending={false}
        sourceBacked={false}
        canMoveUp={false}
        canMoveDown={false}
        canDuplicate={false}
        canDelete
        onControlChange={vi.fn()}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onCancel={onCancel}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Classes Tailwind property/ }));
    const listbox = screen.getByRole("listbox", { name: "Tailwind property" });
    expect(listbox).toBeVisible();
    fireEvent.keyDown(listbox, { key: "Escape", code: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit Stack" })).toBeVisible();
    expect(screen.queryByRole("listbox", { name: "Tailwind property" })).not.toBeInTheDocument();
  });
});
