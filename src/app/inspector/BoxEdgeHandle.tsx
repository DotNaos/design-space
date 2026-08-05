import { Button } from "@heroui/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { boxLadder, clamp, isHorizontal, keyboardStep, nearestLadderIndex, outwardDelta, setBoxUniformValue, setBoxValue, type BoxKind, type BoxSide } from "./tailwind-box-model-values";
import { BoxEdge, BoxFocus, BoxScope, barPlacement, beginLadderDrag, boxHue, edgeColor, trackHitBox } from "./TailwindBoxModelDiagram";

export function BoxEdgeHandle(props: {
  bar: number;
  edge: BoxEdge;
  isActive: boolean;
  isDetent: boolean;
  isDragging: boolean;
  kind: BoxKind;
  onChange: (value: string) => void;
  onDetent: () => void;
  onDrag: (focus?: BoxFocus) => void;
  onEdit: (focus?: BoxFocus) => void;
  onHover: (focus?: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  side: BoxSide;
  track: number;
  value: string;
}) {
  const { edge, kind, side } = props;
  const isDraggable = edge.pixels !== undefined;
  const focus: BoxFocus = { kind, side };

  const valueAtStep = (index: number, scope: BoxScope) => {
    const steps = boxLadder(kind);
    const next = steps[clamp(index, 0, steps.length - 1)] ?? 0;
    return scope === "all"
      ? setBoxUniformValue(props.value, kind, `${next}px`)
      : setBoxValue(props.value, kind, side, `${next}px`);
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (edge.pixels === undefined) return;
    const scope: BoxScope = event.altKey ? "all" : "side";
    props.onDrag(focus);
    beginLadderDrag(event, {
      cursor: isHorizontal(side) ? "ns-resize" : "ew-resize",
      delta: (x, y) => outwardDelta(side, x, y),
      maxIndex: boxLadder(kind).length - 1,
      onDetent: props.onDetent,
      onEnd: (index) => {
        props.onInteractionEnd(valueAtStep(index, scope));
        props.onDrag(undefined);
      },
      onStep: (index) => props.onInteractionChange(valueAtStep(index, scope)),
      startIndex: nearestLadderIndex(kind, edge.pixels),
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      props.onEdit(focus);
      return;
    }
    if (edge.pixels === undefined) return;
    const index = nearestLadderIndex(kind, edge.pixels);
    const step = keyboardStep(event.key);
    if (step === undefined) return;
    event.preventDefault();
    props.onChange(valueAtStep(
      step === "zero" ? nearestLadderIndex(kind, 0) : index + step,
      event.altKey ? "all" : "side",
    ));
  };

  return (
    <Button
      isIconOnly
      aria-disabled={!isDraggable}
      aria-label={`Drag ${kind} ${side} · ${edge.display}`}
      className="absolute z-20 !min-h-0 !min-w-0 rounded-[2px] !p-0 outline-none focus-visible:ring-1 focus-visible:ring-sky-400"
      data-box-bar-thickness={props.bar}
      data-box-edge-appearance={edge.appearance}
      data-box-edge-dragging={props.isDragging ? "true" : undefined}
      data-box-edge-thickness={props.track}
      data-box-model-edge={`${kind}:${side}`}
      style={{
        background: "transparent",
        cursor: isDraggable ? (isHorizontal(side) ? "ns-resize" : "ew-resize") : "text",
        ...trackHitBox(side, props.track),
      }}
      variant="ghost"
      onBlur={() => props.onHover(undefined)}
      onDoubleClick={() => props.onEdit(focus)}
      onFocus={() => props.onHover(focus)}
      onKeyDown={handleKeyDown}
      onPointerDown={startDrag}
      onPointerEnter={() => props.onHover(focus)}
      onPointerLeave={() => props.onHover(undefined)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        data-box-model-bar={`${kind}:${side}`}
        style={{
          background: edgeColor(kind, edge, { isActive: props.isActive, isDetent: props.isDetent }),
          borderRadius: 9999,
          boxShadow: props.isActive ? `0 0 0 1px hsl(${boxHue[kind]} 82% 72% / 0.45)` : "none",
          transition: props.isDragging
            ? "width 110ms cubic-bezier(.22,1.35,.36,1), height 110ms cubic-bezier(.22,1.35,.36,1), background-color 90ms ease-out"
            : "width 140ms ease-out, height 140ms ease-out, background-color 140ms ease-out",
          ...barPlacement(side, props.bar),
        }}
      />
    </Button>
  );
}
