import { Input, Label, NumberField, Switch, TextArea, TextField } from "@heroui/react";

import { EditorSelectField } from "../components/EditorSelectField/EditorSelectField";

const inputClassName = "mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 outline-none placeholder:text-zinc-700 lg:text-sm";

export function StableIdField(props: { id: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500">Stable ID</p>
      <code className="mt-1 block min-h-10 break-all rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-emerald-400/80">
        {props.id}
      </code>
      <p className="mt-1 text-[9px] leading-4 text-zinc-600">Referenced by saved documents and cannot be changed.</p>
    </div>
  );
}

export function ContractTextInput(props: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth isDisabled={props.disabled} value={props.value} onChange={props.onChange}>
      <Label className="text-[10px] text-zinc-500">{props.label}</Label>
      <Input aria-label={props.label} className={inputClassName} placeholder={props.placeholder} />
    </TextField>
  );
}

export function ContractTextArea(props: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField fullWidth value={props.value} onChange={props.onChange}>
      <Label className="text-[10px] text-zinc-500">{props.label}</Label>
      <TextArea
        aria-label={props.label}
        className={`${inputClassName} resize-y py-2`}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
      />
    </TextField>
  );
}

export function OptionalNumberInput(props: {
  label: string;
  value?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <NumberField
      className="block"
      maxValue={props.max}
      minValue={props.min}
      step={props.step ?? (props.integer ? 1 : undefined)}
      value={props.value ?? Number.NaN}
    >
      <Label className="text-[10px] text-zinc-500">{props.label}</Label>
      <NumberField.Group className="mt-1">
        <NumberField.Input
          aria-label={props.label}
          className={inputClassName}
          inputMode={props.integer ? "numeric" : "decimal"}
          placeholder={props.placeholder}
          role="spinbutton"
          onChange={(event) => {
            const raw = event.currentTarget.value;
            if (raw === "") {
              props.onChange(undefined);
              return;
            }
            const value = Number(raw);
            if (!Number.isFinite(value) || (props.integer && !Number.isInteger(value))) return;
            if (props.min !== undefined && value < props.min) return;
            if (props.max !== undefined && value > props.max) return;
            props.onChange(value);
          }}
        />
      </NumberField.Group>
    </NumberField>
  );
}

export function ContractSwitch(props: {
  label: string;
  description?: string;
  selected: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Switch aria-label={props.label} isSelected={props.selected} onChange={props.onChange}>
      <Switch.Content className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/10 px-3">
        <span className="min-w-0">
          <span className="block text-xs text-zinc-300">{props.label}</span>
          {props.description ? <span className="mt-0.5 block text-[9px] leading-4 text-zinc-600">{props.description}</span> : null}
        </span>
        <Switch.Control className="shrink-0"><Switch.Thumb /></Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

export function ContractSelect(props: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <EditorSelectField
      ariaLabel={props.label}
      label={props.label}
      options={props.options.map((option, index) => ({ id: `option-${index}`, ...option }))}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
