
import type { SourceComponentProp, SourceComponentSlot, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentInspectorProps } from "./SourceComponentInspector";
import { ContractProperty } from "./ContractProperty";

export function ContractSection(props: {
  icon: React.ReactNode;
  properties: readonly (SourceComponentProp | SourceComponentSlot)[];
  slotLayers?: readonly SourceWorkspaceLayer[];
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
  title: "Props" | "Slots";
}) {
  return (
    <section aria-labelledby={`source-contract-${props.title.toLowerCase()}`} className="border-b border-white/10">
      <header className="flex h-9 items-center gap-2 px-4 text-zinc-500">
        {props.icon}
        <h3 id={`source-contract-${props.title.toLowerCase()}`} className="text-[10px] font-medium">
          {props.title}
        </h3>
        <span className="ml-auto text-[9px] tabular-nums text-zinc-700">{props.properties.length}</span>
      </header>
      {props.properties.length ? (
        <dl>
          {props.properties.map((property) => (
            <ContractProperty
              key={property.name}
              property={property}
              slotLayer={"accepts" in property ? props.slotLayers?.find((layer) => layer.label === property.name) : undefined}
              slotEditorReady={props.slotEditorReady}
              candidatesForSlot={props.candidatesForSlot}
              onApplySlot={props.onApplySlot}
              onPrepareSlotEdit={props.onPrepareSlotEdit}
            />
          ))}
        </dl>
      ) : null}
    </section>
  );
}
