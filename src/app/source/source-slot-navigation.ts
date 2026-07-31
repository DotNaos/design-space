import type { DesignSpaceDevice, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export function sourceSlotSelection(
  focus: SourceOccurrence,
  slot: SourceWorkspaceLayer,
  device: DesignSpaceDevice,
): SourceWorkspaceSelection {
  return {
    nodeId: focus.node.id,
    sourceNodeId: focus.node.id,
    device,
    occurrenceId: focus.id,
    layerId: slot.id,
    slotName: slot.label,
    kind: "slot",
  };
}

export function sourceSlotNavigationTarget(
  graph: SourceFocusGraph,
  focusOccurrenceId: string | undefined,
  slot: SourceWorkspaceLayer | undefined,
): SourceOccurrence | undefined {
  if (!focusOccurrenceId || !slot) return undefined;
  const focus = graph.occurrences.get(focusOccurrenceId);
  if (!focus) return undefined;
  const componentLayerIds = new Set(
    slot.children.filter((child) => child.kind === "component").map((child) => child.id),
  );
  return focus.children.flatMap((id) => {
    const child = graph.occurrences.get(id);
    return child ? [child] : [];
  }).find((child) => (
    Boolean(child.usageLayer && componentLayerIds.has(child.usageLayer.id))
    || child.usageSlot?.label === slot.label
  ));
}
