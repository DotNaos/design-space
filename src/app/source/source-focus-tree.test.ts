import { describe, expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { sourceFocusGraph, sourceFocusRows } from "./source-focus-tree";
import type { SourceTreeNode } from "./source-workspace-tree";

describe("focused source tree", () => {
  it("shows only the parent path, focused component, occupied slots, and direct content", () => {
    const heading = node("Heading", entry("Heading"));
    const panelUsage = component("Panel", [slot("header", [component("Heading")])]);
    const app = node("App", entry("App", [panelUsage]));
    const panel = node("Panel", entry("Panel"));
    const graph = sourceFocusGraph([app, panel, heading], "desktop");
    const panelOccurrence = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Panel")!;

    expect(sourceFocusRows(graph, panelOccurrence.id, "focus").map((row) => [row.depth, row.kind, row.label, row.role])).toEqual([
      [0, "component", "App", "parent"],
      [1, "component", "Panel", "focus"],
      [2, "slot", "header", undefined],
      [3, "component", "Heading", undefined],
    ]);
  });

  it("keeps HTML out of focus and overview but reveals it for Layers", () => {
    const app = node("App", entry("App", [{
      id: "html.main", label: "main", kind: "html", source: { start: 0, end: 10 }, children: [],
    }]));
    const graph = sourceFocusGraph([app], "desktop");
    const focus = graph.roots[0]!;

    expect(sourceFocusRows(graph, focus, "focus").map((row) => row.kind)).toEqual(["component"]);
    expect(sourceFocusRows(graph, focus, "overview").map((row) => row.kind)).toEqual(["component"]);
    expect(sourceFocusRows(graph, focus, "layers").map((row) => row.kind)).toEqual(["component", "html"]);
  });
});

function node(label: string, componentEntry: RuntimeSourceWorkspaceEntry): SourceTreeNode {
  return {
    id: `node.${label}`,
    area: label === "App" ? "layout" : "components",
    label,
    entries: [componentEntry],
    uses: [],
    implementations: {
      desktop: { requestedDevice: "desktop", sourceDevice: "desktop", state: "direct", entry: componentEntry },
      tablet: { requestedDevice: "tablet", state: "missing" },
      mobile: { requestedDevice: "mobile", state: "missing" },
    },
  };
}

function entry(label: string, layers: readonly SourceWorkspaceLayer[] = []): RuntimeSourceWorkspaceEntry {
  return {
    id: `entry.${label}`,
    label,
    area: label === "App" ? "layout" : "components",
    device: "desktop",
    fileId: `file.${label}`,
    relativePath: `src/${label}.tsx`,
    exportName: label,
    props: [],
    slots: [],
    findings: [],
    source: { start: 0, end: 20 },
    layers,
    component: () => null,
  };
}

function component(label: string, children: readonly SourceWorkspaceLayer[] = []): SourceWorkspaceLayer {
  return { id: `component.${label}.${Math.random()}`, label, kind: "component", source: { start: 1, end: 2 }, children };
}

function slot(label: string, children: readonly SourceWorkspaceLayer[]): SourceWorkspaceLayer {
  return {
    id: `slot.${label}`,
    label,
    kind: "slot",
    source: { start: 1, end: 2 },
    children,
    slot: {
      contract: { name: label, type: "ComponentSlot<typeof Heading>", required: true, multiple: false, accepts: ["Heading"], min: 1, max: 1 },
      validity: "full",
      received: ["Heading"],
      edit: { kind: "single", insertAt: 2 },
    },
  };
}
