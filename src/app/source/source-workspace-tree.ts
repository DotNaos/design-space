import {
  designSpaceDevices,
  type DesignSpaceArea,
  type DesignSpaceDevice,
  type RuntimeSourceWorkspace,
  type RuntimeSourceWorkspaceEntry,
} from "../../shared/source-workspace";

export type SourceImplementationState = "direct" | "fallback" | "missing" | "responsive";

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
  implementations: Readonly<Record<DesignSpaceDevice, SourceImplementation>>;
}

export interface SourceTreeSelection {
  device: DesignSpaceDevice;
  nodeId: string;
}

export function sourceTreeNodes(workspace: RuntimeSourceWorkspace): readonly SourceTreeNode[] {
  const groups = new Map<string, { area: DesignSpaceArea; label: string; entries: RuntimeSourceWorkspaceEntry[] }>();

  for (const entry of workspace.entries) {
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
      implementations: implementationsFor(workspace, group.area, group.entries),
    }))
    .sort(compareNodes);
}

export function initialSourceTreeSelection(nodes: readonly SourceTreeNode[]): SourceTreeSelection | undefined {
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
): Readonly<Record<DesignSpaceDevice, SourceImplementation>> {
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
  if (entry.area === "layout") return "App layout";
  return entry.label;
}

function compareNodes(left: SourceTreeNode, right: SourceTreeNode): number {
  const areaOrder: Record<DesignSpaceArea, number> = { layout: 0, pages: 1, components: 2 };
  return areaOrder[left.area] - areaOrder[right.area] || left.label.localeCompare(right.label, "en");
}
