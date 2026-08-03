

import { boxLadder, clamp, nearestLadderIndex, parseBoxLengthPixels, readBoxValue, setBoxAxisValue, setBoxUniformValue, setBoxValue, snapBoxPixels, type BoxKind, type BoxSide, type BoxUnit } from "./tailwind-box-model-values";
import type { BoxFocus } from "./TailwindBoxModelDiagram";
import { BoxValueRow } from "./BoxValueRow";

const kinds: readonly BoxKind[] = ["margin", "border", "padding"];
export const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
export const sideSuffix: Record<BoxSide, string> = { top: "T", right: "R", bottom: "B", left: "L" };
export const boxHue: Record<BoxKind, number> = { margin: 20, border: 258, padding: 162 };

export function BoxModelValueRows(props: {
  focus?: BoxFocus;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (focus: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  unit: BoxUnit;
  value: string;
}) {
  return (
    <div aria-label="Box model legend" className="mt-2.5 flex flex-col gap-2">
      {kinds.map((kind) => <BoxValueRow key={kind} {...props} kind={kind} />)}
    </div>
  );
}

export type BoxFieldMode = "all" | "axis" | "sides";
export const fieldModeDetail: Record<BoxFieldMode, number> = { all: 0, axis: 1, sides: 2 };

export function coarserOf(requested: BoxFieldMode, natural: BoxFieldMode): BoxFieldMode {
  return fieldModeDetail[requested] >= fieldModeDetail[natural] ? requested : natural;
}

export function naturalFieldMode(className: string, kind: BoxKind): BoxFieldMode {
  const [top, right, bottom, left] = sides.map((side) => readBoxValue(className, kind, side));
  if (top === right && right === bottom && bottom === left) return "all";
  if (top === bottom && left === right) return "axis";
  return "sides";
}

export function collapseToMode(className: string, kind: BoxKind, target: BoxFieldMode): string {
  if (target === "all") return setBoxUniformValue(className, kind, readBoxValue(className, kind, "top"));
  if (target === "axis") {
    const vertical = setBoxAxisValue(className, kind, "y", readBoxValue(className, kind, "top"));
    return setBoxAxisValue(vertical, kind, "x", readBoxValue(className, kind, "left"));
  }
  return className;
}

export function snapRowToTailwind(className: string, kind: BoxKind): string {
  return sides.reduce((current, side) => {
    const pixels = parseBoxLengthPixels(readBoxValue(className, kind, side)) ?? 0;
    return setBoxValue(current, kind, side, `${snapBoxPixels(kind, pixels)}px`);
  }, className);
}

export function snappedFieldValue(kind: BoxKind, value: string): string | undefined {
  const pixels = parseBoxLengthPixels(value.trim());
  return pixels === undefined ? undefined : `${snapBoxPixels(kind, pixels)}px`;
}

export function steppedPixels(kind: BoxKind, display: string, direction: number): number {
  const steps = boxLadder(kind);
  const current = parseBoxLengthPixels(display) ?? 0;
  return steps[clamp(nearestLadderIndex(kind, current) + direction, 0, steps.length - 1)] ?? 0;
}

export function unitName(unit: BoxUnit): string {
  if (unit === "tailwind") return "Tailwind";
  return unit;
}

export function compactTickIndexes(length: number): number[] {
  const last = Math.max(0, length - 1);
  return [0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last]
    .filter((index, position, indexes) => indexes.indexOf(index) === position);
}
