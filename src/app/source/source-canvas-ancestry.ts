import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import { sourceEntrySlotLayers } from "./source-entry-layers";
import type { SourceSlotScope } from "./source-slot-navigation";

export type SourceCanvasAncestryItem = {
  approval?: SourceCanvasApprovalStatus;
  children?: readonly SourceCanvasNavigationNode[];
  id: string;
  kind: "component" | "element" | "slot";
  label: string;
  scope?: SourceSlotScope;
};

export type SourceCanvasNavigationNode = {
  children: readonly SourceCanvasNavigationNode[];
  id: string;
  label: string;
  slotLabel?: string;
};

export type SourceCanvasApprovalStatus = {
  label: string;
  tone: "approved" | "invalid" | "pending";
};

export type SourceCanvasSlotTab = {
  active: boolean;
  id: string;
  label: string;
  scope: SourceSlotScope;
};

export function sourceCanvasAncestry(
  graph: SourceFocusGraph,
  occurrenceId: string | undefined,
  selectedLayer?: SourceWorkspaceLayer,
): readonly SourceCanvasAncestryItem[] {
  const occurrences: SourceOccurrence[] = [];
  const visited = new Set<string>();
  let occurrence = occurrenceId ? graph.occurrences.get(occurrenceId) : undefined;

  while (occurrence && !visited.has(occurrence.id)) {
    visited.add(occurrence.id);
    occurrences.unshift(occurrence);
    occurrence = occurrence.parentId ? graph.occurrences.get(occurrence.parentId) : undefined;
  }

  const items: SourceCanvasAncestryItem[] = [];
  occurrences.forEach((item, index) => {
    const parent = occurrences[index - 1];
    const edgeSlot = parent ? occurrenceSlot(parent, item) : undefined;
    if (edgeSlot) items.push({
      id: edgeSlot.id,
      kind: "slot",
      label: `slot:${edgeSlot.label}`,
      scope: "tree",
    });
    const children = occurrenceNavigationChildren(graph, item);
    items.push({
      ...(children.length ? { children } : {}),
      id: item.id,
      kind: "component",
      label: item.node.label,
    });
  });
  if (selectedLayer?.kind === "slot") {
    items.push({ id: selectedLayer.id, kind: "slot", label: `slot:${selectedLayer.label}`, scope: "tree" });
  } else if (selectedLayer?.kind === "html") {
    items.push({ id: selectedLayer.id, kind: "element", label: `<${selectedLayer.label}>` });
  }
  return items;
}

function occurrenceNavigationChildren(
  graph: SourceFocusGraph,
  occurrence: SourceOccurrence,
  visited: ReadonlySet<string> = new Set([occurrence.id]),
): readonly SourceCanvasNavigationNode[] {
  return occurrence.children.flatMap((childId) => {
    if (visited.has(childId)) return [];
    const child = graph.occurrences.get(childId);
    if (!child) return [];
    const nextVisited = new Set(visited).add(child.id);
    return [{
      children: occurrenceNavigationChildren(graph, child, nextVisited),
      id: child.id,
      label: child.node.label,
      slotLabel: occurrenceSlot(occurrence, child)?.label,
    }];
  });
}

function occurrenceSlot(
  parent: SourceOccurrence,
  child: SourceOccurrence,
): SourceWorkspaceLayer | undefined {
  if (child.usageSlot) return child.usageSlot;
  const usageLayerId = child.usageLayer?.id;
  return usageLayerId ? sourceEntrySlotLayers(parent.entry).find((slot) => (
    slot.children.some((layer) => layer.id === usageLayerId)
  )) : undefined;
}
