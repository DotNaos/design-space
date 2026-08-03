
import { parseTailwindToken } from "./tailwind-utility";
import { SizeAxisControl } from "./SizeAxisControl";

export type SizeAxis = "width" | "height";
export type SizeMode = "auto" | "css-auto" | "full" | "screen" | "fit" | "min" | "max";

type SizeOption = {
  label: string;
  mode: SizeMode;
  suffix: string;
};

export const sizeOptions: readonly SizeOption[] = [
  { label: "Auto", mode: "auto", suffix: "" },
  { label: "CSS auto", mode: "css-auto", suffix: "auto" },
  { label: "Full", mode: "full", suffix: "full" },
  { label: "Screen", mode: "screen", suffix: "screen" },
  { label: "Fit content", mode: "fit", suffix: "fit" },
  { label: "Min content", mode: "min", suffix: "min" },
  { label: "Max content", mode: "max", suffix: "max" },
];

export function TailwindSizeControl(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2" data-size-mode-controls>
      <SizeAxisControl axis="width" {...props} />
      <SizeAxisControl axis="height" {...props} />
    </div>
  );
}

export function findSizeToken(current: string, pattern: RegExp): string {
  for (const token of current.split(/\s+/).filter(Boolean)) {
    const parsed = parseTailwindToken(token);
    if (!parsed.modified && pattern.test(parsed.utility)) return parsed.utility;
  }
  return "";
}
