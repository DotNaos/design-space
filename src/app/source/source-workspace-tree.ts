import {
  designSpaceDevices,
  type DesignSpaceArea,
  type DesignSpaceDevice,
  type RuntimeSourceWorkspace,
  type RuntimeSourceWorkspaceEntry,
  type SourceWorkspaceTarget,
  type SourceWorkspaceLayer,
} from "../../shared/source-workspace";

export type SourceImplementationState = "direct" | "shared" | "fallback" | "missing" | "responsive";

export interface SourceImplementation {
  requestedDevice: DesignSpaceDevice;
  sourceDevice?: DesignSpaceDevice;
  state: SourceImplementationState;
  entry?: RuntimeSourceWorkspaceEntry;
}

export interface SourceTreeNode {
  id: string;
  area: DesignSpaceArea;
  label: string;
  entries: readonly RuntimeSourceWorkspaceEntry[];
  uses: readonly string[];
  implementations: Readonly<Record<DesignSpaceDevice, SourceImplementation>>;
  availableDevices?: readonly DesignSpaceDevice[];
  manifestBacked?: boolean;
}

export interface SourceTreeRow {
  key: string;
  depth: number;
  hasChildren: boolean;
  node?: SourceTreeNode;
  layer?: SourceWorkspaceLayer;
  selectionNode: SourceTreeNode;
}

export interface SourceTreeSelection {
  device: DesignSpaceDevice;
  nodeId: string;
  layerId?: string;
}

export function findSourceTreeLayer(
  layers: readonly SourceWorkspaceLayer[] | undefined,
  id: string | undefined,
): SourceWorkspaceLayer | undefined {
  if (!id) return undefined;
  for (const layer of layers ?? []) {
    if (layer.id === id) return layer;
    const nested = findSourceTreeLayer(layer.children, id);
    if (nested) return nested;
  }
  return undefined;
}

export function sourceTreeNodes(
  workspace: RuntimeSourceWorkspace,
  targetId?: string,
): readonly SourceTreeNode[] {
  const groups = new Map<string, { area: DesignSpaceArea; label: string; entries: RuntimeSourceWorkspaceEntry[] }>();
  const target = targetId ? workspace.targets?.find((candidate) => candidate.id === targetId) : undefined;
  const workspaceEntries = target
    ? workspace.entries.filter((entry) => entry.targetId === target.id)
    : workspace.entries.filter((entry) => entry.targetId === undefined);

  for (const entry of workspaceEntries) {
    const key = logicalEntryKey(entry);
    const current = groups.get(key) ?? {
      area: entry.area,
      label: logicalEntryLabel(entry),
      entries: [],
    };
    current.entries.push(entry);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      area: group.area,
      label: group.label,
      entries: group.entries,
      uses: [...new Set(group.entries.flatMap((entry) => entry.uses ?? []))],
      implementations: implementationsFor(workspace, group.area, group.entries, target),
      availableDevices: availableDevicesFor(workspace, group.area, group.entries, target),
      manifestBacked: Boolean(target),
    }))
    .sort(compareNodes);
}

export function sourceTreeRows(
  nodes: readonly SourceTreeNode[],
  device: DesignSpaceDevice = "desktop",
): readonly SourceTreeRow[] {
  return compositionRows(nodes, device, false);
}

export function sharedSourceTreeRows(
  nodes: readonly SourceTreeNode[],
  device: DesignSpaceDevice = "desktop",
): readonly SourceTreeRow[] {
  return compositionRows(nodes.filter((node) => node.area === "components"), device, true);
}

function compositionRows(
  nodes: readonly SourceTreeNode[],
  device: DesignSpaceDevice,
  sharedDefinitions: boolean,
): readonly SourceTreeRow[] {
  const references = new Map<string, SourceTreeNode>();
  for (const node of nodes) {
    references.set(node.label, node);
    for (const entry of node.entries) references.set(entry.exportName, node);
  }

  const rows: SourceTreeRow[] = [];
  const appendNode = (
    node: SourceTreeNode,
    depth: number,
    path: ReadonlySet<string>,
    occurrence: string,
  ): void => {
    if (path.has(node.id)) return;
    const nextPath = new Set(path).add(node.id);
    const entry = node.implementations[device].entry;
    const layers = !sharedDefinitions && node.area === "components" ? [] : entry?.layers ?? [];
    const hasChildren = layers.length > 0;
    rows.push({
      key: `${occurrence}:${node.id}`,
      node,
      selectionNode: node,
      depth,
      hasChildren,
    });
    layers.forEach((layer, index) => appendLayer(
      layer,
      node,
      depth + 1,
      nextPath,
      `${occurrence}.layer.${index}`,
    ));
  };

  const appendLayer = (
    layer: SourceWorkspaceLayer,
    owner: SourceTreeNode,
    depth: number,
    path: ReadonlySet<string>,
    occurrence: string,
  ): void => {
    const referenced = layer.kind === "component" ? references.get(layer.label) : undefined;
    if (referenced && !path.has(referenced.id)) {
      appendNode(referenced, depth, path, occurrence);
      return;
    }
    rows.push({
      key: `${occurrence}:${layer.id}`,
      layer,
      selectionNode: owner,
      depth,
      hasChildren: layer.children.length > 0,
    });
    layer.children.forEach((child, index) => appendLayer(
      child,
      owner,
      depth + 1,
      path,
      `${occurrence}.${index}`,
    ));
  };

  const roots = sharedDefinitions ? nodes : nodes.filter((node) => node.area === "layout");
  const initialRoots = roots.length ? roots : nodes.filter((node) => node.area === "pages");
  initialRoots.forEach((root, index) => appendNode(root, 0, new Set(), `root.${index}`));
  return rows;
}

