
import type { ReactNode } from "react";
import { type BoxKind, type BoxSide } from "./tailwind-box-model-values";
import { BoxEdge, BoxFocus, barThickness, corners, sides, trackColor, trackRadius, trackThickness } from "./TailwindBoxModelDiagram";
import { BoxEdgeHandle } from "./BoxEdgeHandle";
import { BoxCornerHandle } from "./BoxCornerHandle";

export function BoxRing(props: {
  children: ReactNode;
  dragged?: BoxFocus;
  edges: Record<BoxSide, BoxEdge>;
  focus?: BoxFocus;
  isDetent: boolean;
  kind: BoxKind;
  onChange: (value: string) => void;
  onDetent: () => void;
  onDrag: (focus?: BoxFocus) => void;
  onEdit: (focus?: BoxFocus) => void;
  onHover: (focus?: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  value: string;
}) {
  const track = trackThickness[props.kind];
  const isActive = (side: BoxSide) => props.focus?.kind === props.kind
    && (props.focus.side === side || props.focus.side === "all");
  const isDragging = (side: BoxSide) => props.dragged?.kind === props.kind
    && (props.dragged.side === side || props.dragged.side === "all");
  const isRingActive = props.focus?.kind === props.kind;

  return (
    <div
      className="relative"
      data-box-band-thickness={track}
      data-box-model-layer={props.kind}
      data-box-ring-hovered={isRingActive ? "true" : undefined}
      data-box-track-size={track}
      style={{
        borderColor: trackColor(props.kind, isRingActive),
        borderRadius: trackRadius[props.kind],
        borderStyle: "solid",
        borderWidth: track,
        transition: "border-color 140ms ease-out",
      }}
    >
      {sides.map((side) => (
        <BoxEdgeHandle
          bar={barThickness(props.kind, props.edges[side], {
            isActive: isActive(side),
            isRingHovered: isRingActive,
          })}
          edge={props.edges[side]}
          isActive={isActive(side)}
          isDetent={props.isDetent && isDragging(side)}
          isDragging={props.dragged?.kind === props.kind && props.dragged.side === side}
          key={side}
          kind={props.kind}
          side={side}
          track={track}
          value={props.value}
          onChange={props.onChange}
          onDetent={props.onDetent}
          onDrag={props.onDrag}
          onEdit={props.onEdit}
          onHover={props.onHover}
          onInteractionChange={props.onInteractionChange}
          onInteractionEnd={props.onInteractionEnd}
        />
      ))}
      {corners.map((corner) => (
        <BoxCornerHandle
          corner={corner}
          isActive={props.focus?.kind === props.kind && props.focus.side === "all"}
          isDragging={props.dragged?.kind === props.kind && props.dragged.side === "all"}
          isRingHovered={isRingActive}
          key={corner}
          kind={props.kind}
          track={track}
          value={props.value}
          onChange={props.onChange}
          onDetent={props.onDetent}
          onDrag={props.onDrag}
          onHover={props.onHover}
          onInteractionChange={props.onInteractionChange}
          onInteractionEnd={props.onInteractionEnd}
        />
      ))}
      {props.children}
    </div>
  );
}
