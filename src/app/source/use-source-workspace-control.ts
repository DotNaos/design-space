import { useEffect } from "react";

import {
  DESIGN_SPACE_CONTROL_EVENT,
  parseWorkspaceComponentControlCommand,
} from "../../shared/workspace-control";
import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";

export function useSourceWorkspaceControl(onIsolate: (name: string) => void): void {
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const receive = (value: unknown) => {
      const command = parseWorkspaceComponentControlCommand(value);
      if (!command || window.top !== window) return;
      onIsolate(command.name);
    };
    hot.on(DESIGN_SPACE_CONTROL_EVENT, receive);
    return () => hot.off?.(DESIGN_SPACE_CONTROL_EVENT, receive);
  }, [onIsolate]);
}

export function findSourceComponentOccurrence(
  graph: SourceFocusGraph,
  name: string,
): SourceOccurrence | undefined {
  const occurrences = [...graph.occurrences.values()];
  return occurrences.find((occurrence) => occurrence.node.label === name)
    ?? occurrences.find((occurrence) => occurrence.entry?.exportName === name)
    ?? occurrences.find((occurrence) => occurrence.node.label.toLocaleLowerCase() === name.toLocaleLowerCase());
}

export function sourceComponentSelection(occurrence: SourceOccurrence, device: DesignSpaceDevice) {
  return {
    nodeId: occurrence.node.id,
    sourceNodeId: occurrence.node.id,
    device,
    occurrenceId: occurrence.id,
    kind: "component" as const,
  };
}
