import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewCanvas } from "./PreviewCanvas";

describe("preview canvas", () => {
  it("draws the selection from the measured target DOM rectangle", async () => {
    const onSelect = vi.fn();
    render(
      <PreviewCanvas
        compact
        preview={<div data-design-space-instance-id="copy">Copy</div>}
        rootInstanceId="root"
        selectedComponentInstanceId="copy"
        selection={{ kind: "component", id: "copy" }}
        selectionLabel="Copy"
        slots={[]}
        onSelect={onSelect}
      />,
    );
    const canvas = screen.getByRole("main", { name: "Preview canvas" });
    const copy = screen.getByText("Copy");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(rect(10, 20, 390, 300));
    vi.spyOn(copy, "getBoundingClientRect").mockReturnValue(rect(42, 68, 120, 44));

    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(screen.getByTestId("selection-outline")).toHaveStyle({
      left: "32px",
      top: "48px",
      width: "120px",
      height: "44px",
    }));

    fireEvent.click(copy);
    expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "copy" });
  });
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
