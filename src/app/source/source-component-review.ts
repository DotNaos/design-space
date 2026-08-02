import type { RuntimeSourceWorkspaceEntry, SourceApprovalEvidence } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";

export interface SourceComponentReviewItem {
  entry: RuntimeSourceWorkspaceEntry;
  occurrence: SourceOccurrence;
}

export function sourceComponentReviewSequence(graph: SourceFocusGraph): readonly SourceComponentReviewItem[] {
  const seenEntries = new Set<string>();
  const visitedOccurrences = new Set<string>();
  const items: SourceComponentReviewItem[] = [];
  const visit = (id: string) => {
    if (visitedOccurrences.has(id)) return;
    visitedOccurrences.add(id);
    const occurrence = graph.occurrences.get(id);
    if (!occurrence) return;
    if (occurrence.entry && !seenEntries.has(occurrence.entry.id)) {
      seenEntries.add(occurrence.entry.id);
      items.push({ entry: occurrence.entry, occurrence });
    }
    occurrence.children.forEach(visit);
  };
  graph.roots.forEach(visit);
  return items;
}

export function approvedSourceComponentCount(
  evidence: SourceApprovalEvidence | undefined,
  items: readonly SourceComponentReviewItem[],
): number {
  return items.filter(({ entry }) => evidence?.components[entry.id]?.state === "approved").length;
}
