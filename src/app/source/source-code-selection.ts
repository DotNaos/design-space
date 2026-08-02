import type {
  DesignSpaceDevice,
  SourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import {
  sourceCompositionRows,
  sourceOccurrenceSubtree,
  type SourceFocusGraph,
} from "./source-focus-tree";
import { sourceCanvasSelections } from "./source-canvas-selection";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export function sourceSelectionAtOffset(options: {
  device: DesignSpaceDevice;
  entry: SourceWorkspaceEntry;
  focusId?: string;
  graph: SourceFocusGraph;
  offset: number;
  selected?: SourceWorkspaceSelection;
}): SourceWorkspaceSelection | undefined {
  const layer = deepestLayerAtOffset(options.entry.layers, options.offset);
  if (layer) {
    const matches = sourceCanvasSelections(
      options.graph,
      options.focusId,
      layer.id,
      options.device,
    );
    const selectedMatch = matches.find((candidate) => (
      candidate.occurrenceId === options.selected?.occurrenceId
    ));
    const owningMatches = matches.filter((candidate) => {
      const occurrenceId = candidate.occurrenceId;
      if (!occurrenceId) return false;
      const occurrence = options.graph.occurrences.get(occurrenceId);
      return occurrence?.entry
        ? containsOffset(occurrence.entry.source, options.offset)
        : false;
    });
    const match = owningMatches.find((candidate) => (
      candidate.occurrenceId === options.selected?.occurrenceId
    )) ?? owningMatches[0] ?? selectedMatch ?? matches[0];
    if (!match) return undefined;
    const matchingRows = sourceCompositionRows(options.graph, options.focusId)
      .filter((row) => (
        row.occurrence?.id === match.occurrenceId
        && row.layer?.id === layer.id
      ));
    const renderedRow = matchingRows.find((row) => (
      row.renderedLayerOccurrence === options.selected?.renderedLayerOccurrence
    )) ?? matchingRows[0];
    return {
      ...match,
      renderedLayerOccurrence: renderedRow?.renderedLayerOccurrence
        ?? match.renderedLayerOccurrence
        ?? 0,
    };
  }

  if (!containsOffset(options.entry.source, options.offset)) return undefined;

  const occurrences = [...sourceOccurrenceSubtree(options.graph, options.focusId)]
    .flatMap((id) => {
      const occurrence = options.graph.occurrences.get(id);
      return occurrence?.entry?.id === options.entry.id ? [occurrence] : [];
    });
  const occurrence = occurrences.find((candidate) => (
    candidate.id === options.selected?.occurrenceId
  )) ?? occurrences[0];
  if (!occurrence) return undefined;
  return {
    nodeId: occurrence.node.id,
    sourceNodeId: occurrence.node.id,
    device: options.device,
    occurrenceId: occurrence.id,
    kind: "component",
  };
}

export function deepestLayerAtOffset(
  layers: readonly SourceWorkspaceLayer[] | undefined,
  offset: number,
): SourceWorkspaceLayer | undefined {
  let match: SourceWorkspaceLayer | undefined;
  for (const layer of layers ?? []) {
    const child = deepestLayerAtOffset(layer.children, offset);
    if (child && (!match || sourceSpan(child) <= sourceSpan(match))) {
      match = child;
    }
    if (
      containsOffset(layer.source, offset)
      && (!match || sourceSpan(layer) <= sourceSpan(match))
    ) {
      match = layer;
    }
  }
  return match;
}

function containsOffset(
  binding: { start: number; end: number },
  offset: number,
): boolean {
  return offset >= binding.start && offset <= binding.end;
}

function sourceSpan(layer: SourceWorkspaceLayer): number {
  return layer.source.end - layer.source.start;
}
