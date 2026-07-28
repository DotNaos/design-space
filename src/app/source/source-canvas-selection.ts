import type { DesignSpaceDevice, SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";
import { findSourceTreeLayer } from "./source-workspace-tree";
import { sourceOccurrenceSubtree, type SourceFocusGraph } from "./source-focus-tree";

export function sourceCanvasSelection(
  graph: SourceFocusGraph,
  canvasOccurrenceId: string | undefined,
  layerId: string,
  device: DesignSpaceDevice,
  occurrenceIndex = 0,
): SourceWorkspaceSelection | undefined {
  const matches = sourceCanvasSelections(graph, canvasOccurrenceId, layerId, device);
  const match = matches[occurrenceIndex] ?? matches[0];
  return match ? { ...match, renderedLayerOccurrence: occurrenceIndex } : undefined;
}

export function sourceCanvasSelectionOccurrence(
  graph: SourceFocusGraph,
  canvasOccurrenceId: string | undefined,
  selection: SourceWorkspaceSelection | undefined,
): number {
  if (!selection?.layerId) return 0;
  if (selection.renderedLayerOccurrence !== undefined) return selection.renderedLayerOccurrence;
  const matches = sourceCanvasSelections(graph, canvasOccurrenceId, selection.layerId, selection.device);
  const index = matches.findIndex((candidate) => (
    candidate.occurrenceId === selection.occurrenceId
    && candidate.kind === selection.kind
  ));
  return Math.max(0, index);
}

export function sourceCanvasSelections(
  graph: SourceFocusGraph,
  canvasOccurrenceId: string | undefined,
  layerId: string,
  device: DesignSpaceDevice,
): readonly SourceWorkspaceSelection[] {
  const matches: SourceWorkspaceSelection[] = [];
  for (const occurrenceId of sourceOccurrenceSubtree(graph, canvasOccurrenceId)) {
    const occurrence = graph.occurrences.get(occurrenceId);
    if (!occurrence) continue;
    if (occurrence.usageLayer?.id === layerId) {
      matches.push({
        nodeId: occurrence.node.id,
        sourceNodeId: occurrence.usageOwnerId ?? occurrence.node.id,
        device,
        occurrenceId,
        layerId,
        kind: "component",
      });
      continue;
    }
    const usageLayer = findSourceTreeLayer(occurrence.usageLayer ? [occurrence.usageLayer] : undefined, layerId);
    const localLayer = findSourceTreeLayer(occurrence.entry?.layers, layerId);
    const layer = usageLayer ?? localLayer;
    if (!layer) continue;
    matches.push({
      nodeId: occurrence.node.id,
      sourceNodeId: usageLayer ? occurrence.usageOwnerId ?? occurrence.node.id : occurrence.node.id,
      device,
      occurrenceId,
      layerId,
      ...(layer.kind === "slot" ? { slotName: layer.label } : {}),
      kind: layer.kind,
    });
  }
  return matches;
}

export function sourceCanvasVisualLayer(
  entry: SourceWorkspaceEntry | undefined,
  selected: SourceWorkspaceLayer | undefined,
): SourceWorkspaceLayer | undefined {
  if (selected) return selected;
  return firstHtmlLayer(entry?.layers) ?? entry?.layers?.[0];
}

function firstHtmlLayer(layers: readonly SourceWorkspaceLayer[] | undefined): SourceWorkspaceLayer | undefined {
  for (const layer of layers ?? []) {
    if (layer.kind === "html") return layer;
    const nested = firstHtmlLayer(layer.children);
    if (nested) return nested;
  }
  return undefined;
}
