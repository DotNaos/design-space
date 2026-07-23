import { useEffect, useState } from "react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import type { SourceComponentCandidate } from "./source-slot-composition";

type PendingCanvasSlotEdit = {
  action: "add" | "replace";
  candidate: SourceComponentCandidate;
  occurrenceId: string;
  slotId: string;
  slotLabel: string;
};

export function useCanvasSlotEdit(props: {
  graph: SourceFocusGraph;
  sourceNodeId?: string;
  slotEditorReady: boolean;
  onApply: (
    slot: SourceWorkspaceLayer,
    occurrence: SourceOccurrence,
    candidate: SourceComponentCandidate,
    action: "add" | "replace",
  ) => void;
  onPrepare: (occurrence: SourceOccurrence) => void;
}) {
  const [pending, setPending] = useState<PendingCanvasSlotEdit>();

  useEffect(() => {
    if (!pending || !props.slotEditorReady) return;
    const occurrence = props.graph.occurrences.get(pending.occurrenceId);
    const ownerId = occurrence?.usageOwnerId ?? occurrence?.node.id;
    if (!occurrence || props.sourceNodeId !== ownerId) return;
    const slot = occurrence.usageLayer?.children.find((candidate) => (
      candidate.kind === "slot"
      && (candidate.id === pending.slotId || candidate.label === pending.slotLabel)
    ));
    if (!slot) {
      setPending(undefined);
      return;
    }
    props.onApply(slot, occurrence, pending.candidate, pending.action);
    setPending(undefined);
  }, [pending, props]);

  return {
    busy: Boolean(pending),
    applySlot: (
      slot: SourceWorkspaceLayer,
      occurrence: SourceOccurrence,
      candidate: SourceComponentCandidate,
      action: "add" | "replace",
    ) => {
      const ownerId = occurrence.usageOwnerId ?? occurrence.node.id;
      if (props.sourceNodeId === ownerId && props.slotEditorReady) {
        props.onApply(slot, occurrence, candidate, action);
        return;
      }
      setPending({
        action,
        candidate,
        occurrenceId: occurrence.id,
        slotId: slot.id,
        slotLabel: slot.label,
      });
      props.onPrepare(occurrence);
    },
  };
}
