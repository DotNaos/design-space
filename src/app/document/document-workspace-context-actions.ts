import { Copy, FileCode2, MousePointer2, Plus, SlidersHorizontal, Trash2, Unplug } from "lucide-react";

import type { SelectionTarget } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import type { TargetModule } from "../../shared/target-module";
import type { WorkspaceContextAction } from "../components/WorkspaceContextMenu";
import type { SlotState } from "../types";
import { resolveDocumentAdapter } from "./document-adapters";
import { findDesignNode } from "./document-commands";
import type { ComponentMutationAvailability } from "./workspace-selection-actions";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;

export function createContextActions(selection: SelectionTarget, options: {
  document: DesignDocument;
  slots: readonly SlotState[];
  sourceFileId?: string;
  onClearSlot: (slot: SlotSelection) => void;
  onDeleteComponent: (id: string) => void;
  onDuplicateComponent: (id: string) => void;
  onEditComponent: (id: string) => void;
  onInsert: (slot: SlotSelection) => void;
  onOpenSource: (id: string) => void;
  onRemoveOutlet: (id: string) => void;
  onReveal: () => void;
  componentAvailability: (id: string) => ComponentMutationAvailability;
}): WorkspaceContextAction[] {
  const actions: WorkspaceContextAction[] = [];
  if (selection.kind === "component") {
    const availability = options.componentAvailability(selection.id);
    actions.push({ id: "edit", label: "Edit component", icon: SlidersHorizontal, onSelect: () => options.onEditComponent(selection.id) });
    const insertSlot = options.slots.find((slot) => slot.max === undefined || slot.count < slot.max);
    if (insertSlot) actions.push({
      id: "insert",
      label: `Insert into ${insertSlot.label}`,
      icon: Plus,
      onSelect: () => options.onInsert({ kind: "slot", id: insertSlot.selectionId, componentInstanceId: selection.id, slotId: insertSlot.id }),
    });
    actions.push({
      id: "duplicate",
      label: "Duplicate",
      icon: Copy,
      shortcut: "⌘D",
      disabled: Boolean(availability.duplicateBlocked),
      onSelect: () => options.onDuplicateComponent(selection.id),
    });
    actions.push({
      id: "delete",
      label: "Delete",
      icon: Trash2,
      danger: true,
      shortcut: "⌫",
      disabled: Boolean(availability.deleteBlocked),
      onSelect: () => options.onDeleteComponent(selection.id),
    });
  } else if (selection.kind === "slot") {
    const state = options.slots.find((slot) => slot.id === selection.slotId);
    actions.push({ id: "insert", label: "Insert component", icon: Plus, disabled: state?.max !== undefined && state.count >= state.max, onSelect: () => options.onInsert(selection) });
    actions.push({ id: "clear", label: "Clear slot", icon: Trash2, danger: true, shortcut: "⌫", disabled: !state?.count || (state.min ?? 0) > 0, onSelect: () => options.onClearSlot(selection) });
  } else if (selection.kind === "slot-outlet") {
    actions.push({ id: "remove-outlet", label: "Remove this outlet", icon: Unplug, danger: true, shortcut: "⌫", onSelect: () => options.onRemoveOutlet(selection.outletId) });
  } else {
    actions.push({ id: "edit", label: "Edit parent component", icon: SlidersHorizontal, onSelect: () => options.onEditComponent(selection.componentInstanceId) });
  }
  if (options.sourceFileId) actions.push({ id: "source", label: "Open registered source", icon: FileCode2, onSelect: () => options.onOpenSource(options.sourceFileId!) });
  actions.push({ id: "reveal", label: "Reveal in tree", icon: MousePointer2, onSelect: options.onReveal });
  return actions;
}

export function contextSelectionLabel(selection: SelectionTarget, document: DesignDocument, slots: readonly SlotState[]): string {
  if (selection.kind === "slot") return `${slots.find((slot) => slot.id === selection.slotId)?.label ?? "Slot"} slot`;
  if (selection.kind === "slot-outlet") return `${document.component?.slots.find((slot) => slot.id === selection.slotId)?.label ?? "Slot"} outlet`;
  if (selection.kind === "html") return "HTML element";
  return findDesignNode(document.root, selection.id)?.label ?? "Component";
}

export function contextSourceFileId(
  selection: SelectionTarget,
  document: DesignDocument,
  target: TargetModule,
  library: readonly DesignDocument[],
): string | undefined {
  const instanceId = selection.kind === "component"
    ? selection.id
    : selection.kind === "slot" || selection.kind === "html"
      ? selection.componentInstanceId
      : document.root.instanceId;
  const node = findDesignNode(document.root, instanceId);
  return node ? resolveDocumentAdapter(target, library, node.adapterId)?.sourceFileId : undefined;
}
