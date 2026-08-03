import { Button } from "@heroui/react";
import { SourceReviewGraph } from "./SourceReviewGraphStage";

export function SlotRows(props: { graph: SourceReviewGraph }) {
  if (!props.graph.slots.length) {
    return <p className="px-2.5 py-2 text-[9px] text-zinc-600">No outgoing slots</p>;
  }
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {props.graph.slots.map((slot) => {
        const occupancy = slot.count
          ? slot.children.join(", ")
          : "Empty";
        const cardinality = slot.max === undefined ? `${slot.count}+` : `${slot.count}/${slot.max}`;
        return (
          <Button
            key={slot.id}
            aria-label={`Select ${slot.label} slot`}
            aria-pressed={slot.active}
            className={`h-auto min-w-0 shrink-0 flex-col items-stretch gap-0 rounded-lg border-0 px-2 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-400 ${slot.active ? "bg-fuchsia-400/14 text-fuchsia-100 ring-1 ring-inset ring-fuchsia-400/45" : "bg-white/[0.035] hover:bg-white/[0.065]"}`}
            data-slot-occupancy={slot.count}
            size="sm"
            variant="ghost"
            onPress={() => props.graph.onSelectSlot?.(slot.id)}
          >
            <span className="flex items-center gap-1 text-[9px] font-medium text-zinc-200">
              {slot.label}
              <span className="font-mono text-[8px] text-zinc-600">{cardinality}</span>
            </span>
            <span className={`block max-w-36 truncate text-[8px] ${slot.count ? "text-violet-300" : "text-zinc-600"}`}>
              {occupancy}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
