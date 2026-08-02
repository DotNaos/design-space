import { Button, Dropdown, Label } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import type { SourceCanvasSlotTab } from "./source-canvas-ancestry";

export function SourceCanvasSlotChooser(props: {
  onSelect?: (slot: SourceCanvasSlotTab) => void;
  ownerLabel?: string;
  slots: readonly SourceCanvasSlotTab[];
}) {
  if (denseSlotList(props.slots)) return <DenseSlotPicker {...props} />;
  return <InlineSlotTabs {...props} />;
}

function DenseSlotPicker(props: {
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
        className={`h-6 min-w-0 max-w-40 gap-1 rounded-md px-2 text-[9px] outline-none focus-visible:ring-1 ${active?.scope === "shared" ? "bg-sky-400/15 text-sky-300 focus-visible:ring-sky-300" : active ? "bg-fuchsia-400/15 text-fuchsia-300 focus-visible:ring-fuchsia-300" : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 focus-visible:ring-zinc-400"}`}
        data-slot-scope={active?.scope}
        size="sm"
        variant="ghost"
      >
        <span className="min-w-0 truncate">{active ? `slot:${active.label}` : "Slots"}</span>
        <span className="shrink-0 rounded bg-black/20 px-1 text-[8px] tabular-nums text-current/70">
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

function InlineSlotTabs(props: {
  onSelect?: (slot: SourceCanvasSlotTab) => void;
  ownerLabel?: string;
  slots: readonly SourceCanvasSlotTab[];
}) {
  return (
    <div
      aria-label={props.ownerLabel ? `Child slots of ${props.ownerLabel}` : "Child slots"}
      className="flex items-center gap-0.5 rounded bg-black/15 p-0.5"
      role="group"
    >
      {props.slots.map((slot) => (
        <Button
          key={slot.id}
          aria-label={`slot:${slot.label}`}
          aria-description={slot.scope === "shared" ? "Shared component boundary" : "App tree slot"}
          aria-current={slot.active ? "location" : undefined}
          aria-pressed={slot.active}
          className={`h-6 min-w-0 shrink-0 rounded-md px-2 text-[9px] outline-none transition-colors focus-visible:ring-1 ${slot.scope === "shared" ? slot.active ? "bg-sky-400/15 font-medium text-sky-300 focus-visible:ring-sky-300" : "text-sky-400/70 hover:bg-sky-400/[0.08] hover:text-sky-200 focus-visible:ring-sky-300" : slot.active ? "bg-fuchsia-400/15 font-medium text-fuchsia-300 focus-visible:ring-fuchsia-300" : "text-zinc-500 hover:bg-fuchsia-400/[0.08] hover:text-fuchsia-200 focus-visible:ring-fuchsia-300"}`}
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

function denseSlotList(slots: readonly SourceCanvasSlotTab[]): boolean {
  return slots.length > 4 || slots.reduce((length, slot) => length + slot.label.length, 0) > 48;
}
