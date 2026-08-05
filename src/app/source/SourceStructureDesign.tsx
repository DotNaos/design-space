
import type { RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceSlotScope } from "./source-slot-navigation";
import { structureLayer } from "./source-static-preview";
import { SourceCanvasSlotMarker } from "./SourceCanvasSlotMarker";

export function SourceStructureDesign(props: {
  entry: RuntimeSourceWorkspaceEntry;
  slotLayers: readonly SourceWorkspaceLayer[];
  slotScopes?: Readonly<Record<string, SourceSlotScope>>;
}) {
  const slotsById = new Map(props.slotLayers.map((slot) => [slot.id, slot]));
  const slotsByComponent = new Map(props.slotLayers.flatMap((slot) => (
    slot.children.filter((child) => child.kind === "component").map((child) => [child.id, slot] as const)
  )));
  const attached = new Set<string>();
  const layers = (props.entry.layers ?? []).map((layer) => structureLayer(
    layer,
    slotsById,
    slotsByComponent,
    attached,
    props.slotScopes,
    true,
  ));
  const remaining = props.slotLayers.filter((slot) => !attached.has(slot.id));
  return (
    <div data-design-space-preview-entry-root style={{ height: "100%", minHeight: "100%", width: "100%" }}>
      {layers}
      {remaining.map((slot) => <SourceCanvasSlotMarker key={slot.id} label={slot.label} layerId={slot.id} scope={props.slotScopes?.[slot.id]} />)}
    </div>
  );
}
