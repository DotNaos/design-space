import { Input, Label, NumberField } from "@heroui/react";

export function DimensionField(props: { disabled: boolean; label: string; value?: number; onChange: (value: number) => void }) {
  return (
    <NumberField isDisabled={props.disabled} minValue={0} value={Number.isFinite(props.value) ? Math.round(props.value!) : Number.NaN}>
      <Label className="sr-only">{props.label}</Label>
      <NumberField.Group className="flex h-8 items-center rounded-lg bg-black/20 px-2 focus-within:ring-1 focus-within:ring-sky-400/50">
        <span aria-hidden="true" className="text-[9px] text-zinc-600">{props.label}</span>
        <NumberField.Input
          aria-label={props.label}
          className="min-w-0 flex-1 bg-transparent text-right font-mono text-[10px] text-zinc-300 outline-none disabled:text-zinc-600"
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (Number.isFinite(value)) props.onChange(value);
          }}
        />
      </NumberField.Group>
    </NumberField>
  );
}
