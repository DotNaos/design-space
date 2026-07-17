import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceTreeNode } from "./source-workspace-tree";

export type SourceExplorerMode = "focus" | "overview" | "layers";

export interface SourceOccurrence {
  id: string;
  node: SourceTreeNode;
  entry?: RuntimeSourceWorkspaceEntry;
  parentId?: string;
  usageOwnerId?: string;
  usageLayer?: SourceWorkspaceLayer;
  usageSlot?: SourceWorkspaceLayer;
  children: readonly string[];
}

export interface SourceFocusGraph {
  roots: readonly string[];
  occurrences: ReadonlyMap<string, SourceOccurrence>;
}

export interface SourceFocusRow {
  key: string;
  depth: number;
  kind: "component" | "html" | "slot";
  label: string;
  occurrence?: SourceOccurrence;
  layer?: SourceWorkspaceLayer;
  role?: "parent" | "focus";
}

export function sourceFocusGraph(
  nodes: readonly SourceTreeNode[],
  device: DesignSpaceDevice,
): SourceFocusGraph {
  const references = new Map<string, SourceTreeNode>();
  for (const node of nodes) {
    references.set(node.label, node);
    node.entries.forEach((entry) => references.set(entry.exportName, node));
  }
  const mutable = new Map<string, SourceOccurrence>();
  const roots = nodes.filter((node) => node.area === "layout");
  const initial = roots.length ? roots : nodes.filter((node) => node.area === "pages");

  const addOccurrence = (
    node: SourceTreeNode,
    id: string,
    path: ReadonlySet<string>,
    parent?: SourceOccurrence,
    usageLayer?: SourceWorkspaceLayer,
    usageSlot?: SourceWorkspaceLayer,
    usageOwnerId?: string,
  ): SourceOccurrence => {
    const entry = node.implementations[device].entry;
    const occurrence: SourceOccurrence = {
      id,
      node,
      entry,
      ...(parent ? { parentId: parent.id } : {}),
      ...(usageOwnerId ? { usageOwnerId } : {}),
      ...(usageLayer ? { usageLayer } : {}),
      ...(usageSlot ? { usageSlot } : {}),
      children: [],
    };
    mutable.set(id, occurrence);
    if (path.has(node.id)) return occurrence;
    const childIds: string[] = [];
    const nextPath = new Set(path).add(node.id);
    const appendLayers = (
      layers: readonly SourceWorkspaceLayer[],
      slot: SourceWorkspaceLayer | undefined,
      ownerId: string,
      prefix: string,
    ) => {
      layers.forEach((layer, index) => {
        if (layer.kind === "html") {
          appendLayers(layer.children, slot, ownerId, `${prefix}.h${index}`);
          return;
        }
        if (layer.kind === "slot") {
          if (layer.slot) appendLayers(layer.children, layer, ownerId, `${prefix}.s${index}`);
          return;
        }
        const referenced = references.get(layer.label);
        if (!referenced) return;
        const childId = `${id}/${prefix}.c${index}:${referenced.id}`;
        const child = addOccurrence(referenced, childId, nextPath, occurrence, layer, slot, ownerId);
        childIds.push(child.id);
      });
    };
    const usageSlots = usageLayer?.children.filter((layer) => layer.kind === "slot" && layer.slot) ?? [];
    usageSlots.forEach((slot, index) => appendLayers(slot.children, slot, usageOwnerId ?? parent?.node.id ?? node.id, `u${index}`));
    appendLayers(entry?.layers ?? [], undefined, node.id, "d");
    mutable.set(id, { ...occurrence, children: childIds });
    return mutable.get(id)!;
  };

  const rootIds = initial.map((node, index) => addOccurrence(node, `root.${index}:${node.id}`, new Set()).id);
  return { roots: rootIds, occurrences: mutable };
}

export function initialFocusOccurrence(graph: SourceFocusGraph): string | undefined {
  return graph.roots[0] ?? graph.occurrences.keys().next().value;
}

export function sourceFocusRows(
  graph: SourceFocusGraph,
  focusId: string,
  mode: SourceExplorerMode,
): readonly SourceFocusRow[] {
  const focus = graph.occurrences.get(focusId);
  if (!focus) return [];
  if (mode === "overview") return overviewRows(graph);
  if (mode === "layers") return layerRows(focus);

  const rows: SourceFocusRow[] = [];
  let focusDepth = 0;
  const parent = focus.parentId ? graph.occurrences.get(focus.parentId) : undefined;
  if (parent) {
    rows.push(componentRow(parent, 0, "parent"));
    focusDepth = 1;
    if (focus.usageSlot) {
      rows.push(layerRow(focus.usageSlot, 1, focus));
      focusDepth = 2;
    }
  }
  rows.push(componentRow(focus, focusDepth, "focus"));
  const usageSlots = focus.usageLayer?.children.filter((layer) => layer.kind === "slot" && layer.slot) ?? [];
  if (usageSlots.length) {
    for (const slot of usageSlots) {
      rows.push(layerRow(slot, focusDepth + 1, focus));
      childrenForSlot(graph, focus, slot).forEach((child) => rows.push(componentRow(child, focusDepth + 2)));
    }
  } else {
    focus.children.forEach((id) => {
      const child = graph.occurrences.get(id);
      if (child && !child.usageSlot) rows.push(componentRow(child, focusDepth + 1));
    });
  }
  return rows;
}

function overviewRows(graph: SourceFocusGraph): readonly SourceFocusRow[] {
  const rows: SourceFocusRow[] = [];
  const visit = (id: string, depth: number) => {
    const occurrence = graph.occurrences.get(id);
    if (!occurrence) return;
    rows.push(componentRow(occurrence, depth));
    const slots = occurrence.usageLayer?.children.filter((layer) => layer.kind === "slot" && layer.slot) ?? [];
    for (const slot of slots) {
      rows.push(layerRow(slot, depth + 1, occurrence));
      childrenForSlot(graph, occurrence, slot).forEach((child) => visit(child.id, depth + 2));
    }
    occurrence.children.filter((id) => !graph.occurrences.get(id)?.usageSlot).forEach((child) => visit(child, depth + 1));
  };
  graph.roots.forEach((root) => visit(root, 0));
  return rows;
}

function layerRows(focus: SourceOccurrence): readonly SourceFocusRow[] {
  const rows: SourceFocusRow[] = [componentRow(focus, 0, "focus")];
  const append = (layers: readonly SourceWorkspaceLayer[], depth: number) => layers.forEach((layer) => {
    rows.push(layerRow(layer, depth, focus));
    append(layer.children, depth + 1);
  });
  append(focus.entry?.layers ?? [], 1);
  return rows;
}

function childrenForSlot(graph: SourceFocusGraph, owner: SourceOccurrence, slot: SourceWorkspaceLayer) {
  return owner.children.flatMap((id) => {
    const child = graph.occurrences.get(id);
    return child?.usageSlot?.id === slot.id ? [child] : [];
  });
}

function componentRow(occurrence: SourceOccurrence, depth: number, role?: SourceFocusRow["role"]): SourceFocusRow {
  return { key: occurrence.id, depth, kind: "component", label: occurrence.node.label, occurrence, role };
}

function layerRow(layer: SourceWorkspaceLayer, depth: number, occurrence?: SourceOccurrence): SourceFocusRow {
  return {
    key: layer.id,
    depth,
    kind: layer.kind,
    label: layer.kind === "html" ? `<${layer.label}>` : layer.label,
    layer,
    occurrence,
  };
}
