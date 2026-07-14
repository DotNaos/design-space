import type { SelectionTarget } from "../../model";
import type { ComponentSlotDraft, DesignComponentNode, DesignDocument } from "../../shared/design-document";
import {
  clearDesignSlot,
  duplicateDesignComponent,
  findDesignNode,
  findDesignNodeLocation,
  removeComponentSlot,
  removeDesignComponent,
  removeDesignSlotOutlet,
} from "./document-commands";

export type WorkspaceSelectionActionResult =
  | { status: "applied"; document: DesignDocument; selection: SelectionTarget }
  | { status: "blocked"; document: DesignDocument; selection: SelectionTarget; message: string }
  | { status: "unchanged"; document: DesignDocument; selection: SelectionTarget };

export type SlotContractResolver = (
  adapterId: string,
  slotId: string,
) => Pick<ComponentSlotDraft, "min" | "max"> | undefined;

export type ComponentMutationAvailability = {
  deleteBlocked?: string;
  duplicateBlocked?: string;
};

export function componentMutationAvailability(options: {
  document: DesignDocument;
  instanceId: string;
  resolveSlotContract: SlotContractResolver;
}): ComponentMutationAvailability {
  if (options.instanceId === options.document.root.instanceId) {
    return {
      deleteBlocked: "The root component cannot be removed.",
      duplicateBlocked: "The root component cannot be duplicated.",
    };
  }
  const location = findDesignNodeLocation(options.document.root, options.instanceId);
  if (!location) {
    const message = `Component instance ${options.instanceId} was not found.`;
    return { deleteBlocked: message, duplicateBlocked: message };
  }
  const parent = findDesignNode(options.document.root, location.parentInstanceId);
  if (!parent) {
    const message = "The selected component's parent was not found.";
    return { deleteBlocked: message, duplicateBlocked: message };
  }
  const contract = options.resolveSlotContract(parent.adapterId, location.slotId);
  if (!contract) {
    const message = "The parent slot contract is unavailable, so its content was not changed.";
    return { deleteBlocked: message, duplicateBlocked: message };
  }
  const min = contract.min ?? 0;
  const max = contract.max;
  return {
    deleteBlocked: location.siblingCount <= min
      ? `This slot requires at least ${min} item${min === 1 ? "" : "s"}, so this component cannot be deleted.`
      : undefined,
    duplicateBlocked: max !== undefined && location.siblingCount >= max
      ? `This slot accepts at most ${max} item${max === 1 ? "" : "s"} and is already full.`
      : undefined,
  };
}

export function deleteWorkspaceSelection(options: {
  document: DesignDocument;
  selection: SelectionTarget;
  resolveSlotContract: SlotContractResolver;
}): WorkspaceSelectionActionResult {
  const { document, selection } = options;
  if (selection.kind === "component") {
    const availability = componentMutationAvailability({
      document,
      instanceId: selection.id,
      resolveSlotContract: options.resolveSlotContract,
    });
    if (availability.deleteBlocked) return blocked(document, selection, availability.deleteBlocked);
    const location = findDesignNodeLocation(document.root, selection.id);
    if (!location) return blocked(document, selection, `Component instance ${selection.id} was not found.`);
    return {
      status: "applied",
      document: removeDesignComponent(document, selection.id),
      selection: { kind: "component", id: location.parentInstanceId },
    };
  }

  if (selection.kind === "slot") {
    const parent = findDesignNode(document.root, selection.componentInstanceId);
    if (!parent) return blocked(document, selection, "The selected slot owner was not found.");
    const children = parent.slots[selection.slotId];
    if (!children) return blocked(document, selection, "The selected component does not declare this slot.");
    const contract = options.resolveSlotContract(parent.adapterId, selection.slotId);
    if (!contract) return blocked(document, selection, "The selected slot contract is unavailable, so its content was not changed.");
    if ((contract.min ?? 0) > 0) {
      return blocked(
        document,
        selection,
        `This slot requires at least ${contract.min} item${contract.min === 1 ? "" : "s"} and cannot be cleared.`,
      );
    }
    if (children.length === 0) return { status: "unchanged", document, selection };
    return { status: "applied", document: clearDesignSlot(document, parent.instanceId, selection.slotId), selection };
  }

  if (selection.kind === "slot-outlet") {
    const parentId = findSlotOutletParent(document.root, selection.outletId);
    if (!parentId) return blocked(document, selection, `Slot outlet ${selection.outletId} was not found.`);
    return {
      status: "applied",
      document: removeDesignSlotOutlet(document, selection.outletId),
      selection: { kind: "component", id: parentId },
    };
  }

  return blocked(document, selection, "Internal HTML is owned by its component adapter and cannot be removed here.");
}

