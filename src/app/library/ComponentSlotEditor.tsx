import { Button } from "@heroui/react";
import { Check, List, Square, Trash2 } from "lucide-react";

import type { ComponentSlotDraft } from "../../shared/design-document";
import {
  ContractSwitch,
  ContractTextInput,
  OptionalNumberInput,
  StableIdField,
} from "./ContractEditorFields";

export interface AcceptedComponentOption {
  id: string;
  label: string;
  group?: string;
}

export interface ComponentSlotEditorProps {
  slot: ComponentSlotDraft;
  catalogComponents: readonly AcceptedComponentOption[];
  onChange: (slot: ComponentSlotDraft) => void;
  onRemove?: () => void;
  removeBlockedReason?: string;
}

export function ComponentSlotEditor(props: ComponentSlotEditorProps) {
  const { slot } = props;
  const accepted = new Set(slot.accepts ?? []);
  const rangeInvalid = slot.min !== undefined && slot.max !== undefined && slot.min > slot.max;
  const singleChild = slot.max === 1;

  const setOptionalNumber = (key: "min" | "max", value: number | undefined) => {
    if (value === undefined) {
      const { [key]: _removed, ...next } = slot;
      props.onChange(next);
      return;
    }
    if (key === "min" && slot.max !== undefined && value > slot.max) {
      props.onChange({ ...slot, min: value, max: value });
      return;
    }
    if (key === "max" && slot.min !== undefined && value < slot.min) {
      props.onChange({ ...slot, min: value, max: value });
      return;
    }
    props.onChange({ ...slot, [key]: value });
  };

  const toggleAcceptedComponent = (componentId: string) => {
    const next = new Set(slot.accepts ?? []);
    if (next.has(componentId)) next.delete(componentId);
    else next.add(componentId);
    props.onChange({ ...slot, accepts: [...next] });
  };

  return (
    <section aria-label={`${slot.label} slot contract`} className="space-y-4 border-y border-white/10 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><StableIdField id={slot.id} /></div>
        {props.onRemove ? (
          <Button aria-label={`Remove ${slot.label} slot`} isDisabled={Boolean(props.removeBlockedReason)} isIconOnly size="sm" variant="ghost" onPress={props.onRemove}>
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
      {props.removeBlockedReason ? <p className="text-[10px] leading-4 text-amber-200/80">{props.removeBlockedReason}</p> : null}

      <ContractTextInput label="Slot label" value={slot.label} onChange={(label) => props.onChange({ ...slot, label })} />

      <fieldset>
        <legend className="text-[10px] text-zinc-500">Child collection</legend>
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-black/10 p-1">
          <Button
            aria-pressed={singleChild}
            className="min-h-10"
            size="sm"
            variant={singleChild ? "secondary" : "ghost"}
            onPress={() => props.onChange({ ...slot, min: Math.min(slot.min ?? 0, 1), max: 1 })}
          >
            <Square aria-hidden size={13} /> Single
          </Button>
          <Button
            aria-pressed={!singleChild}
            className="min-h-10"
            size="sm"
            variant={!singleChild ? "secondary" : "ghost"}
            onPress={() => {
              const { max: _removed, ...listSlot } = slot;
              props.onChange(listSlot);
            }}
          >
            <List aria-hidden size={13} /> List
          </Button>
        </div>
        <p className="mt-1 text-[9px] leading-4 text-zinc-600">List slots keep ordered children and may use minimum and maximum limits.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <OptionalNumberInput
          integer
          label="Minimum children"
          min={0}
          placeholder="0"
          value={slot.min}
          onChange={(value) => setOptionalNumber("min", value)}
        />
        <OptionalNumberInput
          integer
          label="Maximum children"
          min={1}
          placeholder="No limit"
          value={slot.max}
          onChange={(value) => setOptionalNumber("max", value)}
        />
      </div>
      {rangeInvalid ? <p role="alert" className="text-[10px] text-rose-300">Maximum children must be at least the minimum.</p> : null}

      <ContractSwitch
        description="Allow plain text as a direct child of this slot."
        label="Accept text children"
        selected={slot.acceptsText === true}
        onChange={(acceptsText) => props.onChange({ ...slot, acceptsText })}
      />

      <fieldset>
        <legend className="text-[10px] text-zinc-500">Accepted components</legend>
        <p className="mt-1 text-[9px] leading-4 text-zinc-600">Strict UI allows only the checked component types. An empty list rejects component children.</p>
        <div aria-label="Allowed catalog components" className="mt-2 space-y-1">
            {props.catalogComponents.length ? props.catalogComponents.map((component) => {
              const selected = accepted.has(component.id);
              return (
                <Button
                  key={component.id}
                  aria-pressed={selected}
                  className="min-h-11 w-full justify-start px-3"
                  size="sm"
                  variant={selected ? "secondary" : "ghost"}
                  onPress={() => toggleAcceptedComponent(component.id)}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs">{component.label}</span>
                    {component.group ? <span className="block truncate text-[9px] text-zinc-600">{component.group}</span> : null}
                  </span>
                  {selected ? <Check aria-hidden size={14} /> : null}
                </Button>
              );
            }) : (
              <p className="px-2 py-3 text-[10px] leading-4 text-zinc-600">No target or authored catalog components are available.</p>
            )}
            <p className="px-2 pt-1 text-[9px] leading-4 text-zinc-600">
              {accepted.size === 0 ? "No components are accepted; text may still be allowed." : `${accepted.size} component ${accepted.size === 1 ? "type" : "types"} accepted.`}
            </p>
        </div>
      </fieldset>
    </section>
  );
}
