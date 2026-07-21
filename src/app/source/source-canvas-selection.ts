import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";
import { findSourceTreeLayer } from "./source-workspace-tree";
import { sourceOccurrenceSubtree, type SourceFocusGraph } from "./source-focus-tree";

export function sourceCanvasSelection(
  graph: SourceFocusGraph,
  canvasOccurrenceId: string | undefined,
  layerId: string,
  device: DesignSpaceDevice,
): SourceWorkspaceSelection | undefined {
  for (const occurrenceId of sourceOccurrenceSubtree(graph, canvasOccurrenceId)) {
    const occurrence = graph.occurrences.get(occurrenceId);
    if (!occurrence) continue;
    if (occurrence.usageLayer?.id === layerId) {
      return {
        nodeId: occurrence.node.id,
        sourceNodeId: occurrence.usageOwnerId ?? occurrence.node.id,
        device,
        occurrenceId,
        layerId,
        kind: "component",
      };
    }
    const usageLayer = findSourceTreeLayer(occurrence.usageLayer ? [occurrence.usageLayer] : undefined, layerId);
    const localLayer = findSourceTreeLayer(occurrence.entry?.layers, layerId);
    const layer = usageLayer ?? localLayer;
    if (!layer) continue;
    return {
      nodeId: occurrence.node.id,
      sourceNodeId: usageLayer ? occurrence.usageOwnerId ?? occurrence.node.id : occurrence.node.id,
      device,
      occurrenceId,
      layerId,
      ...(layer.kind === "slot" ? { slotName: layer.label } : {}),
      kind: layer.kind,
    };
  }
  return undefined;
}
