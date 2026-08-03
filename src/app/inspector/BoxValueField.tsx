import { Input, TextField } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { formatBoxUnitValue, parseBoxUnitValue, type BoxKind, type BoxUnit } from "./tailwind-box-model-values";
import { snappedFieldValue } from "./TailwindBoxModelValueRows";

export function BoxValueField(props: {
  accent: string;
  allowArbitrary: boolean;
  hint?: string;
  icon?: LucideIcon;
  kind: BoxKind;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onStep: (direction: number) => void;
  unit: BoxUnit;
  value: string;
}) {
  const [draft, setDraft] = useState<string>();
  const [isFocused, setIsFocused] = useState(false);

  const commit = () => {
    if (draft !== undefined && draft !== props.value) {
      const parsed = parseBoxUnitValue(draft, props.kind, props.unit);
      const next = props.allowArbitrary ? parsed : parsed === undefined ? undefined : snappedFieldValue(props.kind, parsed);
      if (next !== undefined) props.onChange(next);
    }
    setDraft(undefined);
  };

  return (
    <TextField
      aria-label={props.label}
      className="min-w-0 flex-1"
      value={draft ?? formatBoxUnitValue(props.value, props.kind, props.unit)}
      onChange={setDraft}
    >
      <div
        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#181a1f] pl-2 pr-1.5 transition-colors"
        data-box-value-field={props.label}
        style={{ boxShadow: isFocused ? `inset 0 0 0 1px ${props.accent}` : "none" }}
      >
        {props.icon && <props.icon aria-hidden="true" className="shrink-0 text-zinc-500" size={11} />}
        {props.hint && <span aria-hidden="true" className="shrink-0 text-[8px] font-semibold text-zinc-600">{props.hint}</span>}
        <Input
          className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[10px] font-medium tracking-[-0.01em] tabular-nums text-zinc-200 outline-none placeholder:text-zinc-600"
          placeholder="0"
          onBlur={() => {
            setIsFocused(false);
            commit();
            props.onBlur();
          }}
          onFocus={() => {
            setIsFocused(true);
            props.onFocus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              setDraft(undefined);
              props.onStep(event.key === "ArrowUp" ? 1 : -1);
              return;
            }
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setDraft(undefined);
          }}
        />
      </div>
    </TextField>
  );
}
