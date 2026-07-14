import { Button } from "@heroui/react";
import { CircleDot, Plus, Trash2, Unplug } from "lucide-react";

import type { SlotState } from "../types";

export function SlotInspector(props: {
  className?: string;
  slot: SlotState;
  authoredDefinition: boolean;
  dependencyMessage?: string;
  onClose?: () => void;
  onInsert?: () => void;
  onClear?: () => void;
  onRemoveOutlet?: () => void;
  onRemoveDefinition?: () => void;
}) {
  const required = (props.slot.min ?? 0) > 0;
  const atCapacity = props.slot.max !== undefined && props.slot.count >= props.slot.max;
  const compatible = props.slot.acceptedLabels?.length
    ? props.slot.acceptedLabels.join(", ")
    : props.slot.accepts?.length
      ? props.slot.accepts.join(", ")
      : "Any registered component";
  return (
    <aside aria-label={`${props.slot.label} slot inspector`} className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col overflow-y-auto bg-[#141518]`}>
      <header className="border-b border-white/10 px-4 py-3">
        <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">Slot</p>
        <div className="mt-1 flex items-center gap-2">
          <CircleDot className={props.slot.count ? "text-emerald-400" : "text-zinc-600"} size={14} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{props.slot.label}</h2>
          <span className={`rounded px-1.5 py-0.5 text-[9px] ${props.slot.count ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-zinc-500"}`}>
            {props.slot.count ? `${props.slot.count} used` : "Empty"}
          </span>
        </div>
      </header>

      <section className="border-b border-white/10 px-4 py-4 text-xs">
        <h3 className="mb-3 font-semibold text-zinc-300">Contract</h3>
        <Definition label="Capacity" value={capacityLabel(props.slot)} />
        <Definition label="Requirement" value={required ? `At least ${props.slot.min}` : "Optional"} />
        <Definition label="Components" value={compatible} />
        <Definition label="Text" value={props.slot.acceptsText ? "Accepted" : "Not accepted"} />
      </section>

      {props.slot.childLabel && (
        <section className="border-b border-white/10 px-4 py-4">
          <h3 className="mb-2 text-xs font-semibold text-zinc-300">Current content</h3>
          <p className="text-xs text-zinc-500">{props.slot.childLabel}{props.slot.count > 1 ? ` and ${props.slot.count - 1} more` : ""}</p>
        </section>
      )}

      {props.dependencyMessage && <p className="border-b border-amber-400/20 bg-amber-500/5 px-4 py-3 text-[10px] leading-4 text-amber-200">{props.dependencyMessage}</p>}

      <div className="mt-auto grid gap-2 p-3">
        {props.onInsert && <Button isDisabled={atCapacity} onPress={props.onInsert}><Plus size={14} />{atCapacity ? "Slot is full" : `Insert into ${props.slot.label}`}</Button>}
        {props.slot.count > 0 && props.onClear && <Button isDisabled={required} variant="secondary" onPress={props.onClear}><Trash2 size={14} />{required ? "Required content" : "Clear slot"}</Button>}
        {props.onRemoveOutlet && <Button variant="secondary" onPress={props.onRemoveOutlet}><Unplug size={14} />Remove this outlet</Button>}
        {props.authoredDefinition && props.onRemoveDefinition && <Button isDisabled={Boolean(props.dependencyMessage)} variant="danger" onPress={props.onRemoveDefinition}><Unplug size={14} />Remove slot definition</Button>}
      </div>
    </aside>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 border-t border-white/5 py-2 first:border-t-0"><dt className="text-zinc-600">{label}</dt><dd className="min-w-0 break-words text-zinc-300">{value}</dd></div>;
}

function capacityLabel(slot: SlotState): string {
  if (slot.max === undefined) return `${slot.count} used · unlimited`;
  return `${slot.count} of ${slot.max} used`;
}
