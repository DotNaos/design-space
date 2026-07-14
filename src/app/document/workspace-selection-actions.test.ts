import { describe, expect, it } from "vitest";

import type { SelectionTarget } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import {
  authoredSlotDependencyMessage,
  deleteWorkspaceSelection,
  duplicateWorkspaceSelection,
  removeAuthoredSlotDefinition,
} from "./workspace-selection-actions";

const optionalSlot = () => ({ min: 0 });

describe("workspace selection actions", () => {
  it("deletes a selected component and selects its parent without mutating the source", () => {
    const document = screenDocument();
    const result = deleteWorkspaceSelection({
      document,
      selection: { kind: "component", id: "nested.copy" },
      resolveSlotContract: optionalSlot,
    });

    expect(result.status).toBe("applied");
    expect(result.document.root.slots.content).toHaveLength(1);
    expect(result.selection).toEqual({ kind: "component", id: "panel.one" });
    expect(findNode(document, "panel.one")?.slots.body).toHaveLength(1);
  });

  it("blocks root deletion and duplication while selecting a new duplicate", () => {
    const document = screenDocument();
    const root = { kind: "component", id: "screen.root" } satisfies SelectionTarget;
    expect(deleteWorkspaceSelection({ document, selection: root, resolveSlotContract: optionalSlot })).toMatchObject({
      status: "blocked",
      message: "The root component cannot be removed.",
    });
    expect(duplicateWorkspaceSelection({ document, selection: root, createId: () => "unused", resolveSlotContract: optionalSlot })).toMatchObject({ status: "blocked" });

    const duplicate = duplicateWorkspaceSelection({
      document,
      selection: { kind: "component", id: "nested.copy" },
      createId: () => "nested.copy-2",
      resolveSlotContract: optionalSlot,
    });
    expect(duplicate.status).toBe("applied");
    expect(duplicate.selection).toEqual({ kind: "component", id: "nested.copy-2" });
    expect(findNode(duplicate.document, "panel.one")?.slots.body).toHaveLength(2);
  });

  it("keeps required children and blocks duplicates when the parent slot is full", () => {
    const document = screenDocument();
    const selection = { kind: "component", id: "nested.copy" } satisfies SelectionTarget;
    const resolveSlotContract = () => ({ min: 1, max: 1 });

    const deleted = deleteWorkspaceSelection({ document, selection, resolveSlotContract });
    expect(deleted).toMatchObject({
      status: "blocked",
      message: "This slot requires at least 1 item, so this component cannot be deleted.",
    });
    expect(deleted.document).toBe(document);

    const duplicated = duplicateWorkspaceSelection({
      document,
      selection,
      createId: () => "nested.copy-2",
      resolveSlotContract,
    });
    expect(duplicated).toMatchObject({
      status: "blocked",
      message: "This slot accepts at most 1 item and is already full.",
    });
    expect(duplicated.document).toBe(document);
  });

  it("clears optional slots but preserves required or unresolved slots", () => {
    const document = screenDocument();
    const selection = {
      kind: "slot",
      id: "slot:panel.one:body",
      componentInstanceId: "panel.one",
      slotId: "body",
    } satisfies SelectionTarget;
    const cleared = deleteWorkspaceSelection({ document, selection, resolveSlotContract: optionalSlot });
    expect(cleared.status).toBe("applied");
    expect(findNode(cleared.document, "panel.one")?.slots.body).toEqual([]);

    const required = deleteWorkspaceSelection({
      document,
      selection,
      resolveSlotContract: () => ({ min: 1 }),
    });
    expect(required).toMatchObject({ status: "blocked", message: "This slot requires at least 1 item and cannot be cleared." });
    expect(required.document).toBe(document);

    const unresolved = deleteWorkspaceSelection({ document, selection, resolveSlotContract: () => undefined });
    expect(unresolved).toMatchObject({ status: "blocked", message: expect.stringContaining("contract is unavailable") });
    expect(unresolved.document).toBe(document);
  });

  it("removes only the selected slot outlet and selects its containing component", () => {
    const document = authoredPanel();
    const result = deleteWorkspaceSelection({
      document,
      selection: { kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" },
      resolveSlotContract: optionalSlot,
    });

    expect(result.status).toBe("applied");
    expect(result.selection).toEqual({ kind: "component", id: "panel.root" });
    expect(result.document.root.slots.content).toEqual([]);
    expect(result.document.component?.slots).toEqual([expect.objectContaining({ id: "body" })]);
  });

  it("blocks authored slot-definition removal while another screen or component uses the adapter", () => {
    const authored = authoredPanel();
    const dashboard = screenDocument();
    const wrapper = componentDocument("component.wrapper", "Wrapper", "wrapper", "panel");
    const message = authoredSlotDependencyMessage(authored, [authored, dashboard, wrapper, dashboard], "body");
    expect(message).toBe(
      "Cannot remove the Body slot because 2 other documents use Panel: “Dashboard” and “Wrapper”. Remove those component instances first.",
    );

    const blocked = removeAuthoredSlotDefinition({
      document: authored,
      documents: [authored, dashboard],
      slotId: "body",
      selection: { kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" },
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.document).toBe(authored);
  });

  it("removes an unused authored slot definition and all of its outlets", () => {
    const authored = authoredPanel();
    const result = removeAuthoredSlotDefinition({
      document: authored,
      documents: [authored, componentDocument("component.unrelated", "Unrelated", "unrelated", "text")],
      slotId: "body",
      selection: { kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" },
    });
    expect(result.status).toBe("applied");
    expect(result.document.component?.slots).toEqual([]);
    expect(result.document.root.slots.content).toEqual([]);
    expect(result.selection).toEqual({ kind: "component", id: "panel.root" });
  });
});

function screenDocument(): DesignDocument {
  return {
    schemaVersion: 2,
    id: "screen.dashboard",
    label: "Dashboard",
    kind: "screen",
    root: {
      instanceId: "screen.root",
      adapterId: "stack",
      slots: {
        content: [{
          kind: "component",
          node: {
            instanceId: "panel.one",
            adapterId: "panel",
            slots: {
              body: [{ kind: "component", node: { instanceId: "nested.copy", adapterId: "text", slots: {} } }],
            },
          },
        }],
      },
    },
  };
}

function authoredPanel(): DesignDocument {
  return {
    schemaVersion: 2,
    id: "component.panel",
    label: "Panel",
    kind: "component",
    component: { id: "panel", label: "Panel", group: "Surfaces", properties: [], slots: [{ id: "body", label: "Body" }] },
    root: {
      instanceId: "panel.root",
      adapterId: "stack",
      slots: { content: [{ kind: "slot-outlet", id: "body.outlet", slotId: "body" }] },
    },
  };
}

function componentDocument(id: string, label: string, componentId: string, adapterId: string): DesignDocument {
  return {
    schemaVersion: 2,
    id,
    label,
    kind: "component",
    component: { id: componentId, label, group: "Custom", properties: [], slots: [] },
    root: { instanceId: `${componentId}.root`, adapterId, slots: {} },
  };
}

function findNode(document: DesignDocument, id: string) {
  const visit = (node: DesignDocument["root"]): DesignDocument["root"] | undefined => {
    if (node.instanceId === id) return node;
    for (const child of Object.values(node.slots).flat()) {
      if (child.kind !== "component") continue;
      const found = visit(child.node);
      if (found) return found;
    }
    return undefined;
  };
  return visit(document.root);
}
