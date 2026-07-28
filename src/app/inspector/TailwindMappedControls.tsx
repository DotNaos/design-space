import { Button, Label, Slider, ToggleButton, Tooltip } from "@heroui/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Columns3,
  EyeOff,
  LayoutGrid,
  Minus,
  MoveDiagonal2,
  RotateCcw,
  Scaling,
  Sparkles,
  Square,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { EditorSelectField, type EditorSelectOption } from "../components/EditorSelectField/EditorSelectField";
import { TailwindAlignmentControl } from "./TailwindAlignmentControl";
import { TailwindBoxModelControl } from "./TailwindBoxModelControl";
import { parseTailwindToken, replaceTailwindUtilityGroup } from "./tailwind-utility";

export { replaceTailwindUtilityGroup } from "./tailwind-utility";

type UtilityOption = { label: string; value: string; icon?: LucideIcon };
type UtilityGroup = {
  id: string;
  label: string;
  options: readonly UtilityOption[];
  matches: (utility: string) => boolean;
};

const segmentedGroups: readonly UtilityGroup[] = [
  {
    id: "display",
    label: "Display",
    options: [
      { label: "Block", value: "block", icon: Square },
      { label: "Flex", value: "flex", icon: Columns3 },
      { label: "Grid", value: "grid", icon: LayoutGrid },
      { label: "Hidden", value: "hidden", icon: EyeOff },
    ],
    matches: match(/^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|list-item|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row)$/),
  },
  {
    id: "direction",
    label: "Direction",
    options: [
      { label: "Row", value: "flex-row", icon: ArrowRight },
      { label: "Column", value: "flex-col", icon: ArrowDown },
      { label: "Row reverse", value: "flex-row-reverse", icon: ArrowLeft },
      { label: "Column reverse", value: "flex-col-reverse", icon: ArrowUp },
    ],
    matches: match(/^flex-(?:row|row-reverse|col|col-reverse)$/),
  },
];

const spacingGroups: readonly UtilityGroup[] = [
  scaleGroup("gap", "Gap", "gap", /^gap-(?![xy]-).+$/),
  scaleGroup("gap-x", "Gap X", "gap-x", /^gap-x-.+$/),
  scaleGroup("gap-y", "Gap Y", "gap-y", /^gap-y-.+$/),
];

const sizeGroups: readonly UtilityGroup[] = [
  keywordGroup("width", "Width", "w", /^w-.+$/),
  keywordGroup("height", "Height", "h", /^h-.+$/),
];

const gridColumnsGroup: UtilityGroup = {
  id: "grid-columns",
  label: "Columns",
  options: labeledOptions([
    ["1", "grid-cols-1"],
    ["2", "grid-cols-2"],
    ["3", "grid-cols-3"],
    ["4", "grid-cols-4"],
    ["5", "grid-cols-5"],
    ["6", "grid-cols-6"],
    ["12", "grid-cols-12"],
  ]),
  matches: match(/^grid-cols-.+$/),
};

const appearanceGroups: readonly UtilityGroup[] = [
  {
    id: "radius",
    label: "Radius",
    options: labeledOptions([
      ["None", "rounded-none"],
      ["Small", "rounded-sm"],
      ["Default", "rounded"],
      ["Medium", "rounded-md"],
      ["Large", "rounded-lg"],
      ["Extra large", "rounded-xl"],
      ["2× extra large", "rounded-2xl"],
      ["Full", "rounded-full"],
    ]),
    matches: match(/^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full)|-\[.+\])?$/),
  },
  {
    id: "opacity",
    label: "Opacity",
    options: labeledOptions([
      ["0%", "opacity-0"],
      ["25%", "opacity-25"],
      ["50%", "opacity-50"],
      ["75%", "opacity-75"],
      ["100%", "opacity-100"],
    ]),
    matches: match(/^opacity-.+$/),
  },
  {
    id: "shadow",
    label: "Shadow",
    options: labeledOptions([
      ["None", "shadow-none"],
      ["Small", "shadow-sm"],
      ["Default", "shadow"],
      ["Medium", "shadow-md"],
      ["Large", "shadow-lg"],
      ["Extra large", "shadow-xl"],
      ["2× extra large", "shadow-2xl"],
    ]),
    matches: matchesShadowSizeUtility,
  },
];

