import { Button, Input, TextField } from "@heroui/react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import {
  boxLadder,
  clamp,
  cornerDelta,
  formatBoxUnitValue,
  isHorizontal,
  keyboardStep,
  nearestLadderIndex,
  outwardDelta,
  parseBoxLengthPixels,
  parseBoxUnitValue,
  readBoxSource,
  setBoxUniformValue,
  setBoxValue,
  type BoxCorner,
  type BoxKind,
  type BoxSide,
  type BoxUnit,
} from "./tailwind-box-model-values";

export type BoxFocus = { kind: BoxKind; side: BoxSide | "all" };

type BoxScope = "side" | "all";
type BoxEdge = {
  appearance: "empty" | "scaled" | "custom";
  display: string;
  pixels?: number;
  token: string;
};

const kinds: readonly BoxKind[] = ["margin", "border", "padding"];
const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
const corners: readonly BoxCorner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const cornerName: Record<BoxCorner, string> = {
  bottomLeft: "bottom left",
  bottomRight: "bottom right",
  topLeft: "top left",
  topRight: "top right",
};
const boxHue: Record<BoxKind, number> = { margin: 20, border: 258, padding: 162 };
const negativeHue = 352;
const trackThickness: Record<BoxKind, number> = { margin: 14, border: 10, padding: 14 };
const trackRadius: Record<BoxKind, number> = { margin: 9, border: 7, padding: 5 };
const contentHeight = 56;
const cornerDotSize = 7;
const minimumHitSize = 12;
const dragPixelsPerStep = 8;
const detentThreshold = 0.62;

export function BoxModelDiagram(props: {
  dragged?: BoxFocus;
  edited?: BoxFocus;
  focus?: BoxFocus;
  isDetent: boolean;
  onChange: (value: string) => void;
  onCloseEditor: () => void;
  onDetent: () => void;
  onDrag: (focus?: BoxFocus) => void;
  onEdit: (focus?: BoxFocus) => void;
  onHover: (focus?: BoxFocus) => void;
  onInteractionChange: (value: string) => void;
  onInteractionEnd: (value?: string) => void;
  unit: BoxUnit;
  value: string;
}) {
  const rings = kinds.map((kind) => ({
    edges: Object.fromEntries(
      sides.map((side) => [side, describeEdge(props.value, kind, side)]),
    ) as Record<BoxSide, BoxEdge>,
    kind,
  }));

  return (
    <div className="overflow-hidden rounded-xl bg-[#101115] p-3 shadow-[inset_0_1px_rgba(255,255,255,0.025)]">
      {rings.reduceRight<ReactNode>((child, ring) => (
        <BoxRing
          dragged={props.dragged}
          edges={ring.edges}
          focus={props.focus}
          isDetent={props.isDetent}
          key={ring.kind}
          kind={ring.kind}
          value={props.value}
          onChange={props.onChange}
          onDetent={props.onDetent}
          onDrag={props.onDrag}
          onEdit={props.onEdit}
          onHover={props.onHover}
          onInteractionChange={props.onInteractionChange}
          onInteractionEnd={props.onInteractionEnd}
        >
          {child}
        </BoxRing>
      ), (
        <div
          aria-label="Content box"
          className="relative rounded-[4px] bg-[#0b0c0f]"
          data-box-content-height={contentHeight}
          style={{
            backgroundImage: "radial-gradient(circle at center, #23252c 0.5px, transparent 0.5px)",
            backgroundSize: "6px 6px",
            height: contentHeight,
          }}
        >
          <BoxReadout
            focus={props.focus}
            isEditing={props.edited !== undefined}
            unit={props.unit}
            value={props.value}
            onChange={props.onChange}
            onCloseEditor={props.onCloseEditor}
          />
        </div>
      ))}
    </div>
  );
}

