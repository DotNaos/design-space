import { Input, TextField } from "@heroui/react";
import { formatBoxUnitValue, parseBoxUnitValue, setBoxValue, type BoxUnit } from "./tailwind-box-model-values";
import { BoxFocus, boxHue, readBoxTarget } from "./TailwindBoxModelDiagram";

export function BoxReadout(props: {
  focus?: BoxFocus;
  isEditing: boolean;
  onChange: (value: string) => void;
  onCloseEditor: () => void;
  unit: BoxUnit;
  value: string;
}) {
  if (!props.focus) return null;

  const { kind, side } = props.focus;
  const edge = readBoxTarget(props.value, kind, side);
  const label = `${kind} ${side === "all" ? "all sides" : side}`;
  const display = edge.display === "mixed" ? edge.display : formatBoxUnitValue(edge.display, kind, props.unit);

  if (props.isEditing && side !== "all") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center" data-box-model-readout>
        <TextField
          aria-label={`${kind} ${side}`}
          autoFocus
          value={display}
          onChange={(value) => {
            const parsed = parseBoxUnitValue(value, kind, props.unit);
            if (parsed !== undefined) props.onChange(setBoxValue(props.value, kind, side, parsed));
          }}
        >
          <Input
            className="h-7 w-24 rounded-lg border-0 bg-[#22242a] px-2 text-center text-sm font-semibold tabular-nums text-zinc-100 outline-none focus:ring-1 focus:ring-sky-400"
            onBlur={props.onCloseEditor}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") props.onCloseEditor();
            }}
          />
        </TextField>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex min-w-0 items-center justify-center gap-2 px-3"
      data-box-model-readout
    >
      <span className="truncate text-[11px] font-medium capitalize text-zinc-400">{label}</span>
      <span
        className="shrink-0 text-[15px] font-semibold tracking-[-0.02em] tabular-nums"
        style={{ color: `hsl(${boxHue[kind]} 78% 70%)` }}
      >
        {display}
      </span>
      <span className="max-w-[35%] truncate text-[9px] font-medium text-zinc-600">
        {edge.token || "unset"}
      </span>
    </div>
  );
}
