import { expect, it } from "vitest";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import { sourceSlotNavigationTarget, sourceSlotSelection } from "./source-slot-navigation";

it("opens the child component represented by an implicit design slot", () => {
  const usageLayer = layer("workspace-shell", "WorkspaceShell", "component");
  const child = occurrence("shell", { usageLayer });
  const graph = focusGraph(child);
  const slot = { ...layer("app:design-slot:content", "content", "slot"), children: [usageLayer] };

  expect(sourceSlotNavigationTarget(graph, "app", slot)?.id).toBe("shell");
});

it("opens the composed child assigned to an authored slot", () => {
  const usageSlot = layer("usage-content", "content", "slot");
  const child = occurrence("workspace", { usageSlot });
  const graph = focusGraph(child);
  const slot = layer("definition-content", "content", "slot");

  expect(sourceSlotNavigationTarget(graph, "app", slot)?.id).toBe("workspace");
});

it("keeps a synthetic slot selected on its current component", () => {
  const focus = occurrence("app");
  const slot = layer("app:design-slot:content", "content", "slot");

  expect(sourceSlotSelection(focus, slot, "desktop")).toMatchObject({
    nodeId: "app",
    occurrenceId: "app",
    layerId: slot.id,
    slotName: "content",
    kind: "slot",
  });
});

function focusGraph(child: SourceOccurrence): SourceFocusGraph {
  const focus = occurrence("app", { children: [child.id] });
  return { roots: [focus.id], occurrences: new Map([[focus.id, focus], [child.id, child]]) };
}

function occurrence(
  id: string,
  options: Partial<Pick<SourceOccurrence, "children" | "usageLayer" | "usageSlot">> = {},
): SourceOccurrence {
  return {
    id,
    node: {
      id,
      label: id,
      area: "components",
      entries: [],
      uses: [],
      implementations: {
        desktop: { requestedDevice: "desktop", sourceDevice: "desktop", state: "direct" },
        tablet: { requestedDevice: "tablet", sourceDevice: "tablet", state: "direct" },
        mobile: { requestedDevice: "mobile", sourceDevice: "mobile", state: "direct" },
      },
    },
    children: options.children ?? [],
    usageLayer: options.usageLayer,
    usageSlot: options.usageSlot,
  };
}

function layer(id: string, label: string, kind: SourceWorkspaceLayer["kind"]): SourceWorkspaceLayer {
  return { id, label, kind, source: { start: 0, end: 1 }, children: [] };
}
