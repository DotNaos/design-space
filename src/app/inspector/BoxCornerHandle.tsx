import { Button } from "@heroui/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { boxLadder, clamp, cornerDelta, nearestLadderIndex, setBoxUniformValue, type BoxCorner, type BoxKind } from "./tailwind-box-model-values";
import { BoxFocus, beginLadderDrag, boxHue, cornerDotSize, cornerName, readBoxTarget, trackCornerBox } from "./TailwindBoxModelDiagram";

export function BoxCornerHandle(props: {
  corner: BoxCorner;
  isActive: boolean;
  isDragging: boolean;
  isRingHovered: boolean;
  kind: BoxKind;
  onChange: (value: string) => void;
  onDetent: () => void;
  onDrag: (focus?: BoxFocus) => void;
  onHover: (focus?: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  track: number;
  value: string;
}) {
  const { corner, kind } = props;
  const target = readBoxTarget(props.value, kind, "all");
  const focus: BoxFocus = { kind, side: "all" };
  const isDraggable = target.pixels !== undefined;

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (target.pixels === undefined) return;
    props.onDrag(focus);
    beginLadderDrag(event, {
      cursor: corner === "topLeft" || corner === "bottomRight" ? "nwse-resize" : "nesw-resize",
      delta: (x, y) => cornerDelta(corner, x, y),
      maxIndex: boxLadder(kind).length - 1,
      onDetent: props.onDetent,
      onEnd: (index) => {
        const steps = boxLadder(kind);
        const next = steps[clamp(index, 0, steps.length - 1)] ?? 0;
        props.onInteractionEnd(setBoxUniformValue(props.value, kind, `${next}px`));
        props.onDrag(undefined);
      },
      onStep: (index) => {
        const steps = boxLadder(kind);
        const next = steps[clamp(index, 0, steps.length - 1)] ?? 0;
        props.onInteractionChange(setBoxUniformValue(props.value, kind, `${next}px`));
      },
      startIndex: nearestLadderIndex(kind, target.pixels),
    });
  };

  return (
    <Button
      isIconOnly
      excludeFromTabOrder
      aria-disabled={!isDraggable}
      aria-label={`Resize ${kind} on all sides from ${cornerName[corner]} · ${target.display}`}
      className="absolute z-30 !min-h-0 !min-w-0 rounded-[3px] !p-0 outline-none"
      data-box-corner-dragging={props.isDragging ? "true" : undefined}
      data-box-model-corner={`${kind}:${corner}`}
      style={{
        background: "transparent",
        cursor: isDraggable ? (corner === "topLeft" || corner === "bottomRight" ? "nwse-resize" : "nesw-resize") : "default",
        ...trackCornerBox(corner, props.track),
      }}
      variant="ghost"
      onPointerDown={startDrag}
      onPointerEnter={() => props.onHover(focus)}
      onPointerLeave={() => props.onHover(undefined)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
        style={{
          background: `hsl(${boxHue[kind]} ${props.isActive ? 92 : 78}% ${props.isActive ? 78 : 66}%)`,
          boxShadow: "0 0 0 1.5px #101115",
          height: props.isActive ? cornerDotSize + 2 : cornerDotSize,
          opacity: props.isActive ? 1 : props.isRingHovered ? 0.85 : 0,
          transition: "opacity 140ms ease-out, background-color 140ms ease-out, width 140ms ease-out, height 140ms ease-out",
          translate: "-50% -50%",
          width: props.isActive ? cornerDotSize + 2 : cornerDotSize,
        }}
      />
    </Button>
  );
}