function BoxReadout(props: {
  focus?: BoxFocus;
  isEditing: boolean;
  onChange: (value: string) => void;
  onCloseEditor: () => void;
  unit: BoxUnit;
  value: string;
}) {
  if (!props.focus) return null;

  const { kind, side } = props.focus;
  const edge = readBoxTarget(props.value, kind, side);
  const label = `${kind} ${side === "all" ? "all sides" : side}`;
  const display = edge.display === "mixed" ? edge.display : formatBoxUnitValue(edge.display, kind, props.unit);

  if (props.isEditing && side !== "all") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center" data-box-model-readout>
        <TextField
          aria-label={`${kind} ${side}`}
          autoFocus
          value={display}
          onChange={(value) => {
            const parsed = parseBoxUnitValue(value, kind, props.unit);
            if (parsed !== undefined) props.onChange(setBoxValue(props.value, kind, side, parsed));
          }}
        >
          <Input
            className="h-7 w-24 rounded-lg border-0 bg-[#22242a] px-2 text-center text-sm font-semibold tabular-nums text-zinc-100 outline-none focus:ring-1 focus:ring-sky-400"
            onBlur={props.onCloseEditor}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") props.onCloseEditor();
            }}
          />
        </TextField>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex min-w-0 items-center justify-center gap-2 px-3"
      data-box-model-readout
    >
      <span className="truncate text-[11px] font-medium capitalize text-zinc-400">{label}</span>
      <span
        className="shrink-0 text-[15px] font-semibold tracking-[-0.02em] tabular-nums"
        style={{ color: `hsl(${boxHue[kind]} 78% 70%)` }}
      >
        {display}
      </span>
      <span className="max-w-[35%] truncate text-[9px] font-medium text-zinc-600">
        {edge.token || "unset"}
      </span>
    </div>
  );
}

