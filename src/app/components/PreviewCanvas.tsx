import { Maximize2, Minus, MousePointer2, Plus } from "lucide-react";
import type { Selection, SlotState } from "../types";

type PreviewCanvasProps = {
  preview: React.ReactNode;
  rootInstanceId: string;
  selectedComponentInstanceId: string;
  slots: SlotState[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

export function PreviewCanvas(props: PreviewCanvasProps) {
  const occupied = props.slots.filter((slot) => slot.count > 0);
  const empty = props.slots.filter((slot) => slot.count === 0);

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-[#0d0e10]">
      <div
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "radial-gradient(circle, #3f3f46 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      />

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#17181b]/95 p-1 shadow-xl">
        <button aria-label="Select" className="grid size-7 place-items-center rounded-md bg-indigo-500 text-white" type="button"><MousePointer2 size={14} /></button>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button aria-label="Zoom out" className="grid size-7 place-items-center text-zinc-500 hover:text-zinc-200" type="button"><Minus size={14} /></button>
        <span className="px-1 text-[10px] text-zinc-500">100%</span>
        <button aria-label="Zoom in" className="grid size-7 place-items-center text-zinc-500 hover:text-zinc-200" type="button"><Plus size={14} /></button>
        <button aria-label="Fit canvas" className="grid size-7 place-items-center text-zinc-500 hover:text-zinc-200" type="button"><Maximize2 size={14} /></button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-12">
        <div className="w-full max-w-[620px]" onClick={() => props.onSelect({ kind: "component", id: props.rootInstanceId })}>
          <div className={`relative transition-shadow ${props.selection.kind === "component" ? "ring-1 ring-indigo-400 ring-offset-4 ring-offset-[#0d0e10]" : ""}`}>
            {props.preview}
            {occupied.map((slot, index) => {
              const segment = 70 / occupied.length;
              return (
                <SlotOverlay
                  key={slot.selectionId}
                  label={slot.label}
                  top={`${6 + segment * index}%`}
                  height={`${Math.min(32, segment - 4)}%`}
                  active={props.selection.id === slot.selectionId}
                  onClick={() => props.onSelect({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id })}
                />
              );
            })}
          </div>

          {empty.map((slot) => (
            <button
              key={slot.selectionId}
              className={`mt-4 flex h-20 w-full items-center justify-center rounded-xl border border-dashed text-xs transition-colors ${props.selection.id === slot.selectionId ? "border-indigo-400 bg-indigo-500/10 text-indigo-300" : "border-zinc-600 bg-zinc-900/40 text-zinc-500 hover:border-zinc-400"}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onSelect({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id });
              }}
            >
              <span><span className="font-medium text-zinc-300">{slot.label} slot</span> · Drop a component</span>
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 text-[10px] text-zinc-600">Canvas · Direct React preview</div>
    </main>
  );
}

function SlotOverlay(props: { label: string; top: string; height: string; active: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={`Select ${props.label} slot`}
      className={`absolute left-0 right-0 rounded-xl border text-left transition-colors ${props.active ? "border-indigo-400 bg-indigo-500/10" : "border-emerald-400/40 bg-emerald-400/[0.03] hover:bg-emerald-400/[0.07]"}`}
      style={{ top: props.top, height: props.height }}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
    >
      <span className={`absolute right-1 top-1 rounded px-1.5 py-0.5 text-[9px] ${props.active ? "bg-indigo-500 text-white" : "bg-emerald-500 text-emerald-950"}`}>{props.label} slot</span>
    </button>
  );
}
