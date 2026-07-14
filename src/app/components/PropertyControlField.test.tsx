import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyControlField } from "./PropertyControlField";

afterEach(cleanup);

describe("PropertyControlField", () => {
  it("keeps optional numeric values visibly unset and lets users clear them again", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PropertyControlField
        control={{ id: "columns", kind: "number", label: "Columns", prop: "columns", min: 1 }}
        value={undefined}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Columns" });
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith(3);
    rerender(
      <PropertyControlField
        control={{ id: "columns", kind: "number", label: "Columns", prop: "columns", min: 1 }}
        value={3}
        onChange={onChange}
      />,
    );
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("does not emit a non-finite value from numeric text input", () => {
    const onChange = vi.fn();
    render(
      <PropertyControlField
        control={{ id: "columns", kind: "number", label: "Columns", prop: "columns" }}
        value={3}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Columns" });
    Object.defineProperty(input, "value", { configurable: true, value: "1e999", writable: true });

    expect(() => fireEvent.change(input)).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not emit when a finite step operation overflows", () => {
    const onChange = vi.fn();
    render(
      <PropertyControlField
        control={{ id: "scale", kind: "number", label: "Scale", prop: "scale", step: Number.MAX_VALUE }}
        value={Number.MAX_VALUE}
        onChange={onChange}
      />,
    );

    expect(() => fireEvent.click(screen.getByRole("button", { name: "Increase Scale" }))).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
