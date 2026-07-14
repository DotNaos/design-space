import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComponentPropertyDraft } from "../../shared/design-document";
import { changePropertyKind, ComponentPropertyEditor } from "./ComponentPropertyEditor";

afterEach(cleanup);

describe("component property editor", () => {
  it("edits shared and text-specific contract fields with mobile-safe inputs", () => {
    const onChange = vi.fn();
    function Harness() {
      const [property, setProperty] = useState<ComponentPropertyDraft>({
        id: "copy",
        kind: "text",
        label: "Copy",
        prop: "children",
      });
      return (
        <ComponentPropertyEditor
          property={property}
          onChange={(next) => {
            setProperty(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Harness />);

    expect(screen.getByText("copy")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("copy")).not.toBeInTheDocument();
    const label = screen.getByRole("textbox", { name: "Property label" });
    expect(label).toHaveClass("text-base");
    fireEvent.change(label, { target: { value: "Body copy" } });
    fireEvent.change(screen.getByRole("textbox", { name: "React prop" }), { target: { value: "content" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Inspector section" }), { target: { value: "content" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Visible text" } });
    fireEvent.click(screen.getByRole("switch", { name: "Required" }));
    fireEvent.click(screen.getByRole("switch", { name: "Has default value" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Default value" }), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("switch", { name: "Multiline" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum length" }), { target: { value: "120" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Placeholder" }), { target: { value: "Write here" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      id: "copy",
      kind: "text",
      label: "Body copy",
      prop: "content",
      section: "content",
      description: "Visible text",
      required: true,
      defaultValue: "Hello",
      multiline: true,
      maxLength: 120,
      placeholder: "Write here",
    }));
  });

  it("creates editable Tailwind presets with stable IDs", () => {
    const onChange = vi.fn();
    function Harness() {
      const [property, setProperty] = useState<ComponentPropertyDraft>({ id: "classes", kind: "tailwind", label: "Classes", prop: "className" });
      return <ComponentPropertyEditor property={property} onChange={(next) => { setProperty(next); onChange(next); }} />;
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Preset" }));
    expect(screen.getByText("preset-1")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Preset 1 label" }), { target: { value: "Compact" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Preset 1 classes" }), { target: { value: "gap-2 p-3" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      presets: [{ id: "preset-1", label: "Compact", value: "gap-2 p-3" }],
    }));
  });

  it("edits typed select options and keeps the selected default linked", () => {
    const onChange = vi.fn();
    function Harness() {
      const [property, setProperty] = useState<ComponentPropertyDraft>({
        id: "size",
        kind: "select",
        label: "Size",
        prop: "size",
        defaultValue: "sm",
        options: [
          { label: "Small", value: "sm" },
          { label: "Large", value: 2 },
        ],
      });
      return <ComponentPropertyEditor property={property} onChange={(next) => { setProperty(next); onChange(next); }} />;
    }
    render(<Harness />);

    const firstValue = screen.getByRole("textbox", { name: "Option 1 value" });
    firstValue.focus();
    fireEvent.change(firstValue, { target: { value: "compact" } });
    expect(screen.getByRole("textbox", { name: "Option 1 value" })).toBe(firstValue);
    expect(firstValue).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultValue: "compact" }));
    fireEvent.click(screen.getByRole("button", { name: "Set Option 1 value type to number" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      defaultValue: 0,
      options: expect.arrayContaining([expect.objectContaining({ label: "Small", value: 0 })]),
    }));
    fireEvent.click(screen.getByRole("button", { name: "Option" }));
    expect(onChange.mock.lastCall?.[0].options).toHaveLength(3);
  });

  it("changes kinds without changing contract identity", () => {
    const property: ComponentPropertyDraft = {
      id: "tone",
      kind: "text",
      label: "Tone",
      prop: "tone",
      section: "style",
      required: true,
      defaultValue: "quiet",
    };
    expect(changePropertyKind(property, "select")).toEqual({
      id: "tone",
      kind: "select",
      label: "Tone",
      prop: "tone",
      section: "style",
      required: true,
      defaultValue: "default",
      options: [{ label: "Default", value: "default" }],
    });
  });
});
