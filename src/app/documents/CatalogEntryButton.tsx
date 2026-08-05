
import { Button } from "@heroui/react";
import { Component } from "lucide-react";
import type { DocumentAdapterView } from "../document/document-adapters";

export function CatalogEntryButton(props: {
  entry: DocumentAdapterView;
  selected: boolean;
  onSelect: (componentId: string) => void;
}) {
  const origin = props.entry.targetAdapter ? "Target" : "Authored";
  const status = props.entry.targetAdapter ? "Read only" : "Editable";
  const slotCount = props.entry.component.slots.length;
  return (
    <Button
      aria-pressed={props.selected}
      className={`min-h-16 w-full justify-start rounded-none px-4 py-2 text-left ${props.selected ? "bg-sky-500/10" : ""}`}
      fullWidth
      size="sm"
      variant="ghost"
      onPress={() => props.onSelect(props.entry.component.id)}
    >
      <Component aria-hidden="true" className={props.entry.targetAdapter ? "text-sky-400" : "text-cyan-300"} size={14} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-zinc-300">{props.entry.component.label}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] leading-4 text-zinc-600">
          <span>{origin}</span>
          <span aria-hidden="true">·</span>
          <span>{status}</span>
          <span aria-hidden="true">·</span>
          <span>{slotCount ? `${slotCount} ${slotCount === 1 ? "slot" : "slots"}` : "No slots"}</span>
        </span>
      </span>
    </Button>
  );
}
