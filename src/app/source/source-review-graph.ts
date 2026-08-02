import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceReviewGraphProperty, SourceReviewGraphSlot } from "./SourceReviewGraphStage";

export function sourceReviewGraphProperties(options: {
  caseValues?: Readonly<Record<string, unknown>>;
  defaults?: Readonly<Record<string, unknown>>;
  entry?: RuntimeSourceWorkspaceEntry;
}): readonly SourceReviewGraphProperty[] {
  return (options.entry?.props ?? []).map((property) => {
    const caseValue = ownValue(options.caseValues, property.name);
    const value = caseValue.found ? caseValue : ownValue(options.defaults, property.name);
    return {
      name: property.name,
      required: property.required,
      type: property.type,
      ...(value.found ? { value: formatReviewValue(value.value) } : {}),
    };
  });
}

export function sourceReviewGraphSlots(options: {
  entry?: RuntimeSourceWorkspaceEntry;
  selectedLayerId?: string;
  slotLayers?: readonly SourceWorkspaceLayer[];
}): readonly SourceReviewGraphSlot[] {
  return (options.slotLayers ?? []).map((slot) => {
    const contract = slot.slot?.contract
      ?? slot.slotContract
      ?? options.entry?.slots.find((candidate) => candidate.name === slot.label);
    const renderedChildren = slot.children.map(reviewChildLabel);
    const received = slot.slot?.received ?? [];
    const childLabels = renderedChildren.length ? renderedChildren : received;
    return {
      accepts: contract?.accepts ?? [],
      active: slot.id === options.selectedLayerId,
      children: summarizedLabels(childLabels),
      count: childLabels.length,
      id: slot.id,
      label: slot.label,
      max: contract?.max,
      min: contract?.min ?? 0,
    };
  });
}

function summarizedLabels(labels: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => count > 1 ? `${label} ×${count}` : label);
}

function reviewChildLabel(layer: SourceWorkspaceLayer): string {
  if (layer.kind === "html") return `<${layer.label}>`;
  if (layer.kind === "slot") return `slot:${layer.label}`;
  return layer.label;
}

function ownValue(source: Readonly<Record<string, unknown>> | undefined, key: string): {
  found: boolean;
  value?: unknown;
} {
  return source && Object.hasOwn(source, key)
    ? { found: true, value: source[key] }
    : { found: false };
}

function formatReviewValue(value: unknown): string {
  if (typeof value === "string") return value || '""';
  if (typeof value === "number" || typeof value === "boolean" || value == null) return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "function") return "Function";
  if (typeof value === "object") return "Object";
  return typeof value;
}
