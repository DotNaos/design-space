import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";

export type SourceCanvasAncestryItem = {
  approval?: SourceCanvasApprovalStatus;
  id: string;
  kind: "component" | "element" | "slot";
  label: string;
};

export type SourceCanvasApprovalStatus = {
  label: string;
  tone: "approved" | "invalid" | "pending";
};

export type SourceCanvasSlotTab = {
  active: boolean;
  id: string;
  label: string;
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

  const items: SourceCanvasAncestryItem[] = occurrences.map((item) => ({
    id: item.id,
    kind: "component",
    label: item.node.label,
  }));
  if (selectedLayer?.kind === "slot") {
    items.push({ id: selectedLayer.id, kind: "slot", label: `slot:${selectedLayer.label}` });
  } else if (selectedLayer?.kind === "html") {
    items.push({ id: selectedLayer.id, kind: "element", label: `<${selectedLayer.label}>` });
  }
  return items;
}
