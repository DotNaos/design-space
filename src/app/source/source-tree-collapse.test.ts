import { expect, it } from "vitest";

import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import {
  sourceCompositionRows,
  sourceFocusGraph,
  visibleSourceCompositionRows,
} from "./source-focus-tree";
import { collapseSourceBranchesOutsideFocus } from "./source-tree-collapse";
import type { SourceTreeNode } from "./source-workspace-tree";

it("collapses unrelated branches while keeping the active component path open", () => {
  const app = node("App", [
    component("Panel", [slot("content", [component("Heading")])]),
    component("Aside", [slot("content", [component("Text")])]),
  ]);
  const graph = sourceFocusGraph([
    app,
    node("Panel"),
    node("Heading"),
    node("Aside"),
    node("Text"),
  ], "desktop");
  const focus = [...graph.occurrences.values()]
    .find((occurrence) => occurrence.node.label === "Heading")!;
  const rows = sourceCompositionRows(graph, focus.id);

  const collapsed = collapseSourceBranchesOutsideFocus(rows, focus.id, new Set());
  const visible = visibleSourceCompositionRows(rows, collapsed).map((row) => row.label);

  expect(visible).toContain("Heading");
  expect(visible).toContain("Aside");
  expect(visible).not.toContain("Text");
});

it("collapses muted branches below the active component", () => {
  const app = node("App", [component("Panel")]);
  const panel = node("Panel", [
    html("section", [component("Select")]),
  ]);
  const select = node("Select", [
    html("button", [html("span")]),
  ]);
  const graph = sourceFocusGraph([app, panel, select], "desktop");
  const focus = [...graph.occurrences.values()]
    .find((occurrence) => occurrence.node.label === "Panel")!;
  const rows = sourceCompositionRows(graph, focus.id);
  const activePath = focus.entry?.relativePath;
  const nodePaths = new Map(
    [app, panel, select].map((candidate) => [
      candidate.id,
      candidate.implementations.desktop.entry?.relativePath,
    ]),
  );

  const collapsed = collapseSourceBranchesOutsideFocus(
    rows,
    focus.id,
    new Set(),
    (row) => {
      if (row.occurrence?.id === focus.id && !row.layer) return false;
      const ownerId = row.sourceOwnerId ?? row.occurrence?.usageOwnerId;
      const ownerPath = ownerId
        ? nodePaths.get(ownerId)
        : row.occurrence?.entry?.relativePath;
      return Boolean(activePath && ownerPath && ownerPath !== activePath);
    },
  );
  const visible = visibleSourceCompositionRows(rows, collapsed).map((row) => row.label);

  expect(visible).toContain("Panel");
  expect(visible).toContain("<section>");
  expect(visible).toContain("Select");
  expect(visible).toContain("<button>");
  expect(visible).not.toContain("<span>");
});

function node(label: string, layers: readonly SourceWorkspaceLayer[] = []): SourceTreeNode {
  const componentEntry: RuntimeSourceWorkspaceEntry = {
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
    uses: [],
    layers,
    component: () => null,
  };
  return {
    id: `node.${label}`,
    area: componentEntry.area,
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

function component(
  label: string,
  children: readonly SourceWorkspaceLayer[] = [],
): SourceWorkspaceLayer {
  return {
    id: `component.${label}`,
    label,
    kind: "component",
    source: { start: 1, end: 2 },
    children,
  };
}

function slot(
  label: string,
  children: readonly SourceWorkspaceLayer[],
): SourceWorkspaceLayer {
  return {
    id: `slot.${label}.${children[0]?.label ?? "empty"}`,
    label,
    kind: "slot",
    source: { start: 1, end: 2 },
    children,
    slot: {
      contract: {
        name: label,
        type: "ComponentSlot<() => JSX.Element>",
        required: false,
        multiple: true,
        accepts: children.map((child) => child.label),
        min: 0,
      },
      validity: "valid",
      received: children.map((child) => child.label),
      edit: { kind: "list", insertAt: 1, list: { start: 1, end: 2 } },
    },
  };
}

function html(
  label: string,
  children: readonly SourceWorkspaceLayer[] = [],
): SourceWorkspaceLayer {
  return {
    id: `html.${label}`,
    label,
    kind: "html",
    source: { start: 1, end: 2 },
    children,
  };
}
