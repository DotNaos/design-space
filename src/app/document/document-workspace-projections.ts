import { projectPreviewSlots } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import type { SlotState } from "../types";
import { resolveDocumentAdapter } from "./document-adapters";

type PreviewCatalog = Parameters<typeof projectPreviewSlots>[0];
type PreviewInstance = Parameters<typeof projectPreviewSlots>[1];

export function projectDocumentSlots(
  target: TargetModule,
  library: readonly DesignDocument[],
  selectedNode: NonNullable<DesignDocument["root"]>,
  catalog: PreviewCatalog,
  instance: PreviewInstance,
): SlotState[] {
  const adapter = resolveDocumentAdapter(target, library, selectedNode.adapterId);
  return projectPreviewSlots(catalog, instance, { contractValidation: "tolerant" }).map((slot) => {
    const definition = adapter?.component.slots.find((candidate) => candidate.id === slot.selection.slotId);
    return {
      id: slot.selection.slotId,
      selectionId: slot.selection.id,
      label: slot.label,
      count: slot.childCount,
      childLabel: childLabel(target, library, selectedNode, slot.selection.slotId),
      min: definition?.min,
      max: definition?.max,
      accepts: definition?.accepts,
      acceptedLabels: definition?.accepts?.map((adapterId) => resolveDocumentAdapter(target, library, adapterId)?.component.label ?? adapterId),
      acceptsText: definition?.acceptsText,
    };
  });
}

function childLabel(target: TargetModule, library: readonly DesignDocument[], parent: NonNullable<DesignDocument["root"]>, slotId: string) {
  const child = parent.slots[slotId]?.[0];
  if (!child) return undefined;
  if (child.kind === "text") return "Text";
  if (child.kind === "slot-outlet") return "Slot outlet";
  return resolveDocumentAdapter(target, library, child.node.adapterId)?.component.label;
}
