import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ComponentTreeRow } from "../../model";
import type { StrictUiViolation } from "../../shared/strict-ui";
import { ComponentTree } from "./ComponentTree";

afterEach(cleanup);

describe("ComponentTree Strict UI markers", () => {
  it("marks affected component, slot, and outlet rows without changing row navigation", async () => {
    const onSelect = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="card.one"
        showInternals={false}
        strictUiViolations={violations}
        onSelect={onSelect}
        onToggleInternals={vi.fn()}
      />,
    );

    const component = screen.getByRole("button", { name: /Card/ });
    const slot = screen.getByRole("button", { name: /Body slot/ });
    const outlet = screen.getByRole("button", { name: /Body outlet/ });

    expect(component).toHaveAttribute("data-strict-ui-severity", "error");
    expect(component).toHaveAttribute("data-strict-ui-count", "2");
    expect(slot).toHaveAttribute("data-strict-ui-severity", "warning");
    expect(outlet).toHaveAttribute("data-strict-ui-severity", "error");
    expect(screen.getByRole("img", { name: /1 Strict UI error, 1 Strict UI warning/ })).toBeInTheDocument();

    await userEvent.click(slot);
    expect(onSelect).toHaveBeenLastCalledWith({
      kind: "slot",
      id: "slot:card.one:body",
      componentInstanceId: "card.one",
      slotId: "body",
    });
  });

  it("keeps insertion available from the tree for empty and occupied slots", async () => {
    const onInsert = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="card.one"
        showInternals={false}
        insertMode
        prompt="Choose a slot with room."
        onInsert={onInsert}
        onSelect={vi.fn()}
        onToggleInternals={vi.fn()}
      />,
    );

    const insert = screen.getByRole("button", { name: "Cancel" });
    expect(insert).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Choose a slot with room.")).toBeInTheDocument();
    await userEvent.click(insert);
    expect(onInsert).toHaveBeenCalledOnce();
  });
});

const rows: readonly ComponentTreeRow[] = [
  { kind: "component", depth: 0, label: "Card", selection: { kind: "component", id: "card.one" } },
  {
    kind: "slot",
    depth: 1,
    label: "Body",
    occupied: true,
    childCount: 1,
    selection: { kind: "slot", id: "slot:card.one:body", componentInstanceId: "card.one", slotId: "body" },
  },
  {
    kind: "slot-outlet",
    depth: 2,
    label: "Body outlet",
    selection: { kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" },
  },
];

const violations: readonly StrictUiViolation[] = [
  { ruleId: "property.required", severity: "error", message: "Title is required.", location: { kind: "instance", instanceId: "card.one" } },
  { ruleId: "property.token", severity: "warning", message: "Use a token.", location: { kind: "control", instanceId: "card.one", controlId: "tone" } },
  { ruleId: "slot.maximum", severity: "warning", message: "Body has too many items.", location: { kind: "slot", instanceId: "card.one", slotId: "body" } },
  { ruleId: "outlet.missing", severity: "error", message: "Body needs one outlet.", location: { kind: "slot-outlet", slotId: "body" } },
];
