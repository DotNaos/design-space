import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComponentSlotDraft } from "../../shared/design-document";
import { ComponentSlotEditor } from "./ComponentSlotEditor";

afterEach(cleanup);

describe("component slot editor", () => {
  it("keeps the stable ID immutable and edits the complete slot contract", () => {
    const onChange = vi.fn();
    function Harness() {
      const [slot, setSlot] = useState<ComponentSlotDraft>({
        id: "header",
        label: "Header",
        min: 1,
        max: 2,
        accepts: [],
        acceptsText: true,
      });
      return (
        <ComponentSlotEditor
          slot={slot}
          catalogComponents={[
            { id: "catalog.card-title", label: "Card title", group: "Typography" },
            { id: "catalog.icon", label: "Icon", group: "Media" },
          ]}
          onChange={(next) => {
            setSlot(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Harness />);

    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("header")).not.toBeInTheDocument();
    const label = screen.getByRole("textbox", { name: "Slot label" });
    expect(label).toHaveClass("text-base");
    fireEvent.change(label, { target: { value: "Leading content" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: "header", label: "Leading content" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum children" }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum children" }), { target: { value: "" } });
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("max");

    fireEvent.click(screen.getByRole("switch", { name: "Accept text children" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ acceptsText: false }));

    fireEvent.click(screen.getByRole("button", { name: /Card title/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ accepts: ["catalog.card-title"] }));
  });

  it("switches between a single child and an ordered child list", () => {
    const onChange = vi.fn();
    render(<ComponentSlotEditor slot={{ id: "content", label: "Content", max: 1, accepts: [], acceptsText: false }} catalogComponents={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /List/ }));
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("max");
    fireEvent.click(screen.getByRole("button", { name: /Single/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ max: 1 }));
  });

  it("surfaces an invalid child range without mutating it", () => {
    render(
      <ComponentSlotEditor
        slot={{ id: "body", label: "Body", min: 3, max: 1 }}
        catalogComponents={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Maximum children must be at least the minimum");
  });

  it("keeps live edits in a valid range so the surrounding editor remains recoverable", () => {
    const onChange = vi.fn();
    render(<ComponentSlotEditor slot={{ id: "body", label: "Body", min: 1, max: 2 }} catalogComponents={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum children" }), { target: { value: "4" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ min: 4, max: 4 }));
  });
});
