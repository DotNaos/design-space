import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileItemEditor, replaceClassGroup } from "./MobileItemEditor";

describe("mobile item editor", () => {
  it("keeps class replacement scoped to one property group", () => {
    expect(replaceClassGroup("p-4 text-sm bg-zinc-950", ["", "p-4", "p-6"], "p-6"))
      .toBe("text-sm bg-zinc-950 p-6");
  });

  it("exposes staged item actions and blocks Apply on compile errors", () => {
    const onCancel = vi.fn();
    const onControlChange = vi.fn();
    render(
      <MobileItemEditor
        componentLabel="Text"
        controls={[
          { id: "surface", label: "Tailwind classes", kind: "tailwind", prop: "className" },
          { id: "content", label: "Content", kind: "text", prop: "children" },
        ]}
        controlValues={{ className: "text-sm", children: "Planning" }}
        preview={<p data-design-space-instance-id="copy">Planning</p>}
        previewCss=""
        rootInstanceId="root"
        selectedInstanceId="copy"
        slots={[]}
        compileError="Unknown Tailwind class"
        compilePending={false}
        sourceBacked={false}
        canMoveUp={false}
        canMoveDown
        canDuplicate
        canDelete
        onControlChange={onControlChange}
        onSelectComponent={vi.fn()}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onCancel={onCancel}
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Content" }), { target: { value: "Updated" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Tailwind classes" }), { target: { value: "text-lg" } });
    expect(onControlChange).toHaveBeenCalledWith("children", "Updated");
    expect(onControlChange).toHaveBeenCalledWith("className", "text-lg");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
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
        preview={<span data-design-space-instance-id="label">Target label</span>}
        previewCss=""
        rootInstanceId="root"
        selectedInstanceId="label"
        slots={[]}
        compilePending={false}
        sourceBacked={false}
        canMoveUp={false}
        canMoveDown={false}
        canDuplicate={false}
        canDelete
        onControlChange={onControlChange}
        onSelectComponent={vi.fn()}
        onMove={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), { target: { value: "Renamed" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Classes" }), { target: { value: "text-lg" } });
    expect(onControlChange).toHaveBeenCalledWith("label", "Renamed");
    expect(onControlChange).toHaveBeenCalledWith("classes", "text-lg");
  });
});
