import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";

export function sourceEntrySlotLayers(
  entry: RuntimeSourceWorkspaceEntry | undefined,
): readonly SourceWorkspaceLayer[] {
  const slots: SourceWorkspaceLayer[] = [];
  const visit = (layers: readonly SourceWorkspaceLayer[] | undefined) => {
    for (const layer of layers ?? []) {
      if (layer.kind === "slot" && layer.slot) slots.push(layer);
      visit(layer.children);
    }
  };
  visit(entry?.layers);
  return slots;
}