export function visibleSourceTreeRows(
  rows: readonly SourceTreeRow[],
  collapsed: ReadonlySet<string>,
): readonly SourceTreeRow[] {
  const visible: SourceTreeRow[] = [];
  let hiddenBelowDepth: number | undefined;
  for (const row of rows) {
    if (hiddenBelowDepth !== undefined && row.depth > hiddenBelowDepth) continue;
    hiddenBelowDepth = undefined;
    visible.push(row);
    if (row.hasChildren && collapsed.has(row.key)) hiddenBelowDepth = row.depth;
  }
  return visible;
}

export function initialSourceTreeSelection(
  nodes: readonly SourceTreeNode[],
  target?: SourceWorkspaceTarget,
): SourceTreeSelection | undefined {
  if (target) {
    for (const definition of target.devices) {
      const node = nodes.find((candidate) => candidate.entries.some((entry) => entry.id === definition.entryId));
      if (node) return { nodeId: node.id, device: definition.id };
    }
    return undefined;
  }
  const priorities: readonly [DesignSpaceArea, DesignSpaceDevice][] = [
    ["layout", "desktop"],
    ["pages", "desktop"],
    ["layout", "mobile"],
    ["pages", "mobile"],
    ["components", "desktop"],
  ];
  for (const [area, device] of priorities) {
    const node = nodes.find((candidate) => candidate.area === area && candidate.implementations[device].entry);
    if (node) return { nodeId: node.id, device };
  }
  return nodes[0] ? { nodeId: nodes[0].id, device: "desktop" } : undefined;
}

function implementationsFor(
  workspace: RuntimeSourceWorkspace,
  area: DesignSpaceArea,
  entries: readonly RuntimeSourceWorkspaceEntry[],
  target?: SourceWorkspaceTarget,
): Readonly<Record<DesignSpaceDevice, SourceImplementation>> {
  if (target) {
    return Object.fromEntries(designSpaceDevices.map((device) => {
      const entry = entries.find((candidate) => candidate.manifestDevices?.includes(device));
      if (!entry || !target.devices.some((candidate) => candidate.id === device)) {
        return [device, { requestedDevice: device, state: "missing" }];
      }
      return [device, {
        requestedDevice: device,
        sourceDevice: entry.device,
        state: (entry.manifestDevices?.length ?? 0) > 1 ? "shared" : "direct",
        entry,
      }];
    })) as unknown as Readonly<Record<DesignSpaceDevice, SourceImplementation>>;
  }
  return Object.fromEntries(designSpaceDevices.map((device) => {
    const direct = entries.find((entry) => entry.device === device);
    if (direct) {
      return [device, { requestedDevice: device, sourceDevice: device, state: "direct", entry: direct }];
    }
    const areaState = workspace.devices.find((candidate) => candidate.area === area && candidate.device === device);
    if (areaState?.state === "responsive") {
      const responsive = entries.find((entry) => entry.device === "desktop") ?? entries[0];
      if (responsive) {
        return [device, { requestedDevice: device, sourceDevice: responsive.device, state: "responsive", entry: responsive }];
      }
    }
    const fallbackDevice = areaState?.state === "fallback" ? areaState.fallback : undefined;
    const fallback = fallbackDevice ? entries.find((entry) => entry.device === fallbackDevice) : undefined;
    if (fallback && fallbackDevice) {
      return [device, { requestedDevice: device, sourceDevice: fallbackDevice, state: "fallback", entry: fallback }];
    }
    return [device, { requestedDevice: device, state: "missing" }];
  })) as unknown as Readonly<Record<DesignSpaceDevice, SourceImplementation>>;
}

function availableDevicesFor(
  workspace: RuntimeSourceWorkspace,
  area: DesignSpaceArea,
  entries: readonly RuntimeSourceWorkspaceEntry[],
  target?: SourceWorkspaceTarget,
): readonly DesignSpaceDevice[] {
  const implementations = implementationsFor(workspace, area, entries, target);
  return target
    ? target.devices.map(({ id }) => id).filter((device) => implementations[device].entry !== undefined)
    : designSpaceDevices;
}

export function sourceTargetRootNodeId(
  nodes: readonly SourceTreeNode[],
  target: SourceWorkspaceTarget | undefined,
  device: DesignSpaceDevice,
): string | undefined {
  const entryId = target?.devices.find((candidate) => candidate.id === device)?.entryId;
  return entryId
    ? nodes.find((node) => node.entries.some((entry) => entry.id === entryId))?.id
    : undefined;
}

function logicalEntryKey(entry: RuntimeSourceWorkspaceEntry): string {
  if (entry.area === "layout") return "layout:app";
  if (entry.area === "components") {
    const folder = /^src\/app\/components\/([^/]+)\//.exec(entry.relativePath)?.[1]
      ?? entry.relativePath.replace(/\/(?:desktop|tablet|mobile)\.tsx?$/, "").replace(/\.tsx?$/, "");
    return `components:${folder}:${entry.exportName}`;
  }
  if (/^src\/app\/(?:desktop|tablet|mobile)\/pages\//.test(entry.relativePath)) {
    return `pages:${entry.exportName}`;
  }
  const pagePath = entry.relativePath
    .replace(/\/(?:desktop|tablet|mobile)\//, "/")
    .replace(/\.tsx?$/, "");
  return `pages:${pagePath}:${entry.exportName}`;
}

function logicalEntryLabel(entry: RuntimeSourceWorkspaceEntry): string {
  return entry.label;
}

function compareNodes(left: SourceTreeNode, right: SourceTreeNode): number {
  const areaOrder: Record<DesignSpaceArea, number> = { layout: 0, pages: 1, components: 2 };
  return areaOrder[left.area] - areaOrder[right.area] || left.label.localeCompare(right.label, "en");
}
