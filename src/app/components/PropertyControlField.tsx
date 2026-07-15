import { Button, Input, Label, NumberField, Switch, TextField } from "@heroui/react";
import { Minus, Plus } from "lucide-react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import { TailwindClassField } from "../inspector/TailwindClassField";
import { EditorSelectField } from "./EditorSelectField";

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
      <NumberField
        className="block"
        maxValue={control.max}
        minValue={control.min}
        step={step}
        value={value ?? Number.NaN}
      >
        <Label className="text-[10px] text-zinc-500">{control.label}{control.unit ? ` · ${control.unit}` : ""}</Label>
        <NumberField.Group className="mt-1 flex min-h-11 overflow-hidden rounded-lg border border-white/10 bg-black/20">
          <Button isIconOnly aria-label={`Decrease ${control.label}`} className="h-auto w-11 min-w-11 rounded-none border-r border-white/10 text-zinc-500" slot="decrement" variant="ghost" onPress={() => changeBy(-1)}><Minus size={14} /></Button>
          <NumberField.Input
            aria-label={control.label}
            className="min-w-0 flex-1 bg-transparent px-3 text-center text-base text-zinc-200 outline-none lg:text-sm"
            placeholder={control.required ? "Required" : "Not set"}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              if (raw === "") {
                props.onChange(undefined);
                return;
              }
              const next = Number(raw);
              if (Number.isFinite(next)) props.onChange(next);
            }}
          />
          <Button isIconOnly aria-label={`Increase ${control.label}`} className="h-auto w-11 min-w-11 rounded-none border-l border-white/10 text-zinc-500" slot="increment" variant="ghost" onPress={() => changeBy(1)}><Plus size={14} /></Button>
        </NumberField.Group>
      </NumberField>
    );
  }
  if (control.kind === "select") {
    const selected = control.options.find((option) => option.value === props.value);
    return (
      <EditorSelectField
        ariaLabel={control.label}
        label={control.label}
        options={control.options.map((option) => ({ id: option.id, label: option.label, value: option.id }))}
        value={selected?.id ?? ""}
        onChange={(id) => {
          const option = control.options.find((candidate) => candidate.id === id);
          if (option) props.onChange(option.value);
        }}
      />
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
