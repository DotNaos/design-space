import { Input, Label, TextField } from "@heroui/react";
import { tailwindColorStyle } from "./SourceLayerDesignInspector";

export function PaintField(props: {
  disabled: boolean;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={`grid min-h-10 items-center gap-2 py-1.5 ${props.trailing ? "grid-cols-[3.5rem_minmax(0,1fr)_4.5rem]" : "grid-cols-[3.5rem_minmax(0,1fr)]"}`}>
      <span className="text-[9px] text-zinc-500">{props.label}</span>
      <TextField isDisabled={props.disabled} value={props.value} onChange={props.onChange}>
        <Label className="sr-only">{props.label}</Label>
        <div className="flex h-8 items-center gap-2 rounded-lg bg-black/20 px-2 focus-within:ring-1 focus-within:ring-sky-400/50">
          <span
            aria-label={`${props.label} swatch`}
            className="size-3.5 shrink-0 rounded-sm border border-white/15 bg-[linear-gradient(135deg,transparent_45%,rgba(244,63,94,.8)_46%,rgba(244,63,94,.8)_54%,transparent_55%)]"
            role="img"
            style={tailwindColorStyle(props.value)}
          />
          <Input aria-label={props.label} className="h-full min-w-0 flex-1 bg-transparent px-0 font-mono text-[10px] text-zinc-300 outline-none" placeholder={props.placeholder} />
        </div>
      </TextField>
      <div className="min-w-0">{props.trailing}</div>
    </div>
  );
}
