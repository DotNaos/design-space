import { describe, expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import {
  initialFocusOccurrence,
  initiallyCollapsedSourceBranches,
  sourceCompositionRows,
  sourceFocusGraph,
  sourceFocusRows,
  visibleSourceCompositionRows,
} from "./source-focus-tree";
import type { SourceTreeNode } from "./source-workspace-tree";

describe("focused source tree", () => {
  it("keeps the composition context around the focused component", () => {
    const heading = node("Heading", entry("Heading"));
    const panelUsage = component("Panel", [slot("header", [component("Heading")])]);
    const app = node("App", entry("App", [panelUsage]));
    const panel = node("Panel", entry("Panel"));
    const graph = sourceFocusGraph([app, panel, heading], "desktop");
    const panelOccurrence = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Panel")!;

    expect(sourceFocusRows(graph, panelOccurrence.id).map((row) => [row.depth, row.kind, row.label, row.role])).toEqual([
      [0, "component", "App", "parent"],
      [1, "component", "Panel", "focus"],
      [2, "slot", "header", undefined],
      [3, "component", "Heading", undefined],
    ]);
  });

  it("collapses unrelated branches instead of removing them", () => {
    const heading = node("Heading", entry("Heading"));
    const text = node("Text", entry("Text"));
    const panel = node("Panel", entry("Panel"));
    const aside = node("Aside", entry("Aside"));
    const shell = node("Shell", entry("Shell"));
    const app = node("App", entry("App", [component("Shell", [
      slot("content", [
        component("Panel", [slot("header", [component("Heading")])]),
        component("Aside", [slot("body", [component("Text")])]),
      ]),
    ])]));
    const graph = sourceFocusGraph([app, shell, panel, aside, heading, text], "desktop");
    const focus = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Heading")!;

    expect(sourceFocusRows(graph, focus.id).map((row) => [row.label, row.expanded])).toEqual([
      ["App", true],
      ["Shell", true],
      ["content", undefined],
      ["Panel", true],
      ["header", undefined],
      ["Heading", true],
      ["Aside", false],
    ]);
  });

  it("shows HTML in the same tree as the focused component", () => {
    const app = node("App", entry("App", [{
      id: "html.main", label: "main", kind: "html", source: { start: 0, end: 10 }, children: [],
    }]));
    const graph = sourceFocusGraph([app], "desktop");
    const focus = graph.roots[0]!;

    expect(sourceFocusRows(graph, focus).map((row) => row.kind)).toEqual(["component", "html"]);
  });

  it("shows internal component layers without inventing slot nodes", () => {
    const internal = node("InternalPanel", entry("InternalPanel"));
    const app = node("App", entry("App", [component("InternalPanel")]));
    const graph = sourceFocusGraph([app, internal], "desktop");
    const focus = graph.roots[0]!;

    expect(sourceFocusRows(graph, focus).map((row) => [row.kind, row.label])).toEqual([
      ["component", "App"],
      ["component", "InternalPanel"],
    ]);
  });

  it("starts at the first component with an explicit slot composition", () => {
    const heading = node("Heading", entry("Heading"));
    const panel = node("Panel", entry("Panel"));
    const app = node("App", entry("App", [component("Panel", [slot("header", [component("Heading")])])]));
    const graph = sourceFocusGraph([app, panel, heading], "desktop");

    expect(graph.occurrences.get(initialFocusOccurrence(graph)!)?.node.label).toBe("Panel");
  });

  it("keeps the complete tree stable when the selected component changes", () => {
    const heading = node("Heading", entry("Heading"));
    const text = node("Text", entry("Text"));
    const panel = node("Panel", entry("Panel"));
    const app = node("App", entry("App", [
      component("Panel", [slot("content", [component("Heading"), component("Text")])]),
    ]));
    const graph = sourceFocusGraph([app, panel, heading, text], "desktop");
    const headingId = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Heading")!.id;
    const textId = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Text")!.id;

    const headingRows = sourceCompositionRows(graph, headingId);
    const textRows = sourceCompositionRows(graph, textId);

    expect(headingRows.map(({ depth, key, kind, label }) => [depth, key, kind, label]))
      .toEqual(textRows.map(({ depth, key, kind, label }) => [depth, key, kind, label]));
    expect(headingRows.find((row) => row.role === "focus")?.label).toBe("Heading");
    expect(textRows.find((row) => row.role === "focus")?.label).toBe("Text");
  });

  it("changes descendant visibility only through explicit collapsed branch keys", () => {
    const heading = node("Heading", entry("Heading"));
    const panel = node("Panel", entry("Panel"));
    const app = node("App", entry("App", [component("Panel", [slot("header", [component("Heading")])])]));
    const graph = sourceFocusGraph([app, panel, heading], "desktop");
    const panelId = [...graph.occurrences.values()].find((occurrence) => occurrence.node.label === "Panel")!.id;
    const rows = sourceCompositionRows(graph, panelId);
    const initial = initiallyCollapsedSourceBranches(rows, panelId);

    expect(visibleSourceCompositionRows(rows, initial).map((row) => row.label)).toEqual(["App", "Panel"]);
    expect(visibleSourceCompositionRows(rows, new Set()).map((row) => row.label)).toEqual(["App", "Panel", "header", "Heading"]);
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
