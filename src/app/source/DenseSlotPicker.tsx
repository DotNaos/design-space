import { Button, Dropdown, Label } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { SourceCanvasSlotTab } from "./source-canvas-ancestry";

export function DenseSlotPicker(props: {
  onSelect?: (slot: SourceCanvasSlotTab) => void;
  ownerLabel?: string;
  slots: readonly SourceCanvasSlotTab[];
}) {
  const active = props.slots.find((slot) => slot.active);
  const owner = props.ownerLabel ?? "current component";
  return (
    <Dropdown>
      <Button
        aria-label={`Choose child slot of ${owner} · ${props.slots.length} slots${active ? ` · Current ${active.label}` : ""}`}
        className={`h-6 min-w-0 max-w-40 gap-1 rounded-full px-2 text-[9px] outline-none focus-visible:ring-1 ${active?.scope === "shared" ? "bg-sky-400/15 text-sky-300 focus-visible:ring-sky-300" : active ? "bg-fuchsia-400/15 text-fuchsia-300 focus-visible:ring-fuchsia-300" : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 focus-visible:ring-zinc-400"}`}
        data-slot-scope={active?.scope}
        size="sm"
        variant="ghost"
      >
        <span className="min-w-0 truncate">{active ? `slot:${active.label}` : "Slots"}</span>
        <span className="shrink-0 rounded-full bg-black/20 px-1 text-[8px] tabular-nums text-current/70">
          {props.slots.length}
        </span>
        <ChevronDown aria-hidden="true" className="shrink-0 opacity-60" size={10} />
      </Button>
      <Dropdown.Popover
        className="max-h-72 min-w-64 overflow-y-auto rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-xl"
        placement="bottom end"
      >
        <Dropdown.Menu
          aria-label={`Child slots of ${owner}`}
          selectedKeys={active ? new Set([active.id]) : new Set()}
          selectionMode="single"
          onAction={(key) => {
            const slot = props.slots.find((candidate) => candidate.id === String(key));
            if (slot) props.onSelect?.(slot);
          }}
        >
          {props.slots.map((slot) => (
            <Dropdown.Item id={slot.id} key={slot.id} textValue={slot.label}>
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${slot.scope === "shared" ? "bg-sky-400" : "bg-fuchsia-400"}`}
              />
              <Label className={`min-w-0 flex-1 truncate text-[11px] ${slot.scope === "shared" ? "text-sky-200" : "text-zinc-200"}`}>
                {slot.label}
              </Label>
              <span className={`shrink-0 text-[9px] ${slot.scope === "shared" ? "text-sky-400/70" : "text-zinc-600"}`}>
                {slot.scope === "shared" ? "Shared" : "Tree"}
              </span>
              {slot.active ? <Dropdown.ItemIndicator /> : null}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
