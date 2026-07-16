import type {
  DesignSpaceArea,
  DesignSpaceDevice,
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
} from "../../shared/source-workspace";

export interface ResolvedSourceEntries {
  requestedDevice: DesignSpaceDevice;
  sourceDevice: DesignSpaceDevice;
  fallback: boolean;
  entries: readonly RuntimeSourceWorkspaceEntry[];
}

export function resolveSourceEntries(
  workspace: RuntimeSourceWorkspace,
  area: DesignSpaceArea,
  device: DesignSpaceDevice,
): ResolvedSourceEntries {
  const state = workspace.devices.find((candidate) => candidate.area === area && candidate.device === device);
  const sourceDevice = state?.state === "fallback" && state.fallback ? state.fallback : device;
  return {
    requestedDevice: device,
    sourceDevice,
    fallback: sourceDevice !== device,
    entries: workspace.entries.filter((entry) => entry.area === area && entry.device === sourceDevice),
  };
}

export function initialSourceSelection(workspace: RuntimeSourceWorkspace): {
  entry?: RuntimeSourceWorkspaceEntry;
  device: DesignSpaceDevice;
} {
  const priorities: readonly [DesignSpaceArea, DesignSpaceDevice][] = [
    ["root", "desktop"],
    ["pages", "desktop"],
    ["root", "mobile"],
    ["pages", "mobile"],
    ["components", "desktop"],
  ];
  for (const [area, device] of priorities) {
    const entry = resolveSourceEntries(workspace, area, device).entries[0];
    if (entry) return { entry, device };
  }
  return { entry: workspace.entries[0], device: workspace.entries[0]?.device ?? "desktop" };
}
