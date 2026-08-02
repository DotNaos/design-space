import { Button, Input, Slider, TextField } from "@heroui/react";
import { Frame, Link2, MoveHorizontal, MoveVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import {
  axisSides,
  boxLadder,
  clamp,
  formatBoxUnitValue,
  nearestLadderIndex,
  parseBoxLengthPixels,
  parseBoxUnitValue,
  readBoxAxis,
  readBoxValue,
  setBoxAxisValue,
  setBoxUniformValue,
  setBoxValue,
  snapBoxPixels,
  type BoxKind,
  type BoxSide,
  type BoxUnit,
} from "./tailwind-box-model-values";
import type { BoxFocus } from "./TailwindBoxModelDiagram";

const kinds: readonly BoxKind[] = ["margin", "border", "padding"];
const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
const sideSuffix: Record<BoxSide, string> = { top: "T", right: "R", bottom: "B", left: "L" };
const boxHue: Record<BoxKind, number> = { margin: 20, border: 258, padding: 162 };

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

function BoxValueRow(props: {
  focus?: BoxFocus;
  kind: BoxKind;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (focus: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  unit: BoxUnit;
  value: string;
}) {
  const { kind } = props;
  const [requestedMode, setRequestedMode] = useState<BoxFieldMode>("all");
  const [requestedCustom, setRequestedCustom] = useState(false);
  const mode = coarserOf(requestedMode, naturalFieldMode(props.value, kind));
  const hasArbitraryValue = sides.some((side) => parseBoxLengthPixels(readBoxValue(props.value, kind, side)) === undefined);
  const isCustom = requestedCustom || hasArbitraryValue;
  const isActive = props.focus?.kind === kind;
  const accent = `hsl(${boxHue[kind]} 74% 60%)`;

  const setMode = (next: BoxFieldMode) => {
    setRequestedMode(next);
    if (fieldModeDetail[next] < fieldModeDetail[mode]) {
      props.onChange(collapseToMode(props.value, kind, next));
    }
  };

  const toggleCustom = () => {
    if (isCustom) {
      setRequestedCustom(false);
      if (hasArbitraryValue) props.onChange(snapRowToTailwind(props.value, kind));
      return;
    }
    setRequestedCustom(true);
  };

  return (
    <div className="min-w-0 px-0.5" data-box-value-row={kind}>
      <div className="flex min-h-7 items-center gap-2">
        <BoxKindIcon active={isActive} kind={kind} />
        <span className={`min-w-0 flex-1 text-[10px] font-medium capitalize tracking-[-0.01em] ${isActive ? "text-zinc-200" : "text-zinc-500"}`}>
          {kind}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <BoxModeButton
            icon={Link2}
            isOn={mode === "all"}
            label={mode === "all" ? `All ${kind} sides linked` : `Link ${kind} sides`}
            onPress={() => setMode("all")}
          />
          <BoxModeButton
            icon={Frame}
            isOn={mode === "sides"}
            label={mode === "sides" ? `${kind} sides separated` : `Edit ${kind} sides separately`}
            onPress={() => setMode("sides")}
          />
          <Button
            isIconOnly
            aria-label={isCustom ? `Use Tailwind ${kind} values` : `Use custom ${kind} values`}
            aria-pressed={isCustom}
            className={`ml-0.5 size-7 !min-h-0 !min-w-0 rounded-lg !p-0 transition-colors ${
              isCustom ? "bg-[#2a2c33] text-zinc-100" : "text-zinc-600 hover:bg-[#1d1f24] hover:text-zinc-300"
            }`}
            data-box-custom-toggle={kind}
            size="sm"
            variant="ghost"
            onPress={toggleCustom}
          >
            <PrecisionIcon />
          </Button>
        </div>
      </div>

      <div className="ml-8 mt-1 min-w-0">
        {mode === "all" && !isCustom ? (
          <BoxPresetSlider
            kind={kind}
            unit={props.unit}
            value={readBoxValue(props.value, kind, "top")}
            onChange={(value) => props.onInteractionChange(setBoxUniformValue(props.value, kind, value))}
            onChangeEnd={(value) => props.onInteractionEnd(setBoxUniformValue(props.value, kind, value))}
            onFocus={() => props.onFocus({ kind, side: "all" })}
          />
        ) : (
          <BoxValueFields
            accent={accent}
            allowArbitrary={isCustom}
            kind={kind}
            mode={mode}
            unit={props.unit}
            value={props.value}
            onBlur={props.onBlur}
            onChange={props.onChange}
            onFocus={props.onFocus}
          />
        )}
      </div>
    </div>
  );
}

function BoxPresetSlider(props: {
  kind: BoxKind;
  onChange: (value: string) => void;
  onChangeEnd: (value: string) => void;
  onFocus: () => void;
  unit: BoxUnit;
  value: string;
}) {
  const steps = boxLadder(props.kind);
  const pixels = parseBoxLengthPixels(props.value) ?? 0;
  const index = nearestLadderIndex(props.kind, pixels);
  const visibleTicks = compactTickIndexes(steps.length);
  const selectedPixels = steps[index] ?? 0;
  const display = formatBoxUnitValue(`${selectedPixels}px`, props.kind, props.unit);
  const pendingValue = useRef<string | undefined>(undefined);
  const valueAt = (next: number | number[]) => {
    const nextIndex = Array.isArray(next) ? next[0] ?? 0 : next;
    return `${steps[clamp(Math.round(nextIndex), 0, steps.length - 1)] ?? 0}px`;
  };
  const commitPending = () => {
    if (pendingValue.current === undefined) return;
    const next = pendingValue.current;
    pendingValue.current = undefined;
    props.onChangeEnd(next);
  };

  return (
    <div
      className="flex min-w-0 items-center gap-3"
      data-box-preset-slider={props.kind}
      onBlurCapture={commitPending}
      onFocusCapture={props.onFocus}
      onPointerCancelCapture={commitPending}
    >
      <Slider
        aria-label={`${props.kind} all sides ${unitName(props.unit)} value`}
        className="min-w-0 flex-1"
        maxValue={steps.length - 1}
        minValue={0}
        step={1}
        value={index}
        onChange={(next) => {
          const value = valueAt(next);
          pendingValue.current = value;
          props.onChange(value);
        }}
        onChangeEnd={(next) => {
          pendingValue.current = undefined;
          props.onChangeEnd(valueAt(next));
        }}
      >
        <Slider.Track className="relative !h-8 w-full cursor-pointer !border-x-0 !bg-transparent">
          <span className="absolute left-0 top-2 h-[3px] w-full -translate-y-1/2 rounded-full bg-[#34363d]" />
          <Slider.Fill className="absolute left-0 top-2 !h-[3px] -translate-y-1/2 rounded-full !bg-[#2997ff]" />
          {visibleTicks.map((tick) => (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-[24px] h-0.5 w-1 -translate-x-1/2 rounded-full bg-[#666973]"
              key={tick}
              style={{ left: `${(tick / Math.max(1, steps.length - 1)) * 100}%` }}
            />
          ))}
          <Slider.Thumb
            aria-valuetext={display}
            className="!top-2 !h-7 !w-7 !rounded-none !bg-transparent !shadow-none outline-none ring-offset-2 ring-offset-[#141518] after:!h-3.5 after:!w-6 after:!rounded-full after:!border-0 after:!bg-[#f4f5f7] after:!shadow-[0_1px_2px_#000,0_3px_7px_#000] data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#2997ff]"
          />
        </Slider.Track>
      </Slider>
      <span
        className="w-10 shrink-0 text-right text-[10px] font-medium tabular-nums text-zinc-300"
        data-box-slider-output={props.kind}
        data-box-unit={props.unit}
      >
        {display}
      </span>
    </div>
  );
}

function BoxValueFields(props: {
  accent: string;
  allowArbitrary: boolean;
  kind: BoxKind;
  mode: BoxFieldMode;
  unit: BoxUnit;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (focus: BoxFocus) => void;
  value: string;
}) {
  if (props.mode === "sides") {
    return (
      <div className="grid min-w-0 grid-cols-4 gap-1.5">
        {sides.map((side) => (
          <BoxValueField
            accent={props.accent}
            allowArbitrary={props.allowArbitrary}
            hint={sideSuffix[side]}
            key={side}
            kind={props.kind}
            unit={props.unit}
            label={`${props.kind} ${side}`}
            value={readBoxValue(props.value, props.kind, side)}
            onBlur={props.onBlur}
            onChange={(next) => props.onChange(setBoxValue(props.value, props.kind, side, next))}
            onFocus={() => props.onFocus({ kind: props.kind, side })}
            onStep={(direction) => props.onChange(setBoxValue(
              props.value,
              props.kind,
              side,
              `${steppedPixels(props.kind, readBoxValue(props.value, props.kind, side), direction)}px`,
            ))}
          />
        ))}
      </div>
    );
  }

  if (props.mode === "axis") {
    return (
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        {(["x", "y"] as const).map((axis) => (
          <BoxValueField
            accent={props.accent}
            allowArbitrary={props.allowArbitrary}
            icon={axis === "x" ? MoveHorizontal : MoveVertical}
            key={axis}
            kind={props.kind}
            unit={props.unit}
            label={`${props.kind} ${axis === "x" ? "horizontal" : "vertical"}`}
            value={readBoxAxis(props.value, props.kind, axis) ?? ""}
            onBlur={props.onBlur}
            onChange={(next) => props.onChange(setBoxAxisValue(props.value, props.kind, axis, next))}
            onFocus={() => props.onFocus({ kind: props.kind, side: axisSides[axis][0]! })}
            onStep={(direction) => props.onChange(setBoxAxisValue(
              props.value,
              props.kind,
              axis,
              `${steppedPixels(props.kind, readBoxAxis(props.value, props.kind, axis) ?? "", direction)}px`,
            ))}
          />
        ))}
      </div>
    );
  }

  return (
    <BoxValueField
      accent={props.accent}
      allowArbitrary={props.allowArbitrary}
      icon={Link2}
      kind={props.kind}
      unit={props.unit}
      label={`${props.kind} all sides`}
      value={readBoxValue(props.value, props.kind, "top")}
      onBlur={props.onBlur}
      onChange={(next) => props.onChange(setBoxUniformValue(props.value, props.kind, next))}
      onFocus={() => props.onFocus({ kind: props.kind, side: "all" })}
      onStep={(direction) => props.onChange(setBoxUniformValue(
        props.value,
        props.kind,
        `${steppedPixels(props.kind, readBoxValue(props.value, props.kind, "top"), direction)}px`,
      ))}
    />
  );
}

function BoxValueField(props: {
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

function BoxKindIcon(props: { active: boolean; kind: BoxKind }) {
  const color = `hsl(${boxHue[props.kind]} 74% 60%)`;
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#191b20]"
      data-box-kind-icon={props.kind}
      style={{ color, opacity: props.active ? 1 : 0.72 }}
    >
      <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
        {props.kind === "border" ? (
          <>
            <rect height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" width="10" x="3" y="3" />
            <rect height="5" rx="1" stroke="currentColor" strokeOpacity="0.38" width="5" x="5.5" y="5.5" />
          </>
        ) : (
          <>
            <rect height="8" rx="1.3" stroke="currentColor" strokeOpacity="0.4" width="8" x="4" y="4" />
            <path
              d={props.kind === "padding" ? "M2 8h4m8 0h-4M4 6l2 2-2 2m8-4-2 2 2 2" : "M6 8H2m12 0h-4M4 6 2 8l2 2m8-4 2 2-2 2"}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.35"
            />
          </>
        )}
      </svg>
    </span>
  );
}

function PrecisionIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path d="M2 4h10M2 10h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
      <circle cx="5" cy="4" fill="#15161a" r="1.7" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9" cy="10" fill="#15161a" r="1.7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function BoxModeButton(props: { icon: LucideIcon; isOn: boolean; label: string; onPress: () => void }) {
  return (
    <Button
      isIconOnly
      aria-label={props.label}
      aria-pressed={props.isOn}
      className={`size-7 !min-h-0 !min-w-0 rounded-lg !p-0 transition-colors ${
        props.isOn ? "bg-[#25272e] text-zinc-200" : "text-zinc-600 hover:bg-[#1d1f24] hover:text-zinc-300"
      }`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <props.icon aria-hidden="true" size={12} />
    </Button>
  );
}

type BoxFieldMode = "all" | "axis" | "sides";
const fieldModeDetail: Record<BoxFieldMode, number> = { all: 0, axis: 1, sides: 2 };

function coarserOf(requested: BoxFieldMode, natural: BoxFieldMode): BoxFieldMode {
  return fieldModeDetail[requested] >= fieldModeDetail[natural] ? requested : natural;
}

function naturalFieldMode(className: string, kind: BoxKind): BoxFieldMode {
  const [top, right, bottom, left] = sides.map((side) => readBoxValue(className, kind, side));
  if (top === right && right === bottom && bottom === left) return "all";
  if (top === bottom && left === right) return "axis";
  return "sides";
}

function collapseToMode(className: string, kind: BoxKind, target: BoxFieldMode): string {
  if (target === "all") return setBoxUniformValue(className, kind, readBoxValue(className, kind, "top"));
  if (target === "axis") {
    const vertical = setBoxAxisValue(className, kind, "y", readBoxValue(className, kind, "top"));
    return setBoxAxisValue(vertical, kind, "x", readBoxValue(className, kind, "left"));
  }
  return className;
}

function snapRowToTailwind(className: string, kind: BoxKind): string {
  return sides.reduce((current, side) => {
    const pixels = parseBoxLengthPixels(readBoxValue(className, kind, side)) ?? 0;
    return setBoxValue(current, kind, side, `${snapBoxPixels(kind, pixels)}px`);
  }, className);
}

function snappedFieldValue(kind: BoxKind, value: string): string | undefined {
  const pixels = parseBoxLengthPixels(value.trim());
  return pixels === undefined ? undefined : `${snapBoxPixels(kind, pixels)}px`;
}

function steppedPixels(kind: BoxKind, display: string, direction: number): number {
  const steps = boxLadder(kind);
  const current = parseBoxLengthPixels(display) ?? 0;
  return steps[clamp(nearestLadderIndex(kind, current) + direction, 0, steps.length - 1)] ?? 0;
}

function unitName(unit: BoxUnit): string {
  if (unit === "tailwind") return "Tailwind";
  return unit;
}

function compactTickIndexes(length: number): number[] {
  const last = Math.max(0, length - 1);
  return [0, Math.round(last * 0.25), Math.round(last * 0.5), Math.round(last * 0.75), last]
    .filter((index, position, indexes) => indexes.indexOf(index) === position);
}