export function duplicateWorkspaceSelection(options: {
  document: DesignDocument;
  selection: SelectionTarget;
  createId: () => string;
  resolveSlotContract: SlotContractResolver;
}): WorkspaceSelectionActionResult {
  const { document, selection } = options;
  if (selection.kind !== "component") {
    return blocked(document, selection, "Only component instances can be duplicated.");
  }
  const availability = componentMutationAvailability({
    document,
    instanceId: selection.id,
    resolveSlotContract: options.resolveSlotContract,
  });
  if (availability.duplicateBlocked) return blocked(document, selection, availability.duplicateBlocked);
  try {
    const duplicate = duplicateDesignComponent(document, selection.id, options.createId);
    return {
      status: "applied",
      document: duplicate.document,
      selection: { kind: "component", id: duplicate.duplicateId },
    };
  } catch (error) {
    return blocked(document, selection, error instanceof Error ? error.message : "The component could not be duplicated.");
  }
}

export function authoredSlotDependencyMessage(
  authoredDocument: DesignDocument,
  documents: readonly DesignDocument[],
  slotId: string,
): string | undefined {
  if (authoredDocument.kind !== "component" || !authoredDocument.component) {
    return "Only authored component documents can remove slot definitions.";
  }
  const slot = authoredDocument.component.slots.find((candidate) => candidate.id === slotId);
  if (!slot) return `Slot definition ${slotId} was not found.`;
  const dependencies = uniqueDocuments(documents).filter((candidate) => (
    candidate.id !== authoredDocument.id && containsAdapter(candidate.root, authoredDocument.component!.id)
  ));
  if (dependencies.length === 0) return undefined;
  const componentLabel = authoredDocument.component.label;
  if (dependencies.length === 1) {
    return `Cannot remove the ${slot.label} slot because “${dependencies[0].label}” uses ${componentLabel}. Remove that component instance first.`;
  }
  const labels = dependencies.slice(0, 2).map((document) => `“${document.label}”`).join(" and ");
  const remaining = dependencies.length - 2;
  const list = remaining > 0 ? `${labels} and ${remaining} more` : labels;
  return `Cannot remove the ${slot.label} slot because ${dependencies.length} other documents use ${componentLabel}: ${list}. Remove those component instances first.`;
}

export function removeAuthoredSlotDefinition(options: {
  document: DesignDocument;
  documents: readonly DesignDocument[];
  slotId: string;
  selection: SelectionTarget;
}): WorkspaceSelectionActionResult {
  const dependencyMessage = authoredSlotDependencyMessage(options.document, options.documents, options.slotId);
  if (dependencyMessage) return blocked(options.document, options.selection, dependencyMessage);
  return {
    status: "applied",
    document: removeComponentSlot(options.document, options.slotId),
    selection: { kind: "component", id: options.document.root.instanceId },
  };
}

function blocked(
  document: DesignDocument,
  selection: SelectionTarget,
  message: string,
): WorkspaceSelectionActionResult {
  return { status: "blocked", document, selection, message };
}

function findSlotOutletParent(root: DesignComponentNode, outletId: string): string | undefined {
  for (const children of Object.values(root.slots)) {
    if (children.some((child) => child.kind === "slot-outlet" && child.id === outletId)) return root.instanceId;
    for (const child of children) {
      if (child.kind !== "component") continue;
      const parentId = findSlotOutletParent(child.node, outletId);
      if (parentId) return parentId;
    }
  }
  return undefined;
}

function containsAdapter(root: DesignComponentNode, adapterId: string): boolean {
  if (root.adapterId === adapterId) return true;
  return Object.values(root.slots).some((children) => children.some((child) => (
    child.kind === "component" && containsAdapter(child.node, adapterId)
  )));
}

function uniqueDocuments(documents: readonly DesignDocument[]): DesignDocument[] {
  const ids = new Set<string>();
  return documents.filter((document) => {
    if (ids.has(document.id)) return false;
    ids.add(document.id);
    return true;
  });
}
