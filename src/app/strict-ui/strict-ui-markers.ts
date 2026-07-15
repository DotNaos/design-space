import { slotSelectionId, type ComponentTreeRow } from "../../model";
import type { StrictUiSeverity, StrictUiViolation } from "../../shared/strict-ui";

export type StrictUiMarker = {
  readonly key: string;
  readonly severity: StrictUiSeverity;
  readonly violations: readonly StrictUiViolation[];
};

export type StrictUiCanvasTarget = {
  readonly kind: "instance" | "slot" | "outlet";
  readonly id: string;
  readonly marker: StrictUiMarker;
};

export function buildStrictUiSelectionMarkers(
  violations: readonly StrictUiViolation[],
): ReadonlyMap<string, StrictUiMarker> {
  const grouped = new Map<string, StrictUiViolation[]>();
  for (const violation of violations) {
    const key = selectionKey(violation);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), violation]);
  }
  return new Map([...grouped].map(([key, findings]) => [key, marker(key, findings)]));
}

export function strictUiMarkerForTreeRow(
  row: ComponentTreeRow,
  markers: ReadonlyMap<string, StrictUiMarker>,
): StrictUiMarker | undefined {
  if (!("selection" in row)) return undefined;
  const exact = markers.get(row.selection.id);
  if (row.kind !== "slot-outlet") return exact;
  return mergeMarkers(exact, markers.get(outletSlotKey(row.selection.slotId)));
}

export function buildStrictUiCanvasTargets(
  violations: readonly StrictUiViolation[],
  rootInstanceId: string,
): readonly StrictUiCanvasTarget[] {
  const grouped = new Map<string, { kind: StrictUiCanvasTarget["kind"]; id: string; violations: StrictUiViolation[] }>();
  for (const violation of violations) {
    const target = canvasTarget(violation, rootInstanceId);
    const key = `${target.kind}:${target.id}`;
    const current = grouped.get(key);
    if (current) current.violations.push(violation);
    else grouped.set(key, { ...target, violations: [violation] });
  }
  return [...grouped].map(([key, target]) => ({
    kind: target.kind,
    id: target.id,
    marker: marker(key, target.violations),
  }));
}

export function describeStrictUiMarker(markerValue: StrictUiMarker): string {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const violation of markerValue.violations) counts[violation.severity] += 1;
  const summary = (["error", "warning", "info"] as const).flatMap((severity) => {
    const count = counts[severity];
    return count ? [`${count} Strict UI ${severity}${count === 1 ? "" : "s"}`] : [];
  }).join(", ");
  return `${summary}. ${markerValue.violations.map((violation) => violation.message).join(" ")}`;
}

function selectionKey(violation: StrictUiViolation): string | undefined {
  const location = violation.location;
  if (location.kind === "instance" || location.kind === "control") return location.instanceId;
  if (location.kind === "slot") return slotSelectionId(location.instanceId, location.slotId);
  if (location.kind === "slot-outlet") {
    return location.outletId ? `outlet:${location.outletId}` : outletSlotKey(location.slotId);
  }
  return undefined;
}

function canvasTarget(
  violation: StrictUiViolation,
  rootInstanceId: string,
): { readonly kind: StrictUiCanvasTarget["kind"]; readonly id: string } {
  const location = violation.location;
  if (location.kind === "instance" || location.kind === "control") {
    return { kind: "instance", id: location.instanceId };
  }
  if (location.kind === "slot") {
    return { kind: "slot", id: slotSelectionId(location.instanceId, location.slotId) };
  }
  if (location.kind === "slot-outlet" && location.outletId) {
    return { kind: "outlet", id: location.outletId };
  }
  return { kind: "instance", id: rootInstanceId };
}

function marker(key: string, violations: readonly StrictUiViolation[]): StrictUiMarker {
  return {
    key,
    severity: violations.reduce<StrictUiSeverity>((highest, violation) => (
      severityRank[violation.severity] > severityRank[highest] ? violation.severity : highest
    ), "info"),
    violations,
  };
}

function mergeMarkers(first?: StrictUiMarker, second?: StrictUiMarker): StrictUiMarker | undefined {
  if (!first) return second;
  if (!second) return first;
  return marker(`${first.key}+${second.key}`, [...first.violations, ...second.violations]);
}

function outletSlotKey(slotId: string): string {
  return `outlet-slot:${slotId}`;
}

const severityRank: Readonly<Record<StrictUiSeverity, number>> = {
  info: 1,
  warning: 2,
  error: 3,
};
