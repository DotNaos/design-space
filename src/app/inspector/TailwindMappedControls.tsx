
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Columns3, EyeOff, LayoutGrid, MoveDiagonal2, Scaling, Sparkles, Square, type LucideIcon } from "lucide-react";

import { type EditorSelectOption } from "../components/EditorSelectField/EditorSelectField";
import { TailwindAlignmentControl } from "./TailwindAlignmentControl";
import { TailwindBoxModelControl } from "./TailwindBoxModelControl";
import type { BoxModelPreview } from "./tailwind-box-model-values";
import { TailwindSizeControl } from "./TailwindSizeControl";
import { parseTailwindToken, replaceTailwindUtilityGroup } from "./tailwind-utility";
import { SegmentedUtilityControl } from "./SegmentedUtilityControl";
import { SliderGrid } from "./SliderGrid";
import { SelectGrid } from "./SelectGrid";
import { ControlSection } from "./ControlSection";

export { replaceTailwindUtilityGroup } from "./tailwind-utility";

type UtilityOption = { label: string; value: string; icon?: LucideIcon };
export type UtilityGroup = {
  id: string;
  label: string;
  icon?: LucideIcon;
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
  scaleGroup("gap", "Gap", "gap", /^gap-(?![xy]-).+$/, Columns3),
  scaleGroup("gap-x", "Gap X", "gap-x", /^gap-x-.+$/, ArrowRight),
  scaleGroup("gap-y", "Gap Y", "gap-y", /^gap-y-.+$/, ArrowDown),
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
    icon: Square,
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
    icon: EyeOff,
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
    icon: Sparkles,
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
  onBoxModelPreviewChange?: (preview?: BoxModelPreview) => void;
  onPreviewChange?: (value?: string) => void;
}) {
  const layout = baseLayoutDisplay(props.value);
  const showGap = layout === "flex" || layout === "grid" || hasBaseGap(props.value);
  return (
    <fieldset>
      <legend className="sr-only">Visual Tailwind controls</legend>
      <div className="divide-y divide-white/[0.06]">
        <ControlSection icon={LayoutGrid} title="Layout">
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
        <ControlSection icon={MoveDiagonal2} title="Spacing">
          {showGap ? (
            <SliderGrid
              current={props.value}
              groups={spacingGroups}
              onChange={props.onChange}
              onPreviewChange={props.onPreviewChange}
            />
          ) : null}
          <div className={showGap ? "mt-3" : ""}>
            <TailwindBoxModelControl
              value={props.value}
              onChange={props.onChange}
              onBoxModelPreviewChange={props.onBoxModelPreviewChange}
              onPreviewChange={props.onPreviewChange}
            />
          </div>
        </ControlSection>
        <ControlSection icon={Scaling} title="Size">
          <TailwindSizeControl value={props.value} onChange={props.onChange} />
        </ControlSection>
        <ControlSection icon={Sparkles} title="Appearance">
          <SliderGrid
            current={props.value}
            groups={appearanceGroups}
            onChange={props.onChange}
            onPreviewChange={props.onPreviewChange}
          />
        </ControlSection>
      </div>
    </fieldset>
  );
}

export function replaceSegmentedUtility(current: string, group: UtilityGroup, next: string): string {
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

function hasBaseGap(current: string): boolean {
  return current.split(/\s+/).filter(Boolean).some((token) => {
    const parsed = parseTailwindToken(token);
    return !parsed.modified && /^gap(?:-[xy])?-.+$/.test(parsed.utility);
  });
}

export function sliderLabelIndexes(groupId: string, stepCount: number): number[] {
  const preferred: Record<string, number[]> = {
    radius: [0, 2, 4, 6, 8],
    opacity: [0, 1, 3, 5],
    shadow: [0, 2, 4, 5, 7],
  };
  return (preferred[groupId] ?? [0, Math.floor((stepCount - 1) / 2), stepCount - 1])
    .filter((index, position, indexes) => index >= 0 && index < stepCount && indexes.indexOf(index) === position);
}

export function compactSliderLabel(label: string): string {
  if (label === "Extra large") return "XL";
  if (label === "2× extra large") return "2XL";
  return label;
}

export function snapSliderIndex(value: number | undefined, maxIndex: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || maxIndex <= 0) return 0;
  return Math.max(0, Math.min(maxIndex, Math.round(value)));
}

export function findBaseSelection(current: string, group: UtilityGroup) {
  for (const token of current.split(/\s+/).filter(Boolean)) {
    const parsed = parseTailwindToken(token);
    if (parsed.modified || !group.matches(parsed.utility)) continue;
    const known = group.options.some((option) => option.value === parsed.utility);
    return { token: known ? parsed.utility : token, utility: parsed.utility, custom: !known };
  }
  return { token: "", utility: "", custom: false };
}

export function selectOptions(group: UtilityGroup, selection: ReturnType<typeof findBaseSelection>): EditorSelectOption[] {
  return [
    { id: `${group.id}-auto`, value: "", label: "Auto" },
    ...(selection.custom ? [{ id: `${group.id}-custom`, value: selection.token, label: `Custom · ${selection.token}`, disabled: true }] : []),
    ...group.options.map((option) => ({ id: `${group.id}-${option.value}`, value: option.value, label: option.label })),
  ];
}

export function optionValues(group: UtilityGroup): string[] {
  return group.options.map((option) => option.value);
}

function scaleGroup(id: string, label: string, prefix: string, pattern: RegExp, icon?: LucideIcon): UtilityGroup {
  return {
    id,
    label,
    icon,
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
