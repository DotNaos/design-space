import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp, CircleDot, Copy, Plus, Trash2 } from "lucide-react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import type { SlotState } from "../types";
import { PropertyControlField } from "../components/PropertyControlField";
import { TailwindClassField } from "./TailwindClassField";
import { TailwindMappedControls } from "./TailwindMappedControls";

export function DocumentInspector(props: {
  className?: string;
  componentLabel: string;
  sourceLabel?: string;
  controls: readonly ComponentControl[];
  values: Readonly<Record<string, DesignValue | undefined>>;
  slots: readonly SlotState[];
  compileError?: string;
  compilePending: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onEditDefinition?: () => void;
  onControlChange: (prop: string, value: DesignValue | undefined) => void;
  onSelectSlot: (slot: SlotState) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const tailwindControl = props.controls.find((control) => control.kind === "tailwind");
  const sections = groupControls(props.controls.filter((control) => control.kind !== "tailwind"));
  const tailwindValue = tailwindControl && typeof props.values[tailwindControl.prop] === "string"
    ? String(props.values[tailwindControl.prop])
    : "";
  return (
    <aside className={`${props.className ?? "flex w-80"} min-w-0 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#141518]`}>
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">Inspector · Body</p><h2 className="mt-1 truncate text-sm font-semibold text-zinc-100">{props.componentLabel}</h2><p className="mt-0.5 truncate text-[9px] text-zinc-600">{props.sourceLabel ?? "Target-owned adapter"}</p></div>{props.onEditDefinition && <Button size="sm" variant="secondary" onPress={props.onEditDefinition}>Definition</Button>}</header>
      <div className="grid grid-cols-4 border-b border-white/10">
        <Action label="Up" disabled={!props.canMoveUp} icon={<ChevronUp size={15} />} onPress={() => props.onMove(-1)} />
        <Action label="Down" disabled={!props.canMoveDown} icon={<ChevronDown size={15} />} onPress={() => props.onMove(1)} />
        <Action label="Duplicate" disabled={!props.canDuplicate} icon={<Copy size={14} />} onPress={props.onDuplicate} />
        <Action danger label="Delete" disabled={!props.canDelete} icon={<Trash2 size={14} />} onPress={props.onDelete} />
      </div>
      {tailwindControl ? (
        <InspectorSection title="Layout & style">
          <TailwindMappedControls value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
          <TailwindClassField compileError={props.compileError} label={tailwindControl.label} value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
        </InspectorSection>
      ) : null}
      {Object.entries(sections).map(([section, controls]) => controls.length ? (
        <InspectorSection key={section} title={sectionLabel(section)}>
          {controls.map((control) => <PropertyControlField key={control.id} control={control} error={control.kind === "tailwind" ? props.compileError : undefined} value={props.values[control.prop]} onChange={(value) => props.onControlChange(control.prop, value)} />)}
        </InspectorSection>
      ) : null)}
      <InspectorSection title="Slots">
        {props.slots.map((slot) => <button key={slot.id} className="flex min-h-11 w-full items-center gap-2 border-t border-white/5 text-left first:border-t-0" type="button" onClick={() => props.onSelectSlot(slot)}><CircleDot size={12} className={slot.count ? "text-emerald-400" : "text-zinc-600"} /><span className="flex-1 text-xs text-zinc-300">{slot.label}</span><span className="text-[9px] text-zinc-600">{slot.count ? `${slot.count} used` : "Empty"}</span>{!slot.count && <Plus size={12} />}</button>)}
      </InspectorSection>
      {props.compileError && <p className="border-t border-rose-400/20 bg-rose-500/5 px-4 py-3 text-[10px] leading-4 text-rose-300">{props.compileError}</p>}
      <footer className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t border-white/10 bg-[#141518] p-3"><Button variant="secondary" onPress={props.onCancel}>Cancel</Button><Button isDisabled={props.compilePending || Boolean(props.compileError)} onPress={props.onApply}>{props.compilePending ? "Checking…" : "Apply"}</Button></footer>
    </aside>
  );
}

function groupControls(controls: readonly ComponentControl[]) {
  const result: Record<string, ComponentControl[]> = { content: [], layout: [], style: [], behavior: [], advanced: [] };
  for (const control of controls) result[control.section ?? (control.kind === "tailwind" ? "style" : "content")].push(control);
  return result;
}

function sectionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function InspectorSection(props: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-white/10 px-4 py-4"><h3 className="mb-3 text-xs font-semibold text-zinc-300">{props.title}</h3><div className="space-y-4">{props.children}</div></section>;
}

function Action(props: { label: string; icon: React.ReactNode; disabled: boolean; danger?: boolean; onPress: () => void }) {
  return <button className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] disabled:opacity-30 ${props.danger ? "text-rose-400" : "text-zinc-500"}`} disabled={props.disabled} type="button" onClick={props.onPress}>{props.icon}<span>{props.label}</span></button>;
}
