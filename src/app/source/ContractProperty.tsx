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
    <div className="flex min-h-9 items-center gap-2 border-t border-white/[0.06] px-4 py-1.5">
      <dt className="max-w-[42%] shrink-0 truncate font-mono text-[11px] text-zinc-300" title={props.property.name}>
        {props.property.name}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-sky-300/80" title={props.property.type}>
          {props.property.type}
        </code>
        <span className={`shrink-0 text-[9px] font-medium ${props.property.required ? "text-amber-300" : "text-zinc-600"}`}>
          {props.property.required ? "Required" : "Optional"}
        </span>
      </dd>
    </div>
  );
}
