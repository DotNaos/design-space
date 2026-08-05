import { ChevronRight, Component } from "lucide-react";
import { Chip } from "@heroui/react";
import type { SourceComponentSlot, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentPicker } from "./SourceComponentPicker";
import { SourceComponentInspectorProps, formatSlotCardinality } from "./SourceComponentInspector";

export function SlotContractProperty(props: {
  slot: SourceComponentSlot;
  slotLayer?: SourceWorkspaceLayer;
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
}) {
  const { slot, slotLayer } = props;
  return (
    <div className="border-t border-white/[0.06] px-4 py-3.5">
      <dt className="flex min-w-0 items-center gap-2">
        <Component aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-zinc-200">{slot.name}</span>
        <span className={`shrink-0 text-[9px] font-medium ${slot.required ? "text-amber-300" : "text-zinc-600"}`}>
          {formatSlotCardinality(slot)}
        </span>
      </dt>
      <dd className="mt-2.5 pl-[21px]">
        {slotLayer && props.onApplySlot && (
          <SourceComponentPicker
            appearance="field"
            candidates={props.candidatesForSlot?.(slotLayer) ?? []}
            isBusy={props.slotEditorReady === false}
            slot={slotLayer}
            onOpen={props.onPrepareSlotEdit}
            onApply={(candidate, action) => props.onApplySlot?.(slotLayer, candidate, action)}
          />
        )}
        <p className={`${slotLayer && props.onApplySlot ? "mt-2.5" : ""} mb-1.5 text-[8px] font-medium text-zinc-700`}>Accepts</p>
        <div className="flex flex-wrap gap-1.5">
          {slot.accepts.map((accepted) => (
            <Chip key={accepted} className="h-5 border-white/[0.08] bg-white/[0.035] px-1.5 text-[9px] text-sky-300/80" size="sm" variant="secondary">
              {accepted}
            </Chip>
          ))}
        </div>
        <details className="group/type mt-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[9px] text-zinc-600 transition-colors hover:text-zinc-400">
            <ChevronRight aria-hidden="true" className="transition-transform group-open/type:rotate-90" size={11} />
            Type definition
          </summary>
          <code className="mt-2 block whitespace-pre-wrap break-words border-l border-white/[0.08] pl-3 font-mono text-[9px] leading-4 text-sky-300/70">
            {slot.type}
          </code>
        </details>
      </dd>
    </div>
  );
}
