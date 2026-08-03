
import type { SourceComponentProp, SourceComponentSlot, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentInspectorProps } from "./SourceComponentInspector";
import { SlotContractProperty } from "./SlotContractProperty";

export function ContractProperty(props: {
  property: SourceComponentProp | SourceComponentSlot;
  slotLayer?: SourceWorkspaceLayer;
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
}) {
  const slot = "accepts" in props.property ? props.property : undefined;
  if (slot) return <SlotContractProperty {...props} slot={slot} />;

  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      <dt className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{props.property.name}</span>
        <span className={`text-[9px] font-medium ${props.property.required ? "text-amber-300" : "text-zinc-600"}`}>
          {props.property.required ? "Required" : "Optional"}
        </span>
      </dt>
      <dd className="mt-1.5">
        <code className="block whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-sky-300/80">
          {props.property.type}
        </code>
      </dd>
    </div>
  );
}
