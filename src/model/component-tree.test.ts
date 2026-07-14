import { describe, expect, it } from "vitest";
import { AdapterContractError, createAdapterCatalog, validateComponentInstance } from "./adapter-validation";
import { buildComponentTree, projectPreviewSlots } from "./component-tree";
import type { ComponentInstance } from "./contracts";

const catalog = createAdapterCatalog([
  {
    id: "card",
    label: "Card",
    slots: [
      { id: "header", label: "Header", maximum: 1 },
      { id: "body", label: "Body" },
      { id: "footer", label: "Footer", maximum: 1 },
    ],
    internalHtml: [
      { kind: "html", id: "card.outer", tagName: "div", children: [
        { kind: "html", id: "card.surface", tagName: "section" },
      ] },
    ],
  },
  { id: "heading", label: "Heading", slots: [] },
]);

function card(): ComponentInstance {
  return {
    instanceId: "instance-card",
    componentId: "card",
    slots: [
      {
        slotId: "header",
        children: [{ kind: "component", instance: {
          instanceId: "instance-heading",
          componentId: "heading",
          slots: [],
        } }],
      },
      { slotId: "body", children: [{ kind: "text", id: "copy", value: "Hello" }] },
    ],
  };
}

describe("component adapter contracts", () => {
  it("requires every direct child to belong to a declared slot", () => {
    const invalid = { ...card(), slots: [...card().slots, { slotId: "actions", children: [] }] };
    expect(() => validateComponentInstance(catalog, invalid)).toThrowError(AdapterContractError);
    expect(() => validateComponentInstance(catalog, invalid)).toThrow("does not declare slot actions");
  });

  it("rejects children on components which declare no slots", () => {
    const invalid: ComponentInstance = {
      instanceId: "heading",
      componentId: "heading",
      slots: [{ slotId: "children", children: [{ kind: "text", id: "x", value: "No" }] }],
    };
    expect(() => validateComponentInstance(catalog, invalid)).toThrow("does not declare slot children");
  });

  it("enforces slot cardinality and accepted component kinds", () => {
    const restricted = createAdapterCatalog([
      { id: "toolbar", label: "Toolbar", slots: [{ id: "action", label: "Action", maximum: 1, accepts: ["button"] }] },
      { id: "button", label: "Button", slots: [] },
      { id: "heading", label: "Heading", slots: [] },
    ]);
    const twoChildren: ComponentInstance = {
      instanceId: "toolbar",
      componentId: "toolbar",
      slots: [{ slotId: "action", children: [
        { kind: "component", instance: { instanceId: "b1", componentId: "button", slots: [] } },
        { kind: "component", instance: { instanceId: "b2", componentId: "button", slots: [] } },
      ] }],
    };
    expect(() => validateComponentInstance(restricted, twoChildren)).toThrow("allows 1 children");

    const rejected: ComponentInstance = {
      ...twoChildren,
      slots: [{ slotId: "action", children: [
        { kind: "component", instance: { instanceId: "h", componentId: "heading", slots: [] } },
      ] }],
    };
    expect(() => validateComponentInstance(restricted, rejected)).toThrow("is not accepted");
  });
});

describe("component tree", () => {
  it("shows every declared slot and its occupied or empty state", () => {
    const slots = buildComponentTree(catalog, card()).filter((row) => row.kind === "slot");
    expect(slots.map((slot) => [slot.label, slot.occupied, slot.childCount])).toEqual([
      ["Header", true, 1],
      ["Body", true, 1],
      ["Footer", false, 0],
    ]);
  });

  it("uses the same stable slot selection IDs in tree and preview", () => {
    const treeSlots = buildComponentTree(catalog, card()).filter((row) => row.kind === "slot");
    const previewSlots = projectPreviewSlots(catalog, card());
    expect(treeSlots.map((row) => row.selection.id)).toEqual(previewSlots.map((slot) => slot.selection.id));
  });

  it("collapses internal HTML by default and can reveal the complete internal tree", () => {
    const collapsed = buildComponentTree(catalog, card());
    expect(collapsed.filter((row) => row.kind === "html")).toHaveLength(0);
    expect(collapsed.find((row) => row.kind === "internals-summary")).toMatchObject({
      nodeCount: 2,
      collapsed: true,
    });

    const expanded = buildComponentTree(catalog, card(), {
      revealInternalHtml: new Set(["instance-card"]),
    });
    expect(expanded.filter((row) => row.kind === "html").map((row) => row.label)).toEqual(["div", "section"]);
    expect(expanded.filter((row) => row.kind === "html").map((row) => row.selection)).toMatchObject([
      { id: "html:instance-card:card.outer", componentInstanceId: "instance-card", nodeId: "card.outer" },
      { id: "html:instance-card:card.surface", componentInstanceId: "instance-card", nodeId: "card.surface" },
    ]);
    expect(expanded.find((row) => row.kind === "internals-summary")).toMatchObject({ collapsed: false });
  });

  it("can project declared slots while an authored instance still uses a removed slot", () => {
    const staleInstance: ComponentInstance = {
      ...card(),
      slots: [{ slotId: "removed", children: [{ kind: "text", id: "copy", value: "Draft" }] }],
    };

    expect(() => buildComponentTree(catalog, staleInstance)).toThrow("does not declare slot removed");
    expect(() => projectPreviewSlots(catalog, staleInstance)).toThrow("does not declare slot removed");

    const options = { contractValidation: "tolerant" as const };
    expect(buildComponentTree(catalog, staleInstance, options).filter((row) => row.kind === "slot"))
      .toMatchObject([
        { label: "Header", occupied: false, childCount: 0 },
        { label: "Body", occupied: false, childCount: 0 },
        { label: "Footer", occupied: false, childCount: 0 },
      ]);
    expect(projectPreviewSlots(catalog, staleInstance, options)).toMatchObject([
      { label: "Header", occupied: false, childCount: 0 },
      { label: "Body", occupied: false, childCount: 0 },
      { label: "Footer", occupied: false, childCount: 0 },
    ]);
  });
});
