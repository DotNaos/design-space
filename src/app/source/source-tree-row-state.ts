import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceFocusRow } from "./source-focus-tree";
import { sourceTreeNodes } from "./source-workspace-tree";
import type { SourceWorkspaceSelection } from "./SourceWorkspaceSidebar";

export function renderedOccurrenceMatches(
  selected: SourceWorkspaceSelection | undefined,
  row: SourceFocusRow,
): boolean {
  return selected?.renderedLayerOccurrence === undefined
    || row.renderedLayerOccurrence === undefined
    || selected.renderedLayerOccurrence === row.renderedLayerOccurrence;
}

export function sourceRowOutsideActiveFile(
  row: SourceFocusRow,
  graph: SourceFocusGraph,
  nodes: ReturnType<typeof sourceTreeNodes>,
  device: DesignSpaceDevice,
  activeCanvasId?: string,
): boolean {
  if (row.kind === "component" && !row.layer && row.occurrence?.id === activeCanvasId) return false;
  const activeCanvasPath = activeCanvasId
    ? graph.occurrences.get(activeCanvasId)?.entry?.relativePath
    : undefined;
  const sourceOwnerId = row.sourceOwnerId ?? row.occurrence?.usageOwnerId;
  const sourceOwner = sourceOwnerId
    ? nodes.find((node) => node.id === sourceOwnerId)
    : row.occurrence?.node;
  const ownerPath = sourceOwner?.implementations[device].entry?.relativePath
    ?? row.occurrence?.entry?.relativePath
    ?? "";
  return Boolean(activeCanvasPath && ownerPath && ownerPath !== activeCanvasPath);
}

export function ancestorBranchKeys(
  rows: readonly SourceFocusRow[],
  selectedIndex: number,
): ReadonlySet<string> {
  const ancestors = ancestorRowKeys(rows, selectedIndex);
  const keys = new Set<string>();
  for (const row of rows) {
    if (ancestors.has(row.key) && row.collapsible) keys.add(row.key);
  }
  return keys;
}

export function ancestorRowKeys(
  rows: readonly SourceFocusRow[],
  selectedIndex: number,
): ReadonlySet<string> {
  const keys = new Set<string>();
  if (selectedIndex < 0) return keys;
  let parentDepth = (rows[selectedIndex]?.depth ?? 0) - 1;
  for (let index = selectedIndex - 1; index >= 0 && parentDepth >= 0; index -= 1) {
    const row = rows[index]!;
    if (row.depth !== parentDepth) continue;
    keys.add(row.key);
    parentDepth -= 1;
  }
  return keys;
}
