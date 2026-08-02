import { expect, it } from "vitest";

import type {
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import type {
  SourceFocusGraph,
  SourceOccurrence,
} from "./source-focus-tree";
import {
  deepestLayerAtOffset,
  sourceSelectionAtOffset,
} from "./source-code-selection";

const textLayer: SourceWorkspaceLayer = {
  id: "title",
  kind: "html",
  label: "h2",
  source: { start: 40, end: 65 },
  children: [],
};
const sectionLayer: SourceWorkspaceLayer = {
  id: "section",
  kind: "html",
  label: "section",
  source: { start: 20, end: 90 },
  children: [textLayer],
};
const entry = {
  id: "panel-entry",
  label: "Panel",
  area: "components",
  device: "desktop",
  fileId: "panel-file",
  relativePath: "src/Panel.tsx",
  exportName: "Panel",
  props: [],
  slots: [],
  findings: [],
  source: { start: 0, end: 120 },
  layers: [sectionLayer],
  component: () => null,
} satisfies RuntimeSourceWorkspaceEntry;

it("finds the smallest authored JSX layer containing the Monaco cursor", () => {
  expect(deepestLayerAtOffset(entry.layers, 50)).toBe(textLayer);
  expect(deepestLayerAtOffset(entry.layers, 75)).toBe(sectionLayer);
});

it("maps a Monaco cursor to the same selection used by tree and canvas", () => {
  const root = occurrence("root", entry);
  const graph: SourceFocusGraph = {
    roots: [root.id],
    occurrences: new Map([[root.id, root]]),
  };

  expect(sourceSelectionAtOffset({
    device: "desktop",
    entry,
    focusId: root.id,
    graph,
    offset: 50,
  })).toEqual({
    nodeId: "panel",
    sourceNodeId: "panel",
    device: "desktop",
    occurrenceId: root.id,
    layerId: textLayer.id,
    renderedLayerOccurrence: 0,
    kind: "html",
  });
});

it("falls back to an existing rendered instance while moving between tags in Monaco", () => {
  const root = occurrence("root", entry);
  const graph: SourceFocusGraph = {
    roots: [root.id],
    occurrences: new Map([[root.id, root]]),
  };

  expect(sourceSelectionAtOffset({
    device: "desktop",
    entry,
    focusId: root.id,
    graph,
    offset: 75,
    selected: {
      nodeId: "panel",
      sourceNodeId: "panel",
      device: "desktop",
      occurrenceId: root.id,
      layerId: textLayer.id,
      renderedLayerOccurrence: 3,
      kind: "html",
    },
  })?.renderedLayerOccurrence).toBe(0);
});

it("maps expanded local-component layers outside the owner declaration range", () => {
  const expandedTitle: SourceWorkspaceLayer = {
    id: "contract-title",
    kind: "html",
    label: "h3",
    source: { start: 150, end: 180 },
    children: [],
  };
  const expandedUsage: SourceWorkspaceLayer = {
    id: "contract-usage",
    kind: "component",
    label: "ContractSection",
    source: { start: 70, end: 80 },
    children: [expandedTitle],
  };
  const expandedEntry = {
    ...entry,
    layers: [...entry.layers, expandedUsage],
  } satisfies RuntimeSourceWorkspaceEntry;
  const contractEntry = {
    ...entry,
    id: "contract-entry",
    label: "ContractSection",
    exportName: "ContractSection",
    source: { start: 130, end: 200 },
    layers: [expandedTitle],
  } satisfies RuntimeSourceWorkspaceEntry;
  const root = {
    ...occurrence("root", expandedEntry),
    children: ["contract"],
  } satisfies SourceOccurrence;
  const contract = {
    ...occurrence("contract", contractEntry, "contract"),
    parentId: root.id,
    usageLayer: expandedUsage,
  } satisfies SourceOccurrence;
  const graph: SourceFocusGraph = {
    roots: [root.id],
    occurrences: new Map<string, SourceOccurrence>([
      [root.id, root],
      [contract.id, contract],
    ]),
  };

  expect(sourceSelectionAtOffset({
    device: "desktop",
    entry: expandedEntry,
    focusId: root.id,
    graph,
    offset: 165,
    selected: {
      nodeId: "panel",
      sourceNodeId: "panel",
      device: "desktop",
      occurrenceId: root.id,
      layerId: sectionLayer.id,
      renderedLayerOccurrence: 0,
      kind: "html",
    },
  })).toEqual({
    nodeId: "contract",
    sourceNodeId: "contract",
    device: "desktop",
    occurrenceId: contract.id,
    layerId: expandedTitle.id,
    renderedLayerOccurrence: 0,
    kind: "html",
  });
});

it("selects the component when the cursor is inside its definition but outside JSX layers", () => {
  const root = occurrence("root", entry);
  const graph: SourceFocusGraph = {
    roots: [root.id],
    occurrences: new Map([[root.id, root]]),
  };

  expect(sourceSelectionAtOffset({
    device: "desktop",
    entry,
    focusId: root.id,
    graph,
    offset: 5,
  })).toEqual({
    nodeId: "panel",
    sourceNodeId: "panel",
    device: "desktop",
    occurrenceId: root.id,
    kind: "component",
  });
});

function occurrence(
  id: string,
  sourceEntry: RuntimeSourceWorkspaceEntry,
  nodeId = "panel",
): SourceOccurrence {
  return {
    id,
    node: {
      id: nodeId,
      label: sourceEntry.label,
    } as SourceOccurrence["node"],
    entry: sourceEntry,
    children: [],
  };
}