export function TailwindMappedControls(props: {
  value: string;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const layout = baseLayoutDisplay(props.value);
  return (
    <fieldset>
      <legend className="sr-only">Visual Tailwind controls</legend>
      <div className="divide-y divide-white/[0.06]">
        <ControlSection initialOpen icon={LayoutGrid} title="Layout">
          <div className="grid grid-cols-1 gap-y-3">
            <SegmentedUtilityControl current={props.value} group={segmentedGroups[0]!} onChange={props.onChange} onPreviewChange={props.onPreviewChange} />
            {layout === "flex" && (
              <SegmentedUtilityControl current={props.value} group={segmentedGroups[1]!} onChange={props.onChange} onPreviewChange={props.onPreviewChange} />
            )}
            {layout === "grid" && (
              <SelectGrid current={props.value} groups={[gridColumnsGroup]} onChange={props.onChange} />
            )}
            {(layout === "flex" || layout === "grid") && (
              <TailwindAlignmentControl value={props.value} onChange={props.onChange} onPreviewChange={props.onPreviewChange} />
            )}
          </div>
        </ControlSection>
        <ControlSection initialOpen icon={MoveDiagonal2} title="Spacing">
          <SliderGrid current={props.value} groups={spacingGroups} onChange={props.onChange} />
          <div className="mt-4">
            <TailwindBoxModelControl value={props.value} onChange={props.onChange} />
          </div>
        </ControlSection>
        <ControlSection icon={Scaling} title="Size">
          <SelectGrid current={props.value} groups={sizeGroups} onChange={props.onChange} />
        </ControlSection>
        <ControlSection icon={Sparkles} title="Appearance">
          <SliderGrid current={props.value} groups={appearanceGroups} onChange={props.onChange} />
        </ControlSection>
      </div>
    </fieldset>
  );
}

function SegmentedUtilityControl(props: {
  current: string;
  group: UtilityGroup;
  onChange: (value: string) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const selection = findBaseSelection(props.current, props.group);
  const valueFor = (next: string) => replaceSegmentedUtility(props.current, props.group, next);
  const change = (next: string) => props.onChange(valueFor(next));
  return (
    <div className="min-w-0">
      <div className="mb-1 flex min-h-4 items-center gap-1.5">
        <span className="text-[9px] text-zinc-600">{props.group.label}</span>
        {selection.custom && <span className="min-w-0 truncate text-[8px] text-amber-300/80">Custom · {selection.token}</span>}
      </div>
      <div className="flex min-h-10 overflow-hidden rounded-lg border border-white/10 bg-black/20 p-0.5">
        <SegmentButton
          active={!selection.token}
          icon={Minus}
          label={`${props.group.label}: Auto`}
          onPreview={() => props.onPreviewChange?.(valueFor(""))}
          onPreviewEnd={() => props.onPreviewChange?.()}
          onPress={() => change("")}
        />
        {props.group.options.map((option) => (
          <SegmentButton
            key={option.value}
            active={!selection.custom && selection.utility === option.value}
            icon={option.icon ?? Square}
            label={`${props.group.label}: ${option.label}`}
            onPreview={() => props.onPreviewChange?.(valueFor(option.value))}
            onPreviewEnd={() => props.onPreviewChange?.()}
            onPress={() => change(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function replaceSegmentedUtility(current: string, group: UtilityGroup, next: string): string {
  let prepared = current;
  if (next && group.id === "direction" && !hasBaseLayoutDisplay(current, /^(?:flex|inline-flex)$/)) {
    prepared = replaceDisplayUtility(current, "flex");
  }
  return replaceTailwindUtilityGroup(prepared, optionValues(group), next, group.matches);
}

function replaceDisplayUtility(current: string, next: string): string {
  const display = segmentedGroups[0]!;
  return replaceTailwindUtilityGroup(current, optionValues(display), next, display.matches);
}

function hasBaseLayoutDisplay(current: string, pattern: RegExp): boolean {
  return current.split(/\s+/).filter(Boolean).some((token) => {
    const parsed = parseTailwindToken(token);
    return !parsed.modified && pattern.test(parsed.utility);
  });
}

function baseLayoutDisplay(current: string): "flex" | "grid" | "other" {
  if (hasBaseLayoutDisplay(current, /^(?:flex|inline-flex)$/)) return "flex";
  if (hasBaseLayoutDisplay(current, /^(?:grid|inline-grid)$/)) return "grid";
  return "other";
}

function SegmentButton(props: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onPreview?: () => void;
  onPreviewEnd?: () => void;
  onPress: () => void;
}) {
  const Icon = props.icon;
  return (
    <Tooltip delay={350} closeDelay={80}>
      <ToggleButton
        isIconOnly
        aria-label={props.label}
        className={`min-h-9 min-w-0 flex-1 rounded-md px-0 transition-colors ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300"}`}
        isSelected={props.active}
        size="sm"
        variant="ghost"
        onPointerEnter={props.onPreview}
        onPointerLeave={props.onPreviewEnd}
        onChange={props.onPress}
      >
        <Icon aria-hidden="true" size={14} strokeWidth={1.7} />
      </ToggleButton>
      <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{props.label}</Tooltip.Content>
    </Tooltip>
  );
}

function SliderGrid(props: { current: string; groups: readonly UtilityGroup[]; onChange: (value: string) => void }) {
  return <div className="grid gap-3">{props.groups.map((group) => <SliderUtilityControl key={group.id} {...props} group={group} />)}</div>;
}

function SliderUtilityControl(props: { current: string; group: UtilityGroup; onChange: (value: string) => void }) {
  const selection = findBaseSelection(props.current, props.group);
  const steps = [{ label: "Auto", value: "" }, ...props.group.options];
  const selectedIndex = selection.custom ? 0 : Math.max(0, steps.findIndex((step) => step.value === selection.utility));
  const output = selection.custom ? `Custom · ${selection.token}` : steps[selectedIndex]?.label ?? "Auto";
  const setIndex = (next: number | number[]) => {
    const index = snapSliderIndex(Array.isArray(next) ? next[0] : next, steps.length - 1);
    const value = steps[index]?.value ?? "";
    props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(props.group), value, props.group.matches));
  };
  const reset = () => props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(props.group), "", props.group.matches));
  return (
    <Slider
      aria-label={`${props.group.label} Tailwind value`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
      maxValue={steps.length - 1}
      minValue={0}
      step={1}
      value={selectedIndex}
      onChange={setIndex}
    >
      <Label className="text-[9px] text-zinc-600">{props.group.label}</Label>
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
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">Reset {props.group.label} to Auto</Tooltip.Content>
        </Tooltip>
      </span>
      <Slider.Track data-slider-group={props.group.id} className="relative col-span-2 h-7 w-full cursor-pointer">
        <span className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/10" />
        <Slider.Fill className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-sky-400" />
        {steps.map((step, index) => (
          <span
            key={`${props.group.id}-${step.value || "auto"}`}
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 rounded-full ${!selection.custom && index === selectedIndex ? "bg-sky-100" : "bg-zinc-500/80"}`}
            data-slider-step={step.value || "auto"}
            style={{ left: `${steps.length === 1 ? 0 : (index / (steps.length - 1)) * 100}%` }}
          />
        ))}
        <Slider.Thumb
          aria-valuetext={output}
          className="top-1/2 size-5 rounded-full border-2 border-[#141518] bg-sky-300 shadow-md outline-none ring-offset-2 ring-offset-[#141518] data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-300"
        />
      </Slider.Track>
    </Slider>
  );
}

export function snapSliderIndex(value: number | undefined, maxIndex: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || maxIndex <= 0) return 0;
  return Math.max(0, Math.min(maxIndex, Math.round(value)));
}

function SelectGrid(props: { current: string; groups: readonly UtilityGroup[]; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {props.groups.map((group) => {
        const selection = findBaseSelection(props.current, group);
        return (
          <EditorSelectField
            key={group.id}
            ariaLabel={`${group.label} Tailwind utility`}
            density="compact"
            label={group.label}
            options={selectOptions(group, selection)}
            value={selection.token}
            onChange={(value) => props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(group), value, group.matches))}
          />
        );
      })}
    </div>
  );
}

function ControlSection(props: { icon: LucideIcon; title: string; children: React.ReactNode; initialOpen?: boolean }) {
  const Icon = props.icon;
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  return (
    <section className="py-1 first:pt-0">
      <h4>
        <Button
          aria-expanded={open}
          className="flex min-h-9 w-full items-center justify-start gap-1.5 rounded-none px-0 text-left text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
          variant="ghost"
          onPress={() => setOpen((value) => !value)}
        >
          <Icon aria-hidden="true" className="text-zinc-600" size={12} />
          <span className="flex-1">{props.title}</span>
          <ChevronDown aria-hidden="true" className={`text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`} size={13} />
        </Button>
      </h4>
      {open && <div className="pb-3">{props.children}</div>}
    </section>
  );
}

function findBaseSelection(current: string, group: UtilityGroup) {
  for (const token of current.split(/\s+/).filter(Boolean)) {
    const parsed = parseTailwindToken(token);
    if (parsed.modified || !group.matches(parsed.utility)) continue;
    const known = group.options.some((option) => option.value === parsed.utility);
    return { token: known ? parsed.utility : token, utility: parsed.utility, custom: !known };
  }
  return { token: "", utility: "", custom: false };
}

function selectOptions(group: UtilityGroup, selection: ReturnType<typeof findBaseSelection>): EditorSelectOption[] {
  return [
    { id: `${group.id}-auto`, value: "", label: "Auto" },
    ...(selection.custom ? [{ id: `${group.id}-custom`, value: selection.token, label: `Custom · ${selection.token}`, disabled: true }] : []),
    ...group.options.map((option) => ({ id: `${group.id}-${option.value}`, value: option.value, label: option.label })),
  ];
}

function optionValues(group: UtilityGroup): string[] {
  return group.options.map((option) => option.value);
}

function scaleGroup(id: string, label: string, prefix: string, pattern: RegExp): UtilityGroup {
  return {
    id,
    label,
    options: labeledOptions([
      ["0", `${prefix}-0`],
      ["4 px", `${prefix}-1`],
      ["8 px", `${prefix}-2`],
      ["12 px", `${prefix}-3`],
      ["16 px", `${prefix}-4`],
      ["20 px", `${prefix}-5`],
      ["24 px", `${prefix}-6`],
      ["28 px", `${prefix}-7`],
      ["32 px", `${prefix}-8`],
    ]),
    matches: match(pattern),
  };
}

function keywordGroup(id: string, label: string, prefix: string, pattern: RegExp): UtilityGroup {
  return {
    id,
    label,
    options: labeledOptions([
      ["CSS auto", `${prefix}-auto`],
      ["Full", `${prefix}-full`],
      ["Screen", `${prefix}-screen`],
      ["Fit content", `${prefix}-fit`],
      ["Min content", `${prefix}-min`],
      ["Max content", `${prefix}-max`],
    ]),
    matches: match(pattern),
  };
}

function labeledOptions(values: ReadonlyArray<readonly [string, string]>): UtilityOption[] {
  return values.map(([label, value]) => ({ label, value }));
}

function match(pattern: RegExp) {
  return (utility: string) => pattern.test(utility);
}

function matchesShadowSizeUtility(utility: string): boolean {
  if (/^shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|none))?$/.test(utility)) return true;
  const variable = /^shadow-\((.+)\)$/.exec(utility)?.[1]?.trim();
  if (variable) return !variable.toLowerCase().startsWith("color:");
  const arbitrary = /^shadow-\[(.+)\]$/.exec(utility)?.[1]?.trim();
  if (!arbitrary || arbitrary.toLowerCase().startsWith("color:")) return false;
  return /^(?:none|inherit|initial|revert(?:-layer)?|unset|-?(?:\d|\.\d)|inset(?:_|$)|var\(|(?:calc|min|max|clamp)\()/i.test(arbitrary);
}
