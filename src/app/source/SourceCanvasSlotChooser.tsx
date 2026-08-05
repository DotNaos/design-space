

import type { SourceCanvasSlotTab } from "./source-canvas-ancestry";
import { DenseSlotPicker } from "./DenseSlotPicker";
import { InlineSlotTabs } from "./InlineSlotTabs";

export function SourceCanvasSlotChooser(props: {
  onSelect?: (slot: SourceCanvasSlotTab) => void;
  ownerLabel?: string;
  slots: readonly SourceCanvasSlotTab[];
}) {
  if (denseSlotList(props.slots)) return <DenseSlotPicker {...props} />;
  return <InlineSlotTabs {...props} />;
}

function denseSlotList(slots: readonly SourceCanvasSlotTab[]): boolean {
  return slots.length > 4 || slots.reduce((length, slot) => length + slot.label.length, 0) > 48;
}
