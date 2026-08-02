import { useEffect, useMemo } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import {
  sourceOccurrenceSubtree,
  type SourceFocusGraph,
} from "./source-focus-tree";
import type {
  SourceWorkspaceSelection,
} from "./SourceWorkspaceSidebar";
import type { SourceWorkspaceMode } from "./source-layer-design";

export function useSynchronizedSourceDesignSelection(options: {
  device: DesignSpaceDevice;
  focusId?: string;
  graph: SourceFocusGraph;
  mode: SourceWorkspaceMode;
  selection?: SourceWorkspaceSelection;
  setDesignSelection: (selection: SourceWorkspaceSelection) => void;
  setSelection: (selection: SourceWorkspaceSelection) => void;
}) {
  const focusedOccurrence = options.focusId
    ? options.graph.occurrences.get(options.focusId)
    : undefined;
  const designOccurrenceIds = useMemo(
    () => sourceOccurrenceSubtree(options.graph, options.focusId),
    [options.focusId, options.graph],
  );

  useEffect(() => {
    if (options.mode !== "design" || !focusedOccurrence) return;
    if (
      options.selection?.occurrenceId
      && designOccurrenceIds.has(options.selection.occurrenceId)
    ) return;
    const next: SourceWorkspaceSelection = {
      nodeId: focusedOccurrence.node.id,
      sourceNodeId: focusedOccurrence.node.id,
      device: options.device,
      occurrenceId: focusedOccurrence.id,
      kind: "component",
    };
    options.setSelection(next);
    options.setDesignSelection(next);
  }, [
    designOccurrenceIds,
    focusedOccurrence,
    options.device,
    options.mode,
    options.selection?.occurrenceId,
    options.setDesignSelection,
    options.setSelection,
  ]);

  return focusedOccurrence;
}
