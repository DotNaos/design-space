import { useMemo, useState } from "react";
import type { RuntimeSourceWorkspace, SourceWorkspaceTarget } from "../../shared/source-workspace";
import { initialFocusOccurrence, sourceFocusGraph } from "./source-focus-tree";
import {
  initialSourceTreeSelection,
  sourceTargetRootNodeId,
  sourceTreeNodes,
  type SourceTreeNode,
} from "./source-workspace-tree";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";
import { loadSourceWorkspaceUiState, sourceWorkspaceBrowserStorage } from "./source-workspace-ui-state";

export interface SourceTargetSelection {
  focusId?: string;
  selection: SourceWorkspaceSelection;
  target: SourceWorkspaceTarget;
}

export function useSourceTargetDeviceController(
  workspace: RuntimeSourceWorkspace,
  projectId: string,
) {
  const restoredTargetId = useMemo(
    () => loadSourceWorkspaceUiState(sourceWorkspaceBrowserStorage(), projectId).targetId,
    [projectId],
  );
  const targets = workspace.targets ?? [];
  const defaultTarget = targets.find((candidate) => candidate.id === restoredTargetId) ?? targets[0];
  const [targetId, setTargetId] = useState(defaultTarget?.id);
  const target = targets.find((candidate) => candidate.id === targetId) ?? defaultTarget;
  const nodes = useMemo(() => sourceTreeNodes(workspace, target?.id), [target?.id, workspace]);
  const initial = initialSourceTreeSelection(nodes, target);
  const rootNodeId = sourceTargetRootNodeId(nodes, target, initial?.device ?? "desktop");
  const graph = useMemo(
    () => sourceFocusGraph(nodes, initial?.device ?? "desktop", rootNodeId ? [rootNodeId] : undefined),
    [initial?.device, nodes, rootNodeId],
  );
  const focusId = initialFocusOccurrence(graph);
  const focus = focusId ? graph.occurrences.get(focusId) : undefined;
  const selection: SourceWorkspaceSelection | undefined = initial && focusId ? {
    ...initial,
    nodeId: focus?.node.id ?? initial.nodeId,
    occurrenceId: focusId,
    kind: "component",
  } : initial;

  const selectTarget = (nextTargetId: string): SourceTargetSelection | undefined => {
    const nextTarget = targets.find((candidate) => candidate.id === nextTargetId);
    if (!nextTarget || nextTarget.id === target?.id) return;
    const nextNodes = sourceTreeNodes(workspace, nextTarget.id);
    const nextInitial = initialSourceTreeSelection(nextNodes, nextTarget);
    if (!nextInitial) return;
    const nextRootNodeId = sourceTargetRootNodeId(nextNodes, nextTarget, nextInitial.device);
    const nextGraph = sourceFocusGraph(nextNodes, nextInitial.device, nextRootNodeId ? [nextRootNodeId] : undefined);
    const nextFocusId = nextGraph.roots[0] ?? initialFocusOccurrence(nextGraph);
    const nextFocus = nextFocusId ? nextGraph.occurrences.get(nextFocusId) : undefined;
    setTargetId(nextTarget.id);
    return {
      focusId: nextFocusId,
      selection: {
        ...nextInitial,
        nodeId: nextFocus?.node.id ?? nextInitial.nodeId,
        ...(nextFocusId ? { occurrenceId: nextFocusId } : {}),
        kind: "component",
      },
      target: nextTarget,
    };
  };

  return {
    defaultSelection: selection,
    initial,
    initialFocusId: focusId,
    initialGraph: graph,
    registeredNodes: nodes as readonly SourceTreeNode[],
    selectedTarget: target,
    selectTarget,
    targets,
  };
}
