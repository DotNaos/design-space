import { expect, it } from "vitest";

import type { SourceFocusGraph, SourceOccurrence } from "./source-focus-tree";
import { findSourceComponentOccurrence, sourceComponentSelection } from "./use-source-workspace-control";

function occurrence(id: string, label: string, exportName = label): SourceOccurrence {
  return {
    id,
    node: {
      id: `node:${label}`,
      area: "components",
      label,
      entries: [],
      uses: [],
      implementations: {} as never,
    },
    entry: { exportName } as never,
    children: [],
  };
}

it("resolves an isolated component by label, export name, and case-insensitive label", () => {
  const sidebar = occurrence("root/sidebar", "SourceWorkspaceSidebar");
  const inspector = occurrence("root/inspector", "SourceComponentInspector", "InspectorExport");
  const graph: SourceFocusGraph = {
    roots: [sidebar.id],
    occurrences: new Map([[sidebar.id, sidebar], [inspector.id, inspector]]),
  };

  expect(findSourceComponentOccurrence(graph, "SourceWorkspaceSidebar")).toBe(sidebar);
  expect(findSourceComponentOccurrence(graph, "InspectorExport")).toBe(inspector);
  expect(findSourceComponentOccurrence(graph, "sourceworkspacesidebar")).toBe(sidebar);
  expect(findSourceComponentOccurrence(graph, "Missing")).toBeUndefined();
});

it("creates the design-mode selection for the resolved occurrence", () => {
  const sidebar = occurrence("root/sidebar", "SourceWorkspaceSidebar");

  expect(sourceComponentSelection(sidebar, "desktop")).toEqual({
    nodeId: "node:SourceWorkspaceSidebar",
    sourceNodeId: "node:SourceWorkspaceSidebar",
    device: "desktop",
    occurrenceId: "root/sidebar",
    kind: "component",
  });
});
