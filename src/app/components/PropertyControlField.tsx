import { Input, Label, ListBox, Select, Switch, TextField } from "@heroui/react";
import { Check, Minus, Plus } from "lucide-react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import { TailwindClassField } from "../inspector/TailwindClassField";

export function PropertyControlField(props: {
  control: ComponentControl;
  value: DesignValue | undefined;
  error?: string;
  onChange: (value: DesignValue | undefined) => void;
}) {
  const { control } = props;
  if (control.kind === "tailwind") {
    return (
      <TailwindClassField
        compileError={props.error}
        label={control.label}
        value={typeof props.value === "string" ? props.value : ""}
        onChange={props.onChange}
      />
    );
  }
  if (control.kind === "boolean") {
    return (
      <Switch isSelected={props.value === true} onChange={props.onChange}>
        <Switch.Content className="flex min-h-11 w-full items-center justify-between gap-3 text-xs text-zinc-300">
          <span>{control.label}</span>
          <Switch.Control><Switch.Thumb /></Switch.Control>
        </Switch.Content>
      </Switch>
    );
  }
  if (control.kind === "number") {
    const value = typeof props.value === "number" && Number.isFinite(props.value) ? props.value : undefined;
    const step = control.step ?? 1;
    const changeBy = (offset: -1 | 1) => {
      const baseline = value ?? control.min ?? 0;
      const next = baseline + (step * offset);
      const bounded = Math.min(control.max ?? Number.POSITIVE_INFINITY, Math.max(control.min ?? Number.NEGATIVE_INFINITY, next));
      if (Number.isFinite(bounded)) props.onChange(bounded);
    };
    return (
      <label className="block">
        <Label className="text-[10px] text-zinc-500">{control.label}{control.unit ? ` · ${control.unit}` : ""}</Label>
        <span className="mt-1 flex min-h-11 overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <button aria-label={`Decrease ${control.label}`} className="grid w-11 place-items-center border-r border-white/10 text-zinc-500" type="button" onClick={() => changeBy(-1)}><Minus size={14} /></button>
          <input aria-label={control.label} className="min-w-0 flex-1 bg-transparent px-3 text-center text-base text-zinc-200 outline-none lg:text-sm" max={control.max} min={control.min} placeholder={control.required ? "Required" : "Not set"} step={step} type="number" value={value ?? ""} onChange={(event) => {
            const raw = event.currentTarget.value;
            if (raw === "") {
              props.onChange(undefined);
              return;
            }
            const next = Number(raw);
            if (Number.isFinite(next)) props.onChange(next);
          }} />
          <button aria-label={`Increase ${control.label}`} className="grid w-11 place-items-center border-l border-white/10 text-zinc-500" type="button" onClick={() => changeBy(1)}><Plus size={14} /></button>
        </span>
      </label>
    );
  }
  if (control.kind === "select") {
    const selected = control.options.find((option) => option.value === props.value);
    return (
      <Select fullWidth aria-label={control.label} selectedKey={selected?.id ?? null} onSelectionChange={(key) => {
        const option = control.options.find((candidate) => candidate.id === key);
        if (option) props.onChange(option.value);
      }}>
        <Label className="text-[10px] text-zinc-500">{control.label}</Label>
        <Select.Trigger className="mt-1 flex min-h-11 w-full items-center rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm">
          <Select.Value className="min-w-0 flex-1 text-left" />
          <Select.Indicator className="size-4 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover className="min-w-48 rounded-xl border border-white/10 bg-[#18191c] p-1 shadow-2xl">
          <ListBox items={control.options}>
            {(option) => <ListBox.Item id={option.id} textValue={option.label} className="flex min-h-10 items-center rounded-lg px-3 text-sm text-zinc-300 data-[focused]:bg-white/10"><span className="flex-1">{option.label}</span>{selected?.id === option.id && <Check size={14} />}</ListBox.Item>}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  }
  const value = typeof props.value === "string" ? props.value : "";
  return (
    <TextField fullWidth value={value} onChange={props.onChange}>
      <Label className="text-[10px] text-zinc-500">{control.label}</Label>
      <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm" aria-label={control.label} maxLength={control.kind === "text" ? control.maxLength : undefined} placeholder={control.kind === "text" ? control.placeholder : undefined} />
    </TextField>
  );
}
