import type { Point } from "../canvas-transform";
import type { StrictUiCanvasTarget } from "../strict-ui/strict-ui-markers";
import type { Selection, SlotState } from "../types";

export type CanvasContextMenuRequest = {
  selection: Selection;
  clientPosition: Point;
  viewportPosition: Point;
};

export type StrictUiTargetAction = {
  selection: Selection;
  editInstanceId?: string;
};

export function selectionForCanvasTarget(
  target: Element | undefined,
  slots: readonly SlotState[],
  selectedComponentInstanceId: string,
): Selection | undefined {
  let element = target instanceof HTMLElement ? target : target?.parentElement;
  while (element) {
    const slotSelectionId = element.dataset.designSpaceSlotId;
    const parsedSlot = slotSelectionId ? parseSlotSelectionId(slotSelectionId) : undefined;
    const slot = slots.find((candidate) => candidate.selectionId === slotSelectionId);
    if (slot?.count === 0) return selectionForSlot(slot, selectedComponentInstanceId);

    const outletId = element.dataset.designSpaceOutletId;
    if (outletId) {
      const slotId = parsedSlot?.slotId ?? slotIdForElement(element, slots);
      if (!slotId) return undefined;
      return {
        kind: "slot-outlet",
        id: `outlet:${outletId}`,
        outletId,
        slotId,
      };
    }

    if (parsedSlot && !element.dataset.designSpaceInstanceId) return parsedSlot;

    const htmlId = element.dataset.designSpaceHtmlId;
    if (htmlId) {
      const parsed = parseHtmlSelectionId(htmlId);
      if (parsed) return parsed;
    }

    const instanceId = element.dataset.designSpaceInstanceId;
    if (instanceId) return { kind: "component", id: instanceId };

    if (parsedSlot) return parsedSlot;
    if (slot) return selectionForSlot(slot, selectedComponentInstanceId);
    element = element.parentElement;
  }
  return undefined;
}

function parseSlotSelectionId(id: string): Extract<Selection, { kind: "slot" }> | undefined {
  const parts = id.split(":");
  if (parts.length !== 3 || parts[0] !== "slot") return undefined;
  try {
    return {
      kind: "slot",
      id,
      componentInstanceId: decodeURIComponent(parts[1]),
      slotId: decodeURIComponent(parts[2]),
    };
  } catch {
    return undefined;
  }
}

export function componentToEdit(selection: Selection): string | undefined {
  if (selection.kind === "component") return selection.id;
  if (selection.kind === "html" || selection.kind === "slot") return selection.componentInstanceId;
  return undefined;
}

export function actionForStrictUiTarget(target: StrictUiCanvasTarget, rootInstanceId: string): StrictUiTargetAction {
  const violation = target.marker.violations.find((candidate) => candidate.location.kind !== "document")
    ?? target.marker.violations[0];
  const location = violation?.location;
  if (!location || location.kind === "document") {
    return { selection: { kind: "component", id: rootInstanceId } };
  }
  if (location.kind === "instance" || location.kind === "control") {
    return {
      selection: { kind: "component", id: location.instanceId },
      editInstanceId: location.instanceId,
    };
  }
  if (location.kind === "slot") {
    return {
      selection: {
        kind: "slot",
        id: target.id,
        componentInstanceId: location.instanceId,
        slotId: location.slotId,
      },
    };
  }
  if (location.outletId) {
    return {
      selection: {
        kind: "slot-outlet",
        id: `outlet:${location.outletId}`,
        outletId: location.outletId,
        slotId: location.slotId,
      },
    };
  }
  return { selection: { kind: "component", id: rootInstanceId } };
}

function selectionForSlot(
  slot: SlotState,
  componentInstanceId: string,
): Extract<Selection, { kind: "slot" }> {
  return {
    kind: "slot",
    id: slot.selectionId,
    componentInstanceId,
    slotId: slot.id,
  };
}

function parseHtmlSelectionId(id: string): Extract<Selection, { kind: "html" }> | undefined {
  const parts = id.split(":");
  if (parts.length !== 3 || parts[0] !== "html") return undefined;
  return {
    kind: "html",
    id,
    componentInstanceId: decodeURIComponent(parts[1]),
    nodeId: decodeURIComponent(parts[2]),
  };
}

function slotIdForElement(element: HTMLElement, slots: readonly SlotState[]): string | undefined {
  const selectionId = element.closest<HTMLElement>("[data-design-space-slot-id]")?.dataset.designSpaceSlotId;
  if (!selectionId) return undefined;
  return slots.find((slot) => slot.selectionId === selectionId)?.id ?? selectionId.slice(selectionId.lastIndexOf(":") + 1);
}
