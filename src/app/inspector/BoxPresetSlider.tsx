import { Slider } from "@heroui/react";
import { useRef } from "react";
import { boxLadder, clamp, formatBoxUnitValue, nearestLadderIndex, parseBoxLengthPixels, type BoxKind, type BoxUnit } from "./tailwind-box-model-values";
import { compactTickIndexes, unitName } from "./TailwindBoxModelValueRows";

export function BoxPresetSlider(props: {
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
