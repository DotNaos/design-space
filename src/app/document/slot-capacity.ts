import type { ComponentSlotDraft } from "../../shared/design-document";

export function slotHasCapacity(slot: Pick<ComponentSlotDraft, "max">, childCount: number): boolean {
  return slot.max === undefined || childCount < slot.max;
}

export function shouldOpenSlotPicker(
  slot: Pick<ComponentSlotDraft, "max">,
  childCount: number,
  insertMode: boolean,
): boolean {
  return slotHasCapacity(slot, childCount) && (childCount === 0 || insertMode);
}
