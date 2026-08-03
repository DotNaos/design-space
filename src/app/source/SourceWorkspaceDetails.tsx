

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { CodeDocumentSwitch } from "./CodeDocumentSwitch";

export function findSourceSlotLayer(
  layers: readonly SourceWorkspaceLayer[] | undefined,
  slotName: string,
): SourceWorkspaceLayer | undefined {
  for (const layer of layers ?? []) {
    if (layer.kind === "slot" && layer.label === slotName) return layer;
    const nested = findSourceSlotLayer(layer.children, slotName);
    if (nested) return nested;
  }
  return undefined;
}

export function FileEvidencePanel(props: { editable: boolean; label?: string }) {
  return (
    <aside aria-label="Project file evidence" className="flex h-full w-full flex-col border-l border-white/10 bg-[#141518] p-4">
      <h2 className="truncate text-sm font-semibold text-zinc-200">{props.label ?? "Project source"}</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {props.label ? props.editable
          ? "This file is part of the trusted TypeScript component catalog and can be edited through an exact diff."
          : "This file is registered for browsing but remains read only."
          : "Choose a registered file in the tree. Its code will open in the center workspace."}
      </p>
    </aside>
  );
}

export { CodeDocumentSwitch } from "./CodeDocumentSwitch";
