import { Button } from "@heroui/react";
import type { SourceCanvasSlotTab } from "./source-canvas-ancestry";

export function InlineSlotTabs(props: {
  onSelect?: (slot: SourceCanvasSlotTab) => void;
  ownerLabel?: string;
  slots: readonly SourceCanvasSlotTab[];
}) {
  return (
    <div
      aria-label={props.ownerLabel ? `Child slots of ${props.ownerLabel}` : "Child slots"}
      className="flex items-center gap-0.5 rounded-full bg-black/15 p-0.5"
      role="group"
    >
      {props.slots.map((slot) => (
        <Button
          key={slot.id}
          aria-label={`slot:${slot.label}`}
          aria-description={slot.scope === "shared" ? "Shared component boundary" : "App tree slot"}
          aria-current={slot.active ? "location" : undefined}
          aria-pressed={slot.active}
          className={`h-6 min-w-0 shrink-0 rounded-full px-2 text-[9px] outline-none transition-colors focus-visible:ring-1 ${slot.scope === "shared" ? slot.active ? "bg-sky-400/15 font-medium text-sky-300 focus-visible:ring-sky-300" : "text-sky-400/70 hover:bg-sky-400/[0.08] hover:text-sky-200 focus-visible:ring-sky-300" : slot.active ? "bg-fuchsia-400/15 font-medium text-fuchsia-300 focus-visible:ring-fuchsia-300" : "text-zinc-500 hover:bg-fuchsia-400/[0.08] hover:text-fuchsia-200 focus-visible:ring-fuchsia-300"}`}
          data-slot-scope={slot.scope}
          size="sm"
          variant="ghost"
          onPress={() => props.onSelect?.(slot)}
        >
          {slot.active ? `slot:${slot.label}` : slot.label}
        </Button>
      ))}
    </div>
  );
}
