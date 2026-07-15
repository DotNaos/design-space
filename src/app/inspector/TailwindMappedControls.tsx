import { Button, Label, Slider, Tooltip } from "@heroui/react";
import {
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignStartVertical,
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
  StretchHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { EditorSelectField, type EditorSelectOption } from "../components/EditorSelectField";

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
  {
    id: "align",
    label: "Align",
    options: [
      { label: "Start", value: "items-start", icon: AlignStartVertical },
      { label: "Center", value: "items-center", icon: AlignCenterVertical },
      { label: "End", value: "items-end", icon: AlignEndVertical },
      { label: "Stretch", value: "items-stretch", icon: StretchHorizontal },
    ],
    matches: match(/^items-(?:start|end(?:-safe)?|center(?:-safe)?|baseline(?:-last)?|stretch)$/),
  },
  {
    id: "justify",
    label: "Justify",
    options: [
      { label: "Start", value: "justify-start", icon: AlignHorizontalJustifyStart },
      { label: "Center", value: "justify-center", icon: AlignHorizontalJustifyCenter },
      { label: "End", value: "justify-end", icon: AlignHorizontalJustifyEnd },
      { label: "Space between", value: "justify-between", icon: AlignHorizontalSpaceBetween },
    ],
    matches: match(/^justify-(?:normal|start|end(?:-safe)?|center(?:-safe)?|between|around|evenly|stretch|baseline)$/),
  },
];

const spacingGroups: readonly UtilityGroup[] = [
  scaleGroup("gap", "Gap", "gap", /^gap-(?![xy]-).+$/),
  scaleGroup("gap-x", "Gap X", "gap-x", /^gap-x-.+$/),
  scaleGroup("gap-y", "Gap Y", "gap-y", /^gap-y-.+$/),
  scaleGroup("padding", "Padding", "p", /^p-.+$/),
  scaleGroup("padding-x", "Padding X", "px", /^px-.+$/),
  scaleGroup("padding-y", "Padding Y", "py", /^py-.+$/),
];

const sizeGroups: readonly UtilityGroup[] = [
  keywordGroup("width", "Width", "w", /^w-.+$/),
  keywordGroup("height", "Height", "h", /^h-.+$/),
];

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

export function TailwindMappedControls(props: { value: string; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Visual Tailwind controls</legend>
      <div className="divide-y divide-white/[0.06]">
        <ControlSection initialOpen icon={LayoutGrid} title="Layout">
          <div className="grid grid-cols-1 gap-y-3">
            {segmentedGroups.map((group) => (
              <SegmentedUtilityControl key={group.id} current={props.value} group={group} onChange={props.onChange} />
            ))}
          </div>
        </ControlSection>
        <ControlSection initialOpen icon={MoveDiagonal2} title="Spacing">
          <SliderGrid current={props.value} groups={spacingGroups} onChange={props.onChange} />
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

export function replaceTailwindUtilityGroup(
  current: string,
  group: readonly string[],
  next: string,
  matches: (utility: string) => boolean = (utility) => group.includes(utility),
): string {
  const candidates = new Set(group);
  const tokens = current.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let replaced = false;

  for (const token of tokens) {
    const parsed = parseTailwindToken(token);
    const belongsToGroup = !parsed.modified && (candidates.has(parsed.utility) || matches(parsed.utility));
    if (!belongsToGroup) {
      result.push(token);
      continue;
    }
    if (!replaced && next) result.push(withImportance(next, parsed.importance));
    replaced = true;
  }

  if (!replaced && next) result.push(next);
  return result.join(" ");
}

function SegmentedUtilityControl(props: {
  current: string;
  group: UtilityGroup;
  onChange: (value: string) => void;
}) {
  const selection = findBaseSelection(props.current, props.group);
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
          onPress={() => props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(props.group), "", props.group.matches))}
        />
        {props.group.options.map((option) => (
          <SegmentButton
            key={option.value}
            active={!selection.custom && selection.utility === option.value}
            icon={option.icon ?? Square}
            label={`${props.group.label}: ${option.label}`}
            onPress={() => props.onChange(replaceTailwindUtilityGroup(props.current, optionValues(props.group), option.value, props.group.matches))}
          />
        ))}
      </div>
    </div>
  );
}

function SegmentButton(props: { active: boolean; icon: LucideIcon; label: string; onPress: () => void }) {
  const Icon = props.icon;
  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`min-h-9 min-w-0 flex-1 rounded-md px-0 transition-colors ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        <Icon aria-hidden="true" size={14} strokeWidth={1.7} />
      </Button>
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
          <button
            aria-label={`Reset ${props.group.label} to Auto`}
            className="grid size-6 place-items-center rounded text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
            type="button"
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" size={11} />
          </button>
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
        <button
          aria-expanded={open}
          className="flex min-h-9 w-full items-center gap-1.5 text-left text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon aria-hidden="true" className="text-zinc-600" size={12} />
          <span className="flex-1">{props.title}</span>
          <ChevronDown aria-hidden="true" className={`text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`} size={13} />
        </button>
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

function parseTailwindToken(token: string) {
  let bracketDepth = 0;
  let variantEnd = -1;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "[") bracketDepth += 1;
    else if (token[index] === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (token[index] === ":" && bracketDepth === 0) variantEnd = index;
  }
  const rawUtility = token.slice(variantEnd + 1);
  const importance = rawUtility.startsWith("!") ? "prefix" : rawUtility.endsWith("!") ? "suffix" : undefined;
  return {
    modified: variantEnd >= 0,
    utility: rawUtility.replace(/^!/, "").replace(/!$/, ""),
    importance,
  } as const;
}

function withImportance(value: string, importance: "prefix" | "suffix" | undefined): string {
  if (importance === "prefix") return `!${value}`;
  if (importance === "suffix") return `${value}!`;
  return value;
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
