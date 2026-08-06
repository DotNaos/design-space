import type { DesignSpaceDevice, SourceWorkspaceTarget } from "../../shared/source-workspace";
import { initialFocusOccurrence, sourceFocusGraph } from "./source-focus-tree";
import { sourceTargetRootNodeId, type SourceTreeNode } from "./source-workspace-tree";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export interface SourceDeviceTransition {
  entryId?: string;
  focusId?: string;
  selection: SourceWorkspaceSelection;
}

export function sourceTargetScopedInteractionReset() {
  return {
    codeAnnotations: [] as const,
    codeContexts: [] as const,
    hoveredSelection: undefined,
    layerMetrics: undefined,
    canvasRevealRequest: undefined,
  } as const;
}

export function sourceDeviceTransition(
  nodes: readonly SourceTreeNode[],
  target: SourceWorkspaceTarget | undefined,
  device: DesignSpaceDevice,
  preferredNodeId?: string,
): SourceDeviceTransition | undefined {
  if (target && !target.devices.some((candidate) => candidate.id === device)) return undefined;
  const rootNodeId = sourceTargetRootNodeId(nodes, target, device);
  const preferredNode = nodes.find((node) => (
    node.id === preferredNodeId && node.implementations[device].entry !== undefined
  ));
  const node = preferredNode ?? nodes.find((candidate) => candidate.id === rootNodeId);
  if (!node) return undefined;
  const graph = sourceFocusGraph(nodes, device, rootNodeId ? [rootNodeId] : undefined);
  const occurrence = [...graph.occurrences.values()].find((candidate) => candidate.node.id === node.id)
    ?? graph.occurrences.get(graph.roots[0] ?? initialFocusOccurrence(graph) ?? "");
  return {
    entryId: occurrence?.entry?.id ?? node.implementations[device].entry?.id,
    focusId: occurrence?.id,
    selection: {
      nodeId: occurrence?.node.id ?? node.id,
      sourceNodeId: occurrence?.node.id ?? node.id,
      device,
      ...(occurrence ? { occurrenceId: occurrence.id } : {}),
      kind: "component",
    },
  };
}
