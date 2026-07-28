import { Button, Tooltip } from "@heroui/react";
import { RotateCcw } from "lucide-react";

import { replaceTailwindUtilityGroup } from "./tailwind-utility";

const horizontal = [
  { id: "start", utility: "", label: "Left" },
  { id: "center", utility: "justify-center", label: "Center" },
  { id: "end", utility: "justify-end", label: "Right" },
] as const;

const vertical = [
  { id: "start", utility: "items-start", label: "Top" },
  { id: "center", utility: "items-center", label: "Middle" },
  { id: "end", utility: "items-end", label: "Bottom" },
] as const;

const justifyPattern = /^justify-(?:normal|start|end(?:-safe)?|center(?:-safe)?|between|around|evenly|stretch|baseline)$/;
const alignPattern = /^items-(?:start|end(?:-safe)?|center(?:-safe)?|baseline(?:-last)?|stretch)$/;

export function TailwindAlignmentControl(props: {
  value: string;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const selection = alignmentSelection(props.value);
  const valueFor = (row: number, column: number) => {
    let next = replaceTailwindUtilityGroup(props.value, [], vertical[row]!.utility, (utility) => alignPattern.test(utility));
    next = replaceTailwindUtilityGroup(next, [], horizontal[column]!.utility, (utility) => justifyPattern.test(utility));
    return next;
  };
  const change = (row: number, column: number) => props.onChange(valueFor(row, column));
  const reset = () => {
    let next = replaceTailwindUtilityGroup(props.value, [], "", (utility) => alignPattern.test(utility));
    next = replaceTailwindUtilityGroup(next, [], "", (utility) => justifyPattern.test(utility));
    props.onChange(next);
  };

  return (
    <div>
      <div className="mb-1 flex min-h-5 items-center">
        <span className="text-[9px] text-zinc-600">Alignment</span>
        <span className="ml-auto text-[9px] text-zinc-500">{selection.label}</span>
        <Tooltip delay={350} closeDelay={80}>
          <Button
            isIconOnly
            aria-label="Reset alignment"
            className="ml-1 size-6 min-w-6 rounded text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
            size="sm"
            variant="ghost"
            onPress={reset}
          >
            <RotateCcw aria-hidden="true" size={11} />
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
            Reset alignment
          </Tooltip.Content>
        </Tooltip>
      </div>
      <div className="grid h-20 grid-cols-3 grid-rows-3 gap-0.5 rounded-lg border border-white/10 bg-black/20 p-2">
        {vertical.flatMap((row, rowIndex) => horizontal.map((column, columnIndex) => {
          const active = selection.row === rowIndex && selection.column === columnIndex;
          return (
            <Tooltip key={`${row.id}-${column.id}`} delay={350} closeDelay={80}>
              <Button
                isIconOnly
                aria-label={`Alignment: ${row.label} ${column.label}`}
                className={`group min-h-0 min-w-0 rounded ${active ? "bg-sky-400/15" : "hover:bg-white/[0.05]"}`}
                size="sm"
                variant="ghost"
                onPointerEnter={() => props.onPreviewChange?.(valueFor(rowIndex, columnIndex))}
                onPointerLeave={() => props.onPreviewChange?.()}
                onPress={() => change(rowIndex, columnIndex)}
              >
                <span className={`size-1.5 rounded-full ${active ? "bg-sky-200" : "bg-zinc-600 group-hover:bg-zinc-400"}`} />
              </Button>
              <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
                {row.label} {column.label}
              </Tooltip.Content>
            </Tooltip>
          );
        }))}
      </div>
      <p className="mt-1.5 text-[8px] leading-3 text-zinc-600">Left uses the CSS default and adds no justify class.</p>
    </div>
  );
}

export function alignmentSelection(value: string): { row: number; column: number; label: string } {
  const utilities = value.split(/\s+/).filter((token) => token && !hasVariant(token));
  const align = utilities.find((utility) => alignPattern.test(utility));
  const justify = utilities.find((utility) => justifyPattern.test(utility));
  const row = align?.startsWith("items-center") ? 1 : align?.startsWith("items-end") ? 2 : 0;
  const column = justify?.startsWith("justify-center") ? 1 : justify?.startsWith("justify-end") ? 2 : 0;
  return { row, column, label: `${vertical[row]!.label} · ${horizontal[column]!.label}` };
}

function hasVariant(token: string): boolean {
  let depth = 0;
  for (const character of token) {
    if (character === "[") depth += 1;
    else if (character === "]") depth = Math.max(0, depth - 1);
    else if (character === ":" && depth === 0) return true;
  }
  return false;
}
