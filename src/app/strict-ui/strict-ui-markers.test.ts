import { describe, expect, it } from "vitest";

import type { ComponentTreeRow } from "../../model";
import type { StrictUiViolation } from "../../shared/strict-ui";
import {
  buildStrictUiCanvasTargets,
  buildStrictUiSelectionMarkers,
  describeStrictUiMarker,
  strictUiMarkerForTreeRow,
} from "./strict-ui-markers";

describe("Strict UI markers", () => {
  it("groups control findings with their component and keeps the strongest severity", () => {
    const markers = buildStrictUiSelectionMarkers([
      violation("property.token", "warning", { kind: "control", instanceId: "card.one", controlId: "tone" }),
      violation("property.required", "error", { kind: "instance", instanceId: "card.one" }),
    ]);

    const marker = markers.get("card.one");
    expect(marker).toMatchObject({ severity: "error" });
    expect(marker?.violations).toHaveLength(2);
    expect(describeStrictUiMarker(marker!)).toContain("1 Strict UI error, 1 Strict UI warning");
  });

  it("maps slots and both precise and slot-wide outlet findings to tree rows", () => {
    const markers = buildStrictUiSelectionMarkers([
      violation("slot.minimum", "error", { kind: "slot", instanceId: "card.one", slotId: "body" }),
      violation("outlet.missing", "error", { kind: "slot-outlet", slotId: "body" }),
      violation("outlet.duplicate", "warning", { kind: "slot-outlet", slotId: "body", outletId: "body.outlet" }),
    ]);
    const slot = row({ kind: "slot", id: "slot:card.one:body", componentInstanceId: "card.one", slotId: "body" });
    const outlet = row({ kind: "slot-outlet", id: "outlet:body.outlet", outletId: "body.outlet", slotId: "body" });

    expect(strictUiMarkerForTreeRow(slot, markers)?.violations).toHaveLength(1);
    expect(strictUiMarkerForTreeRow(outlet, markers)?.violations).toHaveLength(2);
  });

  it("targets component, slot, and precise outlet DOM while anchoring unplaced findings to the root", () => {
    const targets = buildStrictUiCanvasTargets([
      violation("property.required", "error", { kind: "control", instanceId: "card.one", controlId: "title" }),
      violation("slot.minimum", "warning", { kind: "slot", instanceId: "card.one", slotId: "body" }),
      violation("outlet.missing", "error", { kind: "slot-outlet", slotId: "body" }),
      violation("outlet.duplicate", "warning", { kind: "slot-outlet", slotId: "body", outletId: "body.outlet" }),
      violation("document.rule", "info", { kind: "document" }),
    ], "screen.root");

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "instance", id: "card.one" }),
      expect.objectContaining({ kind: "slot", id: "slot:card.one:body" }),
      expect.objectContaining({ kind: "outlet", id: "body.outlet" }),
      expect.objectContaining({ kind: "instance", id: "screen.root", marker: expect.objectContaining({ severity: "error" }) }),
    ]));
    expect(targets.find((target) => target.id === "screen.root")?.marker.violations).toHaveLength(2);
  });
});

function violation(
  ruleId: string,
  severity: StrictUiViolation["severity"],
  location: StrictUiViolation["location"],
): StrictUiViolation {
  return { ruleId, severity, location, message: `${ruleId} message` };
}

function row(selection: Extract<ComponentTreeRow, { kind: "slot" | "slot-outlet" }>["selection"]): ComponentTreeRow {
  if (selection.kind === "slot") {
    return { kind: "slot", depth: 1, label: "Body", occupied: false, childCount: 0, selection };
  }
  return { kind: "slot-outlet", depth: 2, label: "Body outlet", selection };
}
