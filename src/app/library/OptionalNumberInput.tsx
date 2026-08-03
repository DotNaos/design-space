import { Input, Label, NumberField } from "@heroui/react";
import { inputClassName } from "./ContractEditorFields";

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
