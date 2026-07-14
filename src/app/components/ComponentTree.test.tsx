import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    const component = screen.getByRole("treeitem", { name: /^Card\b/ });
    const slot = screen.getByRole("treeitem", { name: /Body slot/ });
    const outlet = screen.getByRole("treeitem", { name: /Body outlet/ });

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

  it("toggles a component's compact internal HTML control without selecting the component", async () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();
    const onToggleInternals = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="slot:card.one:body"
        showInternals={false}
        onHover={onHover}
        onSelect={onSelect}
        onToggleInternals={onToggleInternals}
      />,
    );

    expect(screen.queryByText("Internal HTML")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Expand Card internal HTML (4 nodes)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("4");
    expect(toggle.className).not.toMatch(/(?:^|:)border(?:-|\s|$)/);

    fireEvent.focus(toggle);
    expect(onHover).toHaveBeenLastCalledWith({ kind: "component", id: "card.one" });
    fireEvent.blur(toggle);
    expect(onHover).toHaveBeenLastCalledWith(undefined);

    await userEvent.click(toggle);

    expect(onToggleInternals).toHaveBeenCalledOnce();
    expect(onToggleInternals).toHaveBeenCalledWith("card.one");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders balanced HTML tags and keeps a nested slot visually inside its host element", () => {
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={expandedRows}
        selectedId="slot:card.one:body"
        showInternals
        onSelect={vi.fn()}
        onToggleInternals={vi.fn()}
      />,
    );

    const openingTag = screen.getByText("<div>").closest("button");
    const slot = screen.getByRole("treeitem", { name: /Body slot/ });
    const closingTag = screen.getByText("</div>").closest("div");

    expect(openingTag).toHaveAttribute("data-html-boundary", "open");
    expect(openingTag).toHaveStyle({ paddingLeft: "28px" });
    expect(slot).toHaveStyle({ paddingLeft: "46px" });
    expect(closingTag).toHaveAttribute("data-html-boundary", "close");
    expect(closingTag).toHaveStyle({ paddingLeft: "30px" });
  });

  it("reports a row hover without changing the current selection", async () => {
    const onHover = vi.fn();
    const onSelect = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="card.one"
        showInternals={false}
        onHover={onHover}
        onSelect={onSelect}
        onToggleInternals={vi.fn()}
      />,
    );

    const slot = screen.getByRole("treeitem", { name: /Body slot/ });
    await userEvent.hover(slot);
    expect(onHover).toHaveBeenLastCalledWith({
      kind: "slot",
      id: "slot:card.one:body",
      componentInstanceId: "card.one",
      slotId: "body",
    });
    expect(onSelect).not.toHaveBeenCalled();

    await userEvent.unhover(slot);
    expect(onHover).toHaveBeenLastCalledWith(undefined);
  });

  it("opens row actions from right-click and the keyboard context-menu shortcut", () => {
    const onContextMenuRequest = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="card.one"
        showInternals={false}
        onContextMenuRequest={onContextMenuRequest}
        onSelect={vi.fn()}
        onToggleInternals={vi.fn()}
      />,
    );
    const slot = screen.getByRole("treeitem", { name: /Body slot/ });
    fireEvent.contextMenu(slot, { clientX: 120, clientY: 80 });
    expect(onContextMenuRequest).toHaveBeenLastCalledWith({
      kind: "slot",
      id: "slot:card.one:body",
      componentInstanceId: "card.one",
      slotId: "body",
    }, { x: 120, y: 80 });

    fireEvent.keyDown(slot, { key: "F10", shiftKey: true });
    expect(onContextMenuRequest).toHaveBeenCalledTimes(2);
  });

  it("exposes a keyboard-navigable hierarchy", () => {
    const onToggleInternals = vi.fn();
    render(
      <ComponentTree
        pageLabel="Dashboard"
        rows={rows}
        selectedId="card.one"
        showInternals={false}
        onSelect={vi.fn()}
        onToggleInternals={onToggleInternals}
      />,
    );
    const tree = screen.getByRole("tree", { name: "Component tree" });
    const card = screen.getByRole("treeitem", { name: "Card" });
    const body = screen.getByRole("treeitem", { name: /Body slot/ });

    expect(card).toHaveAttribute("aria-level", "2");
    expect(body).toHaveAttribute("aria-level", "3");
    card.focus();
    fireEvent.keyDown(card, { key: "ArrowDown" });
    expect(body).toHaveFocus();
    card.focus();
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(onToggleInternals).toHaveBeenCalledWith("card.one");
    expect(tree).toContainElement(card);
  });
});

const rows: readonly ComponentTreeRow[] = [
  {
    kind: "component",
    depth: 0,
    label: "Card",
    selection: { kind: "component", id: "card.one" },
    internalHtml: { nodeCount: 4, collapsed: true },
  },
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

const expandedRows: readonly ComponentTreeRow[] = [
  {
    kind: "component",
    depth: 0,
    label: "Card",
    selection: { kind: "component", id: "card.one" },
    internalHtml: { nodeCount: 1, collapsed: false },
  },
  {
    kind: "html",
    depth: 1,
    label: "div",
    selfClosing: false,
    selection: { kind: "html", id: "html:card.one:surface", componentInstanceId: "card.one", nodeId: "surface" },
  },
  {
    kind: "slot",
    depth: 2,
    label: "Body",
    occupied: true,
    childCount: 1,
    selection: { kind: "slot", id: "slot:card.one:body", componentInstanceId: "card.one", slotId: "body" },
  },
  { kind: "html-close", depth: 1, label: "div", id: "html:card.one:surface" },
];

const violations: readonly StrictUiViolation[] = [
  { ruleId: "property.required", severity: "error", message: "Title is required.", location: { kind: "instance", instanceId: "card.one" } },
  { ruleId: "property.token", severity: "warning", message: "Use a token.", location: { kind: "control", instanceId: "card.one", controlId: "tone" } },
  { ruleId: "slot.maximum", severity: "warning", message: "Body has too many items.", location: { kind: "slot", instanceId: "card.one", slotId: "body" } },
  { ruleId: "outlet.missing", severity: "error", message: "Body needs one outlet.", location: { kind: "slot-outlet", slotId: "body" } },
];
