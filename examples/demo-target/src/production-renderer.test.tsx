import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  renderProductionDocument,
  type ProductionComponentDocument,
  type ProductionScreenDocument,
} from "./production-renderer";

afterEach(cleanup);

describe("target-owned production renderer", () => {
  it("resolves a nested authored component with its own property bindings", () => {
    const label: ProductionComponentDocument = {
      id: "component.label",
      component: {
        id: "label",
        properties: [{ id: "property.label.text", prop: "text", defaultValue: "Default label" }],
      },
      root: {
        instanceId: "label.heading",
        adapterId: "heading",
        propertyBindings: { children: "property.label.text" },
        slots: {},
      },
    };
    const panel: ProductionComponentDocument = {
      id: "component.panel",
      component: {
        id: "panel",
        properties: [{ id: "property.panel.label", prop: "label" }],
      },
      root: {
        instanceId: "panel.stack",
        adapterId: "stack",
        slots: {
          content: [{
            kind: "component",
            node: {
              instanceId: "panel.label",
              adapterId: "label",
              propertyBindings: { text: "property.panel.label" },
              slots: {},
            },
          }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.home",
      root: {
        instanceId: "home.panel",
        adapterId: "panel",
        props: { label: "Nested authored component" },
        slots: {},
      },
    };

    render(<>{renderProductionDocument(screenDocument, [panel, label])}</>);

    expect(screen.getByRole("heading", { name: "Nested authored component" })).toBeVisible();
  });

  it("forwards a screen slot through nested authored components", () => {
    const inner: ProductionComponentDocument = {
      id: "component.inner",
      component: {
        id: "inner",
        properties: [],
      },
      root: {
        instanceId: "inner.stack",
        adapterId: "stack",
        slots: {
          content: [{ kind: "slot-outlet", id: "inner.content.outlet", slotId: "content" }],
        },
      },
    };
    const outer: ProductionComponentDocument = {
      id: "component.outer",
      component: {
        id: "outer",
        properties: [],
      },
      root: {
        instanceId: "outer.inner",
        adapterId: "inner",
        slots: {
          content: [{ kind: "slot-outlet", id: "outer.content.outlet", slotId: "content" }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.forwarded-slot",
      root: {
        instanceId: "screen.outer",
        adapterId: "outer",
        slots: {
          content: [{ kind: "text", id: "screen.forwarded-text", value: "Forwarded through both layers" }],
        },
      },
    };

    render(<>{renderProductionDocument(screenDocument, [outer, inner])}</>);

    expect(screen.getByText("Forwarded through both layers")).toBeVisible();
  });

  it("keeps authored expansion layout-transparent and loose text box-free", () => {
    const surface: ProductionComponentDocument = {
      id: "component.surface",
      component: { id: "surface", properties: [] },
      root: {
        instanceId: "surface.stack",
        adapterId: "stack",
        slots: {
          content: [{ kind: "slot-outlet", id: "surface.content.outlet", slotId: "content" }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.surface",
      root: {
        instanceId: "surface.instance",
        adapterId: "surface",
        slots: {
          content: [{ kind: "text", id: "surface.copy", value: "Loose production text" }],
        },
      },
    };

    const { container } = render(<>{renderProductionDocument(screenDocument, [surface])}</>);

    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container.firstElementChild).toHaveAttribute("data-production-component", "component.surface");
    expect(container.firstElementChild).toHaveAttribute("data-production-instance", "surface.instance");
    expect(screen.getByText("Loose production text")).toHaveStyle({ display: "contents" });
  });

  it("allows a finite instance of a component inside its own projected slot", () => {
    const slotContainer: ProductionComponentDocument = {
      id: "component.slot-container",
      component: { id: "slot-container", properties: [] },
      root: {
        instanceId: "slot-container.stack",
        adapterId: "stack",
        slots: {
          content: [{ kind: "slot-outlet", id: "slot-container.outlet", slotId: "content" }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.finite-recursion",
      root: {
        instanceId: "slot-container.outer",
        adapterId: "slot-container",
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "slot-container.inner", adapterId: "slot-container", slots: { content: [] } },
          }],
        },
      },
    };

    const { container } = render(<>{renderProductionDocument(screenDocument, [slotContainer])}</>);

    expect(container.querySelector('[data-production-instance="slot-container.outer"]')).toBeInTheDocument();
    expect(container.querySelector('[data-production-instance="slot-container.inner"]')).toBeInTheDocument();
  });

  it("still rejects a genuine authored definition cycle", () => {
    const forwarder: ProductionComponentDocument = {
      id: "component.forwarder",
      component: { id: "forwarder", properties: [] },
      root: {
        instanceId: "forwarder.stack",
        adapterId: "stack",
        slots: { content: [{ kind: "slot-outlet", id: "forwarder.outlet", slotId: "content" }] },
      },
    };
    const recursive: ProductionComponentDocument = {
      id: "component.recursive",
      component: { id: "recursive", properties: [] },
      root: {
        instanceId: "recursive.forwarder",
        adapterId: "forwarder",
        slots: {
          content: [{
            kind: "component",
            node: { instanceId: "recursive.again", adapterId: "recursive", slots: {} },
          }],
        },
      },
    };
    const screenDocument: ProductionScreenDocument = {
      id: "screen.recursive",
      root: { instanceId: "recursive.instance", adapterId: "recursive", slots: {} },
    };

    expect(() => renderProductionDocument(screenDocument, [recursive, forwarder]))
      .toThrow("Recursive production component: recursive -> recursive");
  });

  it("preserves explicit empty classes instead of restoring adapter defaults", () => {
    const screenDocument: ProductionScreenDocument = {
      id: "screen.unstyled-card",
      root: {
        instanceId: "unstyled.card",
        adapterId: "card",
        props: { className: "" },
        slots: { header: [], body: [], footer: [] },
      },
    };

    const { container } = render(<>{renderProductionDocument(screenDocument, [])}</>);

    expect(container.querySelector("article")?.className).not.toContain("rounded-3xl");
  });

  it("preserves an explicitly null class as unstyled", () => {
    const screenDocument: ProductionScreenDocument = {
      id: "screen.null-class",
      root: {
        instanceId: "null.card",
        adapterId: "card",
        props: { className: null },
        slots: { header: [], body: [], footer: [] },
      },
    };

    const { container } = render(<>{renderProductionDocument(screenDocument, [])}</>);

    expect(container.querySelector("article")).not.toHaveClass("rounded-3xl", "bg-zinc-950");
  });

  it("uses target adapter classes when a saved node omits className", () => {
    const screenDocument: ProductionScreenDocument = {
      id: "screen.defaults",
      root: {
        instanceId: "defaults.stack",
        adapterId: "stack",
        slots: {
          content: [
            { kind: "component", node: { instanceId: "defaults.button", adapterId: "button", slots: {} } },
            { kind: "component", node: { instanceId: "defaults.input", adapterId: "input", slots: {} } },
          ],
        },
      },
    };

    render(<>{renderProductionDocument(screenDocument, [])}</>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("rounded-lg", "bg-indigo-500");
    expect(screen.getByPlaceholderText("Project name")).toHaveClass("rounded-lg", "border", "bg-black/20");
  });
});
