import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";

export interface SourceLayerOwner {
  entryId: string;
  fileId: string;
  label: string;
  relativePath: string;
}

export function sourceEntryOwner(entry: RuntimeSourceWorkspaceEntry): SourceLayerOwner {
  return {
    entryId: entry.id,
    fileId: entry.fileId,
    label: entry.label,
    relativePath: entry.relativePath,
  };
}

export function sourceLayerOwner(
  entries: readonly RuntimeSourceWorkspaceEntry[],
  layerId: string,
): SourceLayerOwner | undefined {
  const entry = entries.find((candidate) => containsSourceLayer(candidate.layers, layerId));
  return entry ? sourceEntryOwner(entry) : undefined;
}

export function externalSourceLayerOwner(
  currentEntry: RuntimeSourceWorkspaceEntry | undefined,
  entries: readonly RuntimeSourceWorkspaceEntry[],
  layerId: string,
): SourceLayerOwner | undefined {
  const owner = sourceLayerOwner(entries, layerId);
  return owner && owner.fileId !== currentEntry?.fileId ? owner : undefined;
}

function containsSourceLayer(
  layers: readonly SourceWorkspaceLayer[] | undefined,
  layerId: string,
): boolean {
  return (layers ?? []).some((layer) => (
    layer.id === layerId || containsSourceLayer(layer.children, layerId)
  ));
}