function BoxRing(props: {
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

function BoxEdgeHandle(props: {
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

function BoxCornerHandle(props: {
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

function trackHitBox(side: BoxSide, track: number): CSSProperties {
  const size = Math.max(track, minimumHitSize);
  const offset = -track + (track - size) / 2;
  if (side === "top") return { height: size, left: -track, right: -track, top: offset, width: "auto" };
  if (side === "bottom") return { bottom: offset, height: size, left: -track, right: -track, width: "auto" };
  if (side === "left") return { bottom: -track, height: "auto", left: offset, top: -track, width: size };
  return { bottom: -track, height: "auto", right: offset, top: -track, width: size };
}

function barPlacement(side: BoxSide, bar: number): CSSProperties {
  if (side === "top") return { bottom: 0, height: bar, left: 0, right: 0 };
  if (side === "bottom") return { height: bar, left: 0, right: 0, top: 0 };
  if (side === "left") return { bottom: 0, right: 0, top: 0, width: bar };
  return { bottom: 0, left: 0, top: 0, width: bar };
}

function trackCornerBox(corner: BoxCorner, track: number): CSSProperties {
  const size = 14;
  const offset = -track / 2 - size / 2;
  return {
    ...(corner.startsWith("top") ? { top: offset } : { bottom: offset }),
    ...(corner.endsWith("Left") ? { left: offset } : { right: offset }),
    height: size,
    width: size,
  };
}

function beginLadderDrag(event: ReactPointerEvent<HTMLButtonElement>, options: {
  cursor: string;
  delta: (x: number, y: number) => number;
  maxIndex: number;
  onDetent: () => void;
  onEnd: (index: number) => void;
  onStep: (index: number) => void;
  startIndex: number;
}) {
  event.preventDefault();
  event.stopPropagation();
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture is optional; the window listeners continue the gesture outside the track.
  }
  const startX = event.clientX;
  const startY = event.clientY;
  const pointerId = event.pointerId;
  const restoreCursor = document.body.style.cursor;
  const restoreSelect = document.body.style.userSelect;
  document.body.style.cursor = options.cursor;
  document.body.style.userSelect = "none";

  let rung = 0;
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    const travelled = options.delta(moveEvent.clientX - startX, moveEvent.clientY - startY) / dragPixelsPerStep;
    if (Math.abs(travelled - rung) < detentThreshold) return;
    const next = clamp(Math.round(travelled), -options.startIndex, options.maxIndex - options.startIndex);
    if (next === rung) return;
    rung = next;
    options.onDetent();
    options.onStep(options.startIndex + next);
  };
  const finish = (finishEvent: PointerEvent) => {
    if (finishEvent.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    document.body.style.cursor = restoreCursor;
    document.body.style.userSelect = restoreSelect;
    options.onEnd(options.startIndex + rung);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}

function describeEdge(className: string, kind: BoxKind, side: BoxSide): BoxEdge {
  const source = readBoxSource(className, kind, side);
  const isZero = !source.value || source.value === "0" || source.value === "0px";
  const pixels = parseBoxLengthPixels(source.value);
  return {
    appearance: isZero ? "empty" : pixels === undefined ? "custom" : "scaled",
    display: source.value || "0",
    pixels,
    token: source.token,
  };
}

function trackColor(kind: BoxKind, isActive: boolean): string {
  const hue = boxHue[kind];
  return `hsl(${hue} ${isActive ? 34 : 22}% ${isActive ? 20 : 15}%)`;
}

function barThickness(kind: BoxKind, edge: BoxEdge, state: { isActive: boolean; isRingHovered: boolean }): number {
  const track = trackThickness[kind];
  const boost = state.isActive ? 2 : state.isRingHovered ? 1 : 0;
  if (edge.appearance === "empty") return Math.min(track, 1 + boost);
  if (edge.appearance === "custom") return Math.min(track, 4 + boost);
  const fill = 2 + edgeRatio(kind, edge.pixels ?? 0) * (track - 4);
  return Math.min(track, Math.round(fill) + boost);
}

function edgeColor(kind: BoxKind, edge: BoxEdge, state: { isActive: boolean; isDetent: boolean }): string {
  const hue = (edge.pixels ?? 0) < 0 ? negativeHue : boxHue[kind];
  const lift = (state.isActive ? 12 : 0) + (state.isDetent ? 14 : 0);
  if (edge.appearance === "empty") return `hsl(${hue} ${24 + lift}% ${28 + lift}%)`;
  if (edge.appearance === "custom") return `hsl(${hue} ${30 + lift}% ${46 + lift}%)`;
  const ratio = edgeRatio(kind, edge.pixels ?? 0);
  return `hsl(${hue} ${46 + ratio * 32 + lift}% ${38 + ratio * 24 + lift}%)`;
}

function edgeRatio(kind: BoxKind, pixels: number): number {
  const steps = boxLadder(kind).filter((step) => step >= 0);
  if (steps.length < 2) return 0;
  const magnitude = Math.abs(pixels);
  const largest = steps[steps.length - 1] ?? 1;
  if (kind === "border") return clamp(magnitude / largest, 0, 1);
  const index = steps.reduce((nearest, step, position) => (
    Math.abs(step - magnitude) < Math.abs((steps[nearest] ?? 0) - magnitude) ? position : nearest
  ), 0);
  return index / (steps.length - 1);
}

function readBoxTarget(className: string, kind: BoxKind, side: BoxSide | "all") {
  if (side !== "all") {
    const edge = describeEdge(className, kind, side);
    return { display: edge.display, pixels: edge.pixels, token: edge.token };
  }
  const edges = sides.map((each) => describeEdge(className, kind, each));
  const values = edges.map((edge) => edge.pixels);
  const first = edges[0]!;
  return {
    display: new Set(edges.map((edge) => edge.display)).size === 1 ? first.display : "mixed",
    pixels: values.includes(undefined) ? undefined : Math.max(...(values as number[])),
    token: new Set(edges.map((edge) => edge.token)).size === 1 ? first.token : "mixed",
  };
}
