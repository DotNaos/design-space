import { Button, Label, Slider, Tooltip } from "@heroui/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { startTransition, useRef, useState } from "react";
import { replaceTailwindUtilityGroup } from "./tailwind-utility";
import { UtilityGroup, compactSliderLabel, findBaseSelection, optionValues, sliderLabelIndexes, snapSliderIndex } from "./TailwindMappedControls";

export function SliderUtilityControl(props: {
  current: string;
  group: UtilityGroup;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const selection = findBaseSelection(props.current, props.group);
  const [interactionIndex, setInteractionIndex] = useState<number>();
  const pendingIndex = useRef<number | undefined>(undefined);
  const Icon = props.group.icon ?? Sparkles;
  const steps = [{ label: "Auto", value: "" }, ...props.group.options];
  const labelIndexes = sliderLabelIndexes(props.group.id, steps.length);
  const selectedIndex = selection.custom ? 0 : Math.max(0, steps.findIndex((step) => step.value === selection.utility));
  const displayedIndex = interactionIndex ?? selectedIndex;
  const output = interactionIndex === undefined && selection.custom
    ? `Custom · ${selection.token}`
    : steps[displayedIndex]?.label ?? "Auto";
  const indexOf = (next: number | number[]) => (
    snapSliderIndex(Array.isArray(next) ? next[0] : next, steps.length - 1)
  );
  const valueAt = (index: number) => replaceTailwindUtilityGroup(
    props.current,
    optionValues(props.group),
    steps[index]?.value ?? "",
    props.group.matches,
  );
  const previewIndex = (next: number | number[]) => {
    const index = snapSliderIndex(Array.isArray(next) ? next[0] : next, steps.length - 1);
    pendingIndex.current = index;
    setInteractionIndex(index);
    startTransition(() => props.onPreviewChange?.(valueAt(index)));
  };
  const commitIndex = (index: number) => {
    pendingIndex.current = undefined;
    setInteractionIndex(undefined);
    const value = valueAt(index);
    if (value !== props.current) props.onChange(value);
    startTransition(() => props.onPreviewChange?.());
  };
  const commitPending = () => {
    if (pendingIndex.current === undefined) return;
    commitIndex(pendingIndex.current);
  };
  const reset = () => {
    pendingIndex.current = undefined;
    setInteractionIndex(undefined);
    props.onChange(valueAt(0));
    startTransition(() => props.onPreviewChange?.());
  };
  return (
    <div onBlurCapture={commitPending} onPointerCancelCapture={commitPending}>
      <Slider
        aria-label={`${props.group.label} Tailwind value`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2"
        maxValue={steps.length - 1}
        minValue={0}
        step={1}
        value={displayedIndex}
        onChange={previewIndex}
        onChangeEnd={(next) => commitIndex(indexOf(next))}
      >
        <Label className="flex items-center gap-1.5 text-[9px] text-zinc-500">
          <Icon aria-hidden="true" className="text-zinc-600" size={11} />
          {props.group.label}
        </Label>
        <span className="flex items-center gap-1">
          <Slider.Output className={`max-w-36 truncate text-[9px] ${selection.custom ? "text-amber-300/80" : "text-zinc-400"}`}>{output}</Slider.Output>
          <Tooltip delay={350} closeDelay={80}>
            <Button
              isIconOnly
              aria-label={`Reset ${props.group.label} to Auto`}
              className="size-6 min-w-6 rounded text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
              size="sm"
              variant="ghost"
              onPress={reset}
            >
              <RotateCcw aria-hidden="true" size={11} />
            </Button>
            <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">Reset {props.group.label} to Auto</Tooltip.Content>
          </Tooltip>
        </span>
        <Slider.Track data-slider-group={props.group.id} className="relative col-span-2 mx-3.5 mt-0.5 !h-8 w-[calc(100%-1.75rem)] cursor-pointer !border-x-0 !bg-transparent">
          <span className="absolute left-0 top-2 h-1 w-full -translate-y-1/2 rounded-full bg-[#33363d]" />
          <Slider.Fill className="absolute left-0 top-2 !h-1 -translate-y-1/2 rounded-full !bg-[#2997ff]" />
          {steps.map((step, index) => (
            <span
              key={`${props.group.id}-${step.value || "auto"}`}
              aria-hidden="true"
              className="pointer-events-none absolute top-[23px] h-0.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#686b73]"
              data-slider-step={step.value || "auto"}
              style={{ left: `${steps.length === 1 ? 0 : (index / (steps.length - 1)) * 100}%` }}
            />
          ))}
          <Slider.Thumb
            aria-valuetext={output}
            className="!top-2 !h-7 !w-8 !rounded-none !bg-transparent !shadow-none outline-none ring-offset-2 ring-offset-[#141518] after:!h-4 after:!w-7 after:!rounded-full after:!border-0 after:!bg-[#f4f5f7] after:!shadow-[0_1px_2px_#000000,0_3px_8px_#000000] data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#2997ff]"
            data-slider-thumb-shape="horizontal-pill"
          />
        </Slider.Track>
        <div aria-hidden="true" className="relative col-span-2 mx-3.5 h-3.5 w-[calc(100%-1.75rem)]" data-slider-labels={props.group.id}>
          {labelIndexes.map((index) => (
            <span
              key={`${props.group.id}-label-${index}`}
              className="absolute top-0 whitespace-nowrap text-[8px] font-medium tracking-[-0.01em] text-zinc-600"
              data-slider-label={steps[index]?.value || "auto"}
              style={{
                left: `${steps.length === 1 ? 0 : (index / (steps.length - 1)) * 100}%`,
                transform: index === 0 ? "none" : index === steps.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {compactSliderLabel(steps[index]?.label ?? "")}
            </span>
          ))}
        </div>
      </Slider>
    </div>
  );
}
