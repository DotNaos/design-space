import { expect, it } from "vitest";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { sourceCanvasSelectionOccurrence, sourceCanvasVisualLayer } from "./source-canvas-selection";
import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";

const htmlLayer: SourceWorkspaceLayer = {
  id: "panel-root",
  kind: "html",
  label: "section",
  source: { start: 40, end: 100 },
  children: [],
};

const entry: SourceWorkspaceEntry = {
  id: "panel",
  label: "Panel",
  area: "components",
  device: "desktop",
  fileId: "panel-file",
  relativePath: "src/components/Panel.tsx",
  exportName: "Panel",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 120 },
  layers: [{
    id: "content-slot",
    kind: "slot",
    label: "content",
    source: { start: 20, end: 30 },
    children: [htmlLayer],
  }],
};

it("uses the component's first authored HTML layer for its visual inspector", () => {
  expect(sourceCanvasVisualLayer(entry, undefined)).toBe(htmlLayer);
});

it("keeps an explicitly selected canvas layer", () => {
  const selected = { ...htmlLayer, id: "selected" };
  expect(sourceCanvasVisualLayer(entry, selected)).toBe(selected);
});

it("keeps repeated component occurrences aligned with their rendered match", () => {
  const repeatedLayer: SourceWorkspaceLayer = {
    id: "repeated-card",
    kind: "component",
    label: "Card",
    source: { start: 12, end: 24 },
    children: [],
  };
  const root = occurrence("root", ["first", "second"]);
  const first = occurrence("first", [], repeatedLayer);
  const second = occurrence("second", [], repeatedLayer);
  const graph: SourceFocusGraph = {
    roots: [root.id],
    occurrences: new Map([[root.id, root], [first.id, first], [second.id, second]]),
  };

  expect(sourceCanvasSelectionOccurrence(graph, root.id, {
    nodeId: "card",
    sourceNodeId: "root",
    device: "desktop",
    occurrenceId: second.id,
    layerId: repeatedLayer.id,
    kind: "component",
  })).toBe(1);
});

function occurrence(
  id: string,
  children: readonly string[],
  usageLayer?: SourceWorkspaceLayer,
): SourceOccurrence {
  return {
    id,
    node: { id: id === "root" ? "root" : "card" } as SourceOccurrence["node"],
    ...(usageLayer ? { usageLayer, usageOwnerId: "root" } : {}),
    children,
  };
}
