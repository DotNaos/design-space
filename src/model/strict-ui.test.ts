import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../shared/design-document";
import type { TargetModule } from "../shared/target-module";
import { validateStrictUi } from "./strict-ui";

const target: TargetModule = {
  project: { id: "demo", label: "Demo" },
  defaultAdapterId: "card",
  defaultFixture: { instanceId: "card.one", adapterId: "card", slots: { body: [] } },
  files: [],
  adapters: [
    {
      component: {
        id: "card",
        label: "Card",
        group: "Surfaces",
        slots: [{ id: "body", label: "Body", min: 1, max: 1, accepts: ["text"] }],
      },
      controls: [{ id: "title", label: "Title", kind: "text", prop: "title", required: true }],
      render: () => null,
    },
    {
      component: { id: "text", label: "Text", group: "Content", slots: [] },
      controls: [{ id: "content", label: "Content", kind: "text", prop: "children" }],
      render: () => null,
    },
    { component: { id: "button", label: "Button", group: "Actions", slots: [] }, render: () => null },
  ],
};

function document(root: DesignDocument["root"]): DesignDocument {
  return { schemaVersion: 2, id: "screen.dashboard", label: "Dashboard", kind: "screen", root };
}

describe("core Strict UI validation", () => {
  it("reports missing required properties and required slot content", () => {
    const violations = validateStrictUi(target, document({ instanceId: "card.one", adapterId: "card", slots: { body: [] } }));
    expect(violations.map((violation) => violation.ruleId)).toEqual(["property.required", "slot.minimum"]);
  });

  it("does not replace an explicit null with a required control default", () => {
    const targetWithDefault: TargetModule = {
      ...target,
      adapters: target.adapters.map((adapter) => adapter.component.id === "card"
        ? { ...adapter, defaultProps: { title: "Default title" } }
        : adapter),
    };
    const violations = validateStrictUi(targetWithDefault, document({
      instanceId: "card.one",
      adapterId: "card",
      props: { title: null },
      slots: { body: [{ kind: "component", node: { instanceId: "text.one", adapterId: "text", slots: {} } }] },
    }));

    expect(violations).toEqual([
      expect.objectContaining({ ruleId: "property.required" }),
    ]);
  });

  it("enforces declared properties and their text and number limits", () => {
    const constrainedTarget: TargetModule = {
      ...target,
      adapters: [{
        component: { id: "metrics", label: "Metrics", group: "Content", slots: [] },
        controls: [
          { id: "label", label: "Label", kind: "text", prop: "label", maxLength: 4 },
          { id: "count", label: "Count", kind: "number", prop: "count", min: 1, max: 3 },
        ],
        render: () => null,
      }],
      defaultAdapterId: "metrics",
      defaultFixture: { instanceId: "metrics.one", adapterId: "metrics", slots: {} },
    };
    const violations = validateStrictUi(constrainedTarget, document({
      instanceId: "metrics.one",
      adapterId: "metrics",
      props: { label: "Too long", count: 4, removed: "stale" },
      slots: {},
    }));

    expect(violations.map((violation) => violation.ruleId)).toEqual([
      "property.undeclared",
      "property.maxLength",
      "property.maximum",
    ]);

    const minimum = validateStrictUi(constrainedTarget, document({
      instanceId: "metrics.one",
      adapterId: "metrics",
      props: { label: "Fine", count: 0 },
      slots: {},
    }));
    expect(minimum).toEqual([expect.objectContaining({ ruleId: "property.minimum" })]);
  });

  it("rejects duplicate ids across component, text, and outlet nodes", () => {
    const duplicateText = validateStrictUi(target, document({
      instanceId: "card.one",
      adapterId: "card",
      props: { title: "Card" },
      slots: {
        body: [
          { kind: "text", id: "copy.same", value: "First" },
          { kind: "text", id: "copy.same", value: "Second" },
        ],
      },
    }));
    expect(duplicateText).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "node.duplicate" }),
    ]));

    const authored: DesignDocument = {
      schemaVersion: 2,
      id: "component.outlets",
      label: "Outlets",
      kind: "component",
      component: { id: "outlets", label: "Outlets", group: "Custom", properties: [], slots: [{ id: "body", label: "Body" }] },
      root: {
        instanceId: "outlets.root",
        adapterId: "card",
        props: { title: "Outlets" },
        slots: {
          body: [
            { kind: "slot-outlet", id: "outlet.same", slotId: "body" },
            { kind: "slot-outlet", id: "outlet.same", slotId: "body" },
          ],
        },
      },
    };
    expect(validateStrictUi(target, authored)).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "node.duplicate" }),
      expect.objectContaining({ ruleId: "outlet.duplicate" }),
    ]));
  });

  it("reports incompatible children and missing explicit empty slots", () => {
    const incompatible = validateStrictUi(target, document({
      instanceId: "card.one",
      adapterId: "card",
      props: { title: "Planning" },
      slots: { body: [{ kind: "component", node: { instanceId: "button.one", adapterId: "button", slots: {} } }] },
    }));
    expect(incompatible).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "slot.child" })]));

    const missing = validateStrictUi(target, document({
      instanceId: "card.one",
      adapterId: "card",
      props: { title: "Planning" },
      slots: {},
    }));
    expect(missing).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: "slot.missing" })]));
  });

  it("requires exactly one outlet for every authored component slot", () => {
    const authored: DesignDocument = {
      schemaVersion: 2,
      id: "component.summary",
      label: "Summary",
      kind: "component",
      component: {
        id: "summary",
        label: "Summary",
        group: "Surfaces",
        properties: [],
        slots: [{ id: "body", label: "Body" }],
      },
      root: { instanceId: "summary.root", adapterId: "text", slots: {} },
    };
    expect(validateStrictUi(target, authored)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "outlet.missing",
        location: { kind: "slot-outlet", slotId: "body" },
      }),
    ]));
  });

  it("validates authored components inserted into screens through their public contracts", () => {
    const panel: DesignDocument = {
      schemaVersion: 2,
      id: "component.panel",
      label: "Panel",
      kind: "component",
      component: {
        id: "panel",
        label: "Panel",
        group: "Surfaces",
        properties: [{ id: "title", kind: "text", label: "Title", prop: "title", required: true }],
        slots: [{ id: "body", label: "Body", accepts: ["text"] }],
      },
      root: { instanceId: "panel.root", adapterId: "text", slots: {} },
    };
    const screen = document({
      instanceId: "panel.one",
      adapterId: "panel",
      props: { title: "Planning" },
      slots: { body: [{ kind: "component", node: { instanceId: "text.one", adapterId: "text", slots: {} } }] },
    });

    expect(validateStrictUi(target, screen, [panel])).toEqual([]);
  });

  it("blocks direct and indirect authored component cycles", () => {
    const component = (id: string, childAdapterId: string): DesignDocument => ({
      schemaVersion: 2,
      id: `component.${id}`,
      label: id,
      kind: "component",
      component: { id, label: id, group: "Custom", properties: [], slots: [] },
      root: { instanceId: `${id}.root`, adapterId: childAdapterId, slots: {} },
    });
    const alpha = component("alpha", "beta");
    const beta = component("beta", "alpha");

    expect(validateStrictUi(target, alpha, [alpha, beta])).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "component.cycle", location: { kind: "document" } }),
    ]));
  });

  it("requires one compatible explicit implementation binding per public property", () => {
    const component = (propertyBindings?: Record<string, string>): DesignDocument => ({
      schemaVersion: 2,
      id: "component.heading",
      label: "Heading",
      kind: "component",
      component: {
        id: "authored-heading",
        label: "Heading",
        group: "Custom",
        properties: [{ id: "title", label: "Title", prop: "title", kind: "text" }],
        slots: [],
      },
      root: { instanceId: "heading.root", adapterId: "text", propertyBindings, slots: {} },
    });

    expect(validateStrictUi(target, component())).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.missing" }),
    ]));
    expect(validateStrictUi(target, component({ children: "title" }))).toEqual([]);
    expect(validateStrictUi(target, component({ unavailable: "title" }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.control" }),
    ]));
    expect(validateStrictUi(target, component({ children: "missing" }))).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "binding.property" }),
      expect.objectContaining({ ruleId: "binding.missing" }),
    ]));
  });
});
