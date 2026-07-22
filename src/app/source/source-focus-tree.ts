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
  rootNodeIds?: readonly string[],
): SourceFocusGraph {
  const references = new Map<string, SourceTreeNode>();
  for (const node of nodes) {
    references.set(node.label, node);
    node.entries.forEach((entry) => references.set(entry.exportName, node));
  }
  const mutable = new Map<string, SourceOccurrence>();
  const requestedRoots = rootNodeIds?.flatMap((id) => {
    const node = nodes.find((candidate) => candidate.id === id);
    return node ? [node] : [];
  });
  const roots = nodes.filter((node) => node.area === "layout");
  const initial = requestedRoots?.length
    ? requestedRoots
    : roots.length ? roots : nodes.filter((node) => node.area === "pages");

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

export function sourceOccurrenceSubtree(graph: SourceFocusGraph, rootId?: string): ReadonlySet<string> {
  const ids = new Set<string>();
  const visit = (id: string) => {
    if (ids.has(id)) return;
    const occurrence = graph.occurrences.get(id);
    if (!occurrence) return;
    ids.add(id);
    occurrence.children.forEach(visit);
  };
  if (rootId) visit(rootId);
  return ids;
}

export function sourceFocusRows(
  graph: SourceFocusGraph,
  focusId: string,
): readonly SourceFocusRow[] {
  const focus = graph.occurrences.get(focusId);
  if (!focus) return [];
  return compositionRows(graph, focus);
}

export function sourceCompositionRows(
  graph: SourceFocusGraph,
  selectedOccurrenceId?: string,
): readonly SourceFocusRow[] {
  const rows: SourceFocusRow[] = [];

  const appendOccurrence = (occurrence: SourceOccurrence, depth: number) => {
    const usageSlots = occurrenceSlots(occurrence);
    const localLayers = occurrence.entry?.layers ?? [];
    rows.push(componentRow(
      occurrence,
      depth,
      occurrence.id === selectedOccurrenceId ? "focus" : undefined,
      usageSlots.length > 0 || localLayers.length > 0,
    ));

    for (const slot of usageSlots) {
      appendLayer(slot, occurrence, occurrence.usageOwnerId ?? occurrence.node.id, depth + 1);
    }
    for (const layer of localLayers) {
      appendLayer(layer, occurrence, occurrence.node.id, depth + 1);
    }
  };

  const appendLayer = (
    layer: SourceWorkspaceLayer,
    owner: SourceOccurrence,
    sourceOwnerId: string,
    depth: number,
  ) => {
    if (layer.kind === "component") {
      const target = owner.children
        .map((id) => graph.occurrences.get(id))
        .find((candidate) => candidate?.usageLayer?.id === layer.id);
      if (target) {
        appendOccurrence(target, depth);
      } else {
        rows.push({
          ...layerRow(layer, depth, owner, sourceOwnerId),
          key: `${owner.id}/${layer.id}`,
          collapsible: layer.children.length > 0,
        });
        for (const child of layer.children) appendLayer(child, owner, sourceOwnerId, depth + 1);
      }
      return;
    }

    rows.push({
      ...layerRow(layer, depth, owner, sourceOwnerId),
      key: `${owner.id}/${layer.id}`,
      collapsible: layer.children.length > 0,
    });
    for (const child of layer.children) appendLayer(child, owner, sourceOwnerId, depth + 1);
  };

  for (const rootId of graph.roots) {
    const root = graph.occurrences.get(rootId);
    if (root) appendOccurrence(root, 0);
  }
  return rows;
}

export function visibleSourceCompositionRows(
  rows: readonly SourceFocusRow[],
  collapsed: ReadonlySet<string>,
): readonly SourceFocusRow[] {
  const visible: SourceFocusRow[] = [];
  let hiddenBelowDepth: number | undefined;
  for (const row of rows) {
    if (hiddenBelowDepth !== undefined && row.depth > hiddenBelowDepth) continue;
    hiddenBelowDepth = undefined;
    visible.push(row);
    if (row.collapsible && collapsed.has(row.key)) hiddenBelowDepth = row.depth;
  }
  return visible;
}

export function initiallyCollapsedSourceBranches(
  rows: readonly SourceFocusRow[],
  selectedOccurrenceId?: string,
): ReadonlySet<string> {
  const selectedIndex = rows.findIndex((row) => row.occurrence?.id === selectedOccurrenceId && row.kind === "component");
  const openAncestors = new Set<string>();
  if (selectedIndex >= 0) {
    const selectedDepth = rows[selectedIndex]!.depth;
    let parentDepth = selectedDepth - 1;
    for (let index = selectedIndex - 1; index >= 0 && parentDepth >= 0; index -= 1) {
      const candidate = rows[index]!;
      if (candidate.depth !== parentDepth) continue;
      openAncestors.add(candidate.key);
      parentDepth -= 1;
    }
  }
  return new Set(rows.flatMap((row) => (
    row.collapsible && !openAncestors.has(row.key) ? [row.key] : []
  )));
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
