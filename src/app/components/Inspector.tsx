import { Button, Input, Label, TextField } from "@heroui/react";
import { ChevronDown, CircleDot, Plus } from "lucide-react";
import type { Selection, SlotState } from "../types";

type InspectorProps = {
  className?: string;
  componentLabel: string;
  sourceLabel?: string;
  editable: boolean;
  classNameValue: string;
  selection: Selection;
  slots: SlotState[];
  onClassNameChange: (value: string) => void;
  onSelectSlot: (slot: SlotState) => void;
  onAddToSlot: (slot: SlotState) => void;
};

export function Inspector(props: InspectorProps) {
  const selectedSlotId = props.selection.kind === "slot" ? props.selection.slotId : undefined;
  const selectedSlot = selectedSlotId
    ? props.slots.find((slot) => slot.id === selectedSlotId)
    : undefined;

  return (
    <aside className={`${props.className ?? "flex"} w-72 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#141518]`}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Inspector</p>
        <h2 className="mt-1 text-sm font-medium text-zinc-100">{selectedSlot ? `${selectedSlot.label} slot` : props.componentLabel}</h2>
        <p className="mt-0.5 text-[10px] text-zinc-600">{selectedSlot ? (selectedSlot.count ? "Occupied slot" : "Empty declared slot") : (props.sourceLabel ?? "Target-owned adapter")}</p>
      </div>

      <InspectorSection title="Children" open>
        <p className="mb-2 text-[10px] leading-4 text-zinc-500">Direct children: declared slots only</p>
        <div className="divide-y divide-white/5 border-y border-white/5">
          {props.slots.map((slot) => (
            <button key={slot.id} className="flex w-full items-center gap-2 py-2 text-left" type="button" onClick={() => props.onSelectSlot(slot)}>
              <CircleDot size={11} className={slot.count ? "text-emerald-400" : "text-zinc-600"} />
              <span className="flex-1 text-xs text-zinc-300">{slot.label}</span>
              <span className="text-[10px] text-zinc-600">{slot.count} item{slot.count === 1 ? "" : "s"}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${slot.count ? "bg-emerald-400/10 text-emerald-400" : "bg-white/5 text-zinc-500"}`}>{slot.count ? "Used" : "Empty"}</span>
            </button>
          ))}
        </div>
        {selectedSlot?.count === 0 && (
          <Button className="mt-3 w-full" size="sm" variant="secondary" onPress={() => props.onAddToSlot(selectedSlot)}>
            <Plus size={13} /> Add to {selectedSlot.label}
          </Button>
        )}
      </InspectorSection>

      <InspectorSection title="Layout" />
      <InspectorSection title="Spacing" />
      <InspectorSection title="Surface" />
      <InspectorSection title="Tailwind classes" open>
        <TextField value={props.classNameValue} isDisabled={!props.editable} onChange={props.onClassNameChange}>
          <Label className="text-[10px] text-zinc-500">className</Label>
          <Input className="mt-1 font-mono text-[11px]" aria-label="Tailwind classes" />
        </TextField>
        <p className="mt-2 text-[9px] leading-4 text-zinc-600">{props.editable ? "Live preview only. Source changes after Diff and Save." : "Connect a registered editable target to change source."}</p>
      </InspectorSection>
    </aside>
  );
}

function InspectorSection(props: { title: string; open?: boolean; children?: React.ReactNode }) {
  return (
    <section className="border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-300">{props.title}</h3>
        <ChevronDown size={13} className={props.open ? "text-zinc-500" : "-rotate-90 text-zinc-700"} />
      </div>
      {props.open && <div className="mt-3">{props.children}</div>}
    </section>
  );
}
