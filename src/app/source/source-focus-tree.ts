import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceTreeNode } from "./source-workspace-tree";

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
  targetOccurrence?: SourceOccurrence;
  sourceOwnerId?: string;
  layer?: SourceWorkspaceLayer;
  role?: "parent" | "focus";
  collapsible?: boolean;
  expanded?: boolean;
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
  for (const rootId of graph.roots) {
    const root = graph.occurrences.get(rootId);
    const composed = root?.children
      .map((id) => graph.occurrences.get(id))
      .find((occurrence) => occurrence?.usageLayer?.children.some((layer) => layer.kind === "slot" && layer.slot));
    if (composed) return composed.id;
  }
  return graph.roots[0] ?? graph.occurrences.keys().next().value;
}

export function sourceFocusRows(
  graph: SourceFocusGraph,
  focusId: string,
): readonly SourceFocusRow[] {
  const focus = graph.occurrences.get(focusId);
  if (!focus) return [];
  return compositionRows(graph, focus);
}

function compositionRows(
  graph: SourceFocusGraph,
  focus: SourceOccurrence,
): readonly SourceFocusRow[] {
  const rows: SourceFocusRow[] = [];
  const path = occurrencePath(graph, focus);
  const pathIds = new Set(path.map((occurrence) => occurrence.id));

  const visit = (occurrence: SourceOccurrence, depth: number) => {
    const onPath = pathIds.has(occurrence.id);
    const children = compositionChildren(graph, occurrence, pathIds);
    const slots = occurrenceSlots(occurrence);
    const localLayers = occurrence.id === focus.id ? occurrence.entry?.layers ?? [] : [];
    const collapsible = slots.length > 0 || children.length > 0 || localLayers.length > 0;
    const expanded = onPath;

    rows.push(componentRow(
      occurrence,
      depth,
      occurrence.id === focus.id ? "focus" : onPath ? "parent" : undefined,
      collapsible,
      expanded,
    ));
    if (!expanded) return;

    for (const slot of slots) {
      rows.push(layerRow(slot, depth + 1, occurrence, occurrence.usageOwnerId ?? occurrence.node.id));
      for (const child of childrenForSlot(graph, occurrence, slot)) {
        visit(child, depth + 2);
      }
    }
    appendLocalLayers(rows, graph, occurrence, localLayers, depth + 1);
    for (const child of children.filter((candidate) => !candidate.usageSlot && occurrence.id !== focus.id)) {
      visit(child, depth + 1);
    }
  };

  for (const rootId of graph.roots) {
    const root = graph.occurrences.get(rootId);
    if (root) visit(root, 0);
  }
  return rows;
}

function occurrencePath(graph: SourceFocusGraph, focus: SourceOccurrence): readonly SourceOccurrence[] {
  const path: SourceOccurrence[] = [focus];
  let current = focus;
  while (current.parentId) {
    const parent = graph.occurrences.get(current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}

function occurrenceSlots(occurrence: SourceOccurrence): readonly SourceWorkspaceLayer[] {
  return occurrence.usageLayer?.children.filter((layer) => layer.kind === "slot" && layer.slot) ?? [];
}

function compositionChildren(
  graph: SourceFocusGraph,
  occurrence: SourceOccurrence,
  pathIds: ReadonlySet<string>,
): readonly SourceOccurrence[] {
  return occurrence.children.flatMap((id) => {
    const child = graph.occurrences.get(id);
    if (!child) return [];
    if (child.usageSlot || pathIds.has(child.id) || occurrenceSlots(child).length > 0) return [child];
    return [];
  });
}

function appendLocalLayers(
  rows: SourceFocusRow[],
  graph: SourceFocusGraph,
  owner: SourceOccurrence,
  layers: readonly SourceWorkspaceLayer[],
  depth: number,
): void {
  for (const layer of layers) {
    const targetOccurrence = layer.kind === "component"
      ? owner.children
        .map((id) => graph.occurrences.get(id))
        .find((candidate) => candidate?.usageLayer?.id === layer.id)
      : undefined;
    rows.push(layerRow(layer, depth, owner, owner.node.id, targetOccurrence));
    appendLocalLayers(rows, graph, owner, layer.children, depth + 1);
  }
}

function childrenForSlot(graph: SourceFocusGraph, owner: SourceOccurrence, slot: SourceWorkspaceLayer) {
  return owner.children.flatMap((id) => {
    const child = graph.occurrences.get(id);
    return child?.usageSlot?.id === slot.id ? [child] : [];
  });
}

function componentRow(
  occurrence: SourceOccurrence,
  depth: number,
  role?: SourceFocusRow["role"],
  collapsible?: boolean,
  expanded?: boolean,
): SourceFocusRow {
  return { key: occurrence.id, depth, kind: "component", label: occurrence.node.label, occurrence, role, collapsible, expanded };
}

function layerRow(
  layer: SourceWorkspaceLayer,
  depth: number,
  occurrence?: SourceOccurrence,
  sourceOwnerId?: string,
  targetOccurrence?: SourceOccurrence,
): SourceFocusRow {
  return {
    key: layer.id,
    depth,
    kind: layer.kind,
    label: layer.kind === "html" ? `<${layer.label}>` : layer.label,
    layer,
    occurrence,
    targetOccurrence,
    sourceOwnerId,
  };
}
