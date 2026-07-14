import { describe, expect, it } from "vitest";

import type { DesignDocument } from "../../shared/design-document";
import {
  addComponentSlot,
  bindComponentProperty,
  clearDesignSlot,
  duplicateDesignComponent,
  insertDesignChild,
  moveDesignComponent,
  removeDesignComponent,
  removeDesignSlotOutlet,
  removeComponentProperty,
  updateComponentSlot,
  updateDocumentLabel,
  updateDesignProps,
} from "./document-commands";

const screen: DesignDocument = {
  schemaVersion: 2,
  id: "screen.main",
  label: "Main",
  kind: "screen",
  root: {
    instanceId: "root",
    adapterId: "stack",
    slots: {
      content: [
        { kind: "component", node: { instanceId: "first", adapterId: "text", props: { children: "One" }, slots: {} } },
        { kind: "component", node: { instanceId: "second", adapterId: "text", props: { children: "Two" }, slots: {} } },
      ],
    },
  },
};

describe("design document commands", () => {
  it("edits, inserts, moves, duplicates, and removes without mutating the base", () => {
    const edited = updateDesignProps(screen, "first", { children: "Changed" });
    expect(screen.root.slots.content[0]).toMatchObject({ node: { props: { children: "One" } } });
    expect(edited.root.slots.content[0]).toMatchObject({ node: { props: { children: "Changed" } } });

    const inserted = insertDesignChild(edited, "root", "content", { kind: "text", id: "copy", value: "Tail" });
    expect(inserted.root.slots.content).toHaveLength(3);
    expect(moveDesignComponent(inserted, "second", -1).root.slots.content[0]).toMatchObject({ node: { instanceId: "second" } });

    let sequence = 0;
    const duplicate = duplicateDesignComponent(inserted, "first", () => `copy-${++sequence}`);
    expect(duplicate.duplicateId).toBe("copy-1");
    expect(removeDesignComponent(duplicate.document, duplicate.duplicateId).root.slots.content).toHaveLength(3);
  });

  it("creates explicit slot outlets in component definitions", () => {
    const component: DesignDocument = {
      schemaVersion: 2,
      id: "component.panel",
      label: "Panel",
      kind: "component",
      component: { id: "panel", label: "Panel", group: "Surfaces", properties: [], slots: [] },
      root: { instanceId: "panel.root", adapterId: "stack", slots: { content: [] } },
    };
    const next = addComponentSlot(component, { id: "body", label: "Body" }, "panel.root", "content", () => "outlet.body");
    expect(next.component?.slots).toEqual([{ id: "body", label: "Body" }]);
    expect(next.root.slots.content).toEqual([{ kind: "slot-outlet", id: "outlet.body", slotId: "body" }]);
  });

  it("clears only the selected slot and removes a selected outlet by stable ID", () => {
    const cleared = clearDesignSlot(screen, "root", "content");
    expect(cleared.root.slots.content).toEqual([]);
    expect(screen.root.slots.content).toHaveLength(2);

    const component = addComponentSlot(
      componentDocument(),
      { id: "body", label: "Body" },
      "panel.root",
      "content",
      () => "outlet.body",
    );
    expect(removeDesignSlotOutlet(component, "outlet.body").root.slots.content).toEqual([]);
    expect(() => removeDesignSlotOutlet(component, "missing.outlet")).toThrow("was not found");
  });

  it("replaces complete slot contracts so omitted constraints stay cleared", () => {
    const component = componentDocument();
    component.component!.slots = [{
      id: "body",
      label: "Body",
      max: 2,
      accepts: ["catalog.heading"],
      acceptsText: true,
    }];

    const next = updateComponentSlot(component, "body", (slot) => ({
      id: slot.id,
      label: slot.label,
      acceptsText: slot.acceptsText,
    }));

    expect(next.component?.slots[0]).toEqual({ id: "body", label: "Body", acceptsText: true });
    expect(component.component?.slots[0]).toMatchObject({ max: 2, accepts: ["catalog.heading"] });
    expect(() => updateComponentSlot(component, "body", (slot) => ({ ...slot, id: "renamed" })))
      .toThrow("A component slot ID cannot be changed.");
  });

  it("renames screens and keeps component document labels synchronized", () => {
    expect(updateDocumentLabel(screen, "Settings").label).toBe("Settings");
    const component = componentDocument();
    expect(updateDocumentLabel(component, "Renamed panel")).toMatchObject({
      label: "Renamed panel",
      component: { label: "Renamed panel" },
    });
  });

  it("binds a public property to exactly one implementation property", () => {
    const component: DesignDocument = {
      schemaVersion: 2,
      id: "component.hero",
      label: "Hero",
      kind: "component",
      component: {
        id: "hero",
        label: "Hero",
        group: "Custom",
        properties: [{ id: "title", label: "Title", prop: "title", kind: "text" }],
        slots: [],
      },
      root: {
        instanceId: "hero.root",
        adapterId: "stack",
        slots: { content: [{ kind: "component", node: { instanceId: "hero.heading", adapterId: "text", slots: {} } }] },
      },
    };

    const bound = bindComponentProperty(component, "title", { instanceId: "hero.heading", prop: "children" });
    expect(findBoundNode(bound.root, "hero.heading").propertyBindings).toEqual({ children: "title" });
    const rebound = bindComponentProperty(bound, "title", { instanceId: "hero.root", prop: "className" });
    expect(findBoundNode(rebound.root, "hero.heading").propertyBindings).toBeUndefined();
    expect(rebound.root.propertyBindings).toEqual({ className: "title" });
    expect(removeComponentProperty(rebound, "title").root.propertyBindings).toBeUndefined();
  });
});

function componentDocument(): DesignDocument {
  return {
    schemaVersion: 2,
    id: "component.panel",
    label: "Panel",
    kind: "component",
    component: { id: "panel", label: "Panel", group: "Surfaces", properties: [], slots: [] },
    root: { instanceId: "panel.root", adapterId: "stack", slots: { content: [] } },
  };
}

function findBoundNode(root: DesignDocument["root"], instanceId: string): DesignDocument["root"] {
  const found = maybeFindBoundNode(root, instanceId);
  if (found) return found;
  throw new Error(`Missing ${instanceId}`);
}

function maybeFindBoundNode(
  root: DesignDocument["root"],
  instanceId: string,
): DesignDocument["root"] | undefined {
  if (root.instanceId === instanceId) return root;
  for (const children of Object.values(root.slots)) {
    for (const child of children) {
      if (child.kind === "component") {
        const found = maybeFindBoundNode(child.node, instanceId);
        if (found) return found;
      }
    }
  }
  return undefined;
}
