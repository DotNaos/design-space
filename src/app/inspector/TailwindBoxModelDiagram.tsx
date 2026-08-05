
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { boxLadder, clamp, parseBoxLengthPixels, readBoxSource, type BoxCorner, type BoxKind, type BoxSide, type BoxUnit } from "./tailwind-box-model-values";
import { BoxReadout } from "./BoxReadout";
import { BoxRing } from "./BoxRing";

export type BoxFocus = { kind: BoxKind; side: BoxSide | "all" };

export type BoxScope = "side" | "all";
export type BoxEdge = {
  appearance: "empty" | "scaled" | "custom";
  display: string;
  pixels?: number;
  token: string;
};

const kinds: readonly BoxKind[] = ["margin", "border", "padding"];
export const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
export const corners: readonly BoxCorner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
export const cornerName: Record<BoxCorner, string> = {
  bottomLeft: "bottom left",
  bottomRight: "bottom right",
  topLeft: "top left",
  topRight: "top right",
};
export const boxHue: Record<BoxKind, number> = { margin: 20, border: 258, padding: 162 };
const negativeHue = 352;
export const trackThickness: Record<BoxKind, number> = { margin: 14, border: 10, padding: 14 };
export const trackRadius: Record<BoxKind, number> = { margin: 9, border: 7, padding: 5 };
const contentHeight = 56;
export const cornerDotSize = 7;
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

export function trackHitBox(side: BoxSide, track: number): CSSProperties {
  const size = Math.max(track, minimumHitSize);
  const offset = -track + (track - size) / 2;
  if (side === "top") return { height: size, left: -track, right: -track, top: offset, width: "auto" };
  if (side === "bottom") return { bottom: offset, height: size, left: -track, right: -track, width: "auto" };
  if (side === "left") return { bottom: -track, height: "auto", left: offset, top: -track, width: size };
  return { bottom: -track, height: "auto", right: offset, top: -track, width: size };
}

export function barPlacement(side: BoxSide, bar: number): CSSProperties {
  if (side === "top") return { bottom: 0, height: bar, left: 0, right: 0 };
  if (side === "bottom") return { height: bar, left: 0, right: 0, top: 0 };
  if (side === "left") return { bottom: 0, right: 0, top: 0, width: bar };
  return { bottom: 0, left: 0, top: 0, width: bar };
}

export function trackCornerBox(corner: BoxCorner, track: number): CSSProperties {
  const size = 14;
  const offset = -track / 2 - size / 2;
  return {
    ...(corner.startsWith("top") ? { top: offset } : { bottom: offset }),
    ...(corner.endsWith("Left") ? { left: offset } : { right: offset }),
    height: size,
    width: size,
  };
}

export function beginLadderDrag(event: ReactPointerEvent<HTMLButtonElement>, options: {
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

export function trackColor(kind: BoxKind, isActive: boolean): string {
  const hue = boxHue[kind];
  return `hsl(${hue} ${isActive ? 34 : 22}% ${isActive ? 20 : 15}%)`;
}

export function barThickness(kind: BoxKind, edge: BoxEdge, state: { isActive: boolean; isRingHovered: boolean }): number {
  const track = trackThickness[kind];
  const boost = state.isActive ? 2 : state.isRingHovered ? 1 : 0;
  if (edge.appearance === "empty") return Math.min(track, 1 + boost);
  if (edge.appearance === "custom") return Math.min(track, 4 + boost);
  const fill = 2 + edgeRatio(kind, edge.pixels ?? 0) * (track - 4);
  return Math.min(track, Math.round(fill) + boost);
}

export function edgeColor(kind: BoxKind, edge: BoxEdge, state: { isActive: boolean; isDetent: boolean }): string {
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

export function readBoxTarget(className: string, kind: BoxKind, side: BoxSide | "all") {
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
