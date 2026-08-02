import { Button } from "@heroui/react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";

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

export function CodeDocumentSwitch(props: {
  value: "source" | "design";
  onChange: (value: "source" | "design") => void;
}) {
  return (
    <div aria-label="Code file" className="flex shrink-0 items-center rounded-md bg-white/[0.04] p-0.5" role="group">
      <Button
        aria-pressed={props.value === "source"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "source" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("source")}
      >
        Source
      </Button>
      <Button
        aria-pressed={props.value === "design"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "design" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("design")}
      >
        Design file
      </Button>
    </div>
  );
}
