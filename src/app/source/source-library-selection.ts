import type {
  RuntimeSourceWorkspace,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";

export function findSourceLibraryLayerOwner(
  workspace: RuntimeSourceWorkspace | undefined,
  layerId: string | undefined,
): RuntimeSourceWorkspaceEntry | undefined {
  if (!layerId) return undefined;
  return workspace?.entries.find((entry) => containsLayer(entry.layers, layerId));
}

function containsLayer(layers: readonly SourceWorkspaceLayer[] | undefined, layerId: string): boolean {
  return layers?.some((layer) => layer.id === layerId || containsLayer(layer.children, layerId)) ?? false;
}
