import { useEffect, useState } from "react";

import type { SelectionTarget } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import type { TargetFileEntry, TargetModule } from "../../shared/target-module";
import type { CanvasContextMenuRequest } from "../components/PreviewCanvas";
import type { useDocumentItemEditor } from "./use-document-item-editor";
import type { SlotState } from "../types";
import { resolveDocumentAdapter, wouldCreateAuthoredComponentCycle } from "./document-adapters";
import { findDesignNode, insertDesignChild } from "./document-commands";
import {
  contextSelectionLabel,
  contextSourceFileId,
  createContextActions,
} from "./document-workspace-context-actions";
import { shouldOpenSlotPicker, slotHasCapacity } from "./slot-capacity";
import {
  authoredSlotDependencyMessage,
  componentMutationAvailability,
  deleteWorkspaceSelection,
  duplicateWorkspaceSelection,
  removeAuthoredSlotDefinition,
  type WorkspaceSelectionActionResult,
} from "./workspace-selection-actions";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
type ItemEditor = ReturnType<typeof useDocumentItemEditor>;
type ContextMenu = CanvasContextMenuRequest & { label: string };

export function useDocumentSelectionInteractions(options: {
  target: TargetModule;
  document: DesignDocument;
  library: readonly DesignDocument[];
  files: readonly TargetFileEntry[];
  slots: readonly SlotState[];
  selection: SelectionTarget;
  insertMode: boolean;
  createId: () => string;
  itemEditor: ItemEditor;
  edit: (document: DesignDocument) => void;
  onSelect: (selection: SelectionTarget) => void;
  onEdit: (instanceId: string) => void;
  onOpenPicker: (slot: SlotSelection) => void;
  onInserted: (instanceId: string) => void;
  onOpenSource: (fileId: string) => void;
  onReveal: () => void;
}) {
  const [actionError, setActionError] = useState<string>();
  const [contextMenu, setContextMenu] = useState<ContextMenu>();

  useEffect(() => {
    setActionError(undefined);
    setContextMenu(undefined);
  }, [options.document.id]);

  const applyResult = (result: WorkspaceSelectionActionResult) => {
    if (result.status === "blocked") {
      setActionError(result.message);
      return;
    }
    setActionError(undefined);
    if (result.status === "unchanged") return;
    options.edit(result.document);
    options.itemEditor.close();
    options.onSelect(result.selection);
  };
  const resolveSlotContract = (adapterId: string, slotId: string) => (
    resolveDocumentAdapter(options.target, options.library, adapterId)?.component.slots.find((slot) => slot.id === slotId)
  );
  const deleteSelection = (selection: SelectionTarget) => applyResult(deleteWorkspaceSelection({
    document: options.document,
    selection,
    resolveSlotContract,
  }));
  const removeOutlet = (outletId: string) => deleteSelection({
    kind: "slot-outlet",
    id: `outlet:${outletId}`,
    outletId,
    slotId: options.selection.kind === "slot-outlet" && options.selection.outletId === outletId ? options.selection.slotId : "slot",
  });
  const openSlotCatalog = (slot: SlotSelection) => {
    options.onSelect(slot);
    options.onOpenPicker(slot);
  };
  const selectTarget = (next: SelectionTarget, openEmptySlot = true) => {
    options.onSelect(next);
    if (next.kind !== "slot" || !openEmptySlot) return;
    const parent = findDesignNode(options.document.root, next.componentInstanceId);
    const adapter = parent ? resolveDocumentAdapter(options.target, options.library, parent.adapterId) : undefined;
    const slot = adapter?.component.slots.find((candidate) => candidate.id === next.slotId);
    const childCount = parent?.slots[next.slotId]?.length ?? 0;
    if (slot && shouldOpenSlotPicker(slot, childCount, options.insertMode)) options.onOpenPicker(next);
  };
  const insertComponent = (adapterId: string, targetSlot: SlotSelection): boolean => {
    if (wouldCreateAuthoredComponentCycle(options.document, options.library, adapterId)) return false;
    const parent = findDesignNode(options.document.root, targetSlot.componentInstanceId);
    const parentAdapter = parent ? resolveDocumentAdapter(options.target, options.library, parent.adapterId) : undefined;
    const slot = parentAdapter?.component.slots.find((candidate) => candidate.id === targetSlot.slotId);
    const childAdapter = resolveDocumentAdapter(options.target, options.library, adapterId);
    const children = parent?.slots[targetSlot.slotId] ?? [];
    if (!parent || !slot || !childAdapter || !slot.accepts?.includes(adapterId)) return false;
    if (!slotHasCapacity(slot, children.length)) return false;
    const instanceId = options.createId();
    options.edit(insertDesignChild(options.document, parent.instanceId, slot.id, {
      kind: "component",
      node: {
        instanceId,
        adapterId,
        props: { ...childAdapter.defaultProps },
        slots: Object.fromEntries(childAdapter.component.slots.map((childSlot) => [childSlot.id, []])),
      },
    }));
    options.onSelect({ kind: "component", id: instanceId });
    options.onInserted(instanceId);
    return true;
  };
  const contextActions = contextMenu ? createContextActions(contextMenu.selection, {
    document: options.document,
    slots: options.slots,
    sourceFileId: contextSourceFileId(contextMenu.selection, options.document, options.target, options.library),
    onClearSlot: deleteSelection,
    onDeleteComponent: (id) => deleteSelection({ kind: "component", id }),
    onDuplicateComponent: (id) => applyResult(duplicateWorkspaceSelection({
      document: options.document,
      selection: { kind: "component", id },
      createId: options.createId,
      resolveSlotContract,
    })),
    onEditComponent: options.onEdit,
    onInsert: openSlotCatalog,
    onOpenSource: (id) => {
      if (options.files.some((file) => file.id === id)) options.onOpenSource(id);
    },
    onRemoveOutlet: removeOutlet,
    onReveal: options.onReveal,
    componentAvailability: (instanceId) => componentMutationAvailability({
      document: options.document,
      instanceId,
      resolveSlotContract,
    }),
  }) : [];
  const outletSelection = options.selection.kind === "slot-outlet" ? options.selection : undefined;
  const slotDependencyMessage = outletSelection
    ? authoredSlotDependencyMessage(options.document, options.library, outletSelection.slotId)
    : undefined;
  const removeSlotDefinition = outletSelection ? () => applyResult(removeAuthoredSlotDefinition({
    document: options.document,
    documents: options.library,
    slotId: outletSelection.slotId,
    selection: outletSelection,
  })) : undefined;

  return {
    actionError,
    contextMenu,
    contextActions,
    closeContextMenu: () => setContextMenu(undefined),
    openContextMenu: (request: CanvasContextMenuRequest) => {
      options.onSelect(request.selection);
      setContextMenu({ ...request, label: contextSelectionLabel(request.selection, options.document, options.slots) });
    },
    selectTarget,
    openSlotCatalog,
    insertComponent,
    clearSlot: (slot: SlotSelection) => deleteSelection(slot),
    deleteSelection,
    removeOutlet,
    slotDependencyMessage,
    removeSlotDefinition,
  };
}
