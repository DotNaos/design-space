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
});
