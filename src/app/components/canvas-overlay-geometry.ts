import type { Selection } from "../types";
import type { StrictUiCanvasTarget } from "../strict-ui/strict-ui-markers";

export type ViewRect = { left: number; top: number; width: number; height: number };

export type CanvasOverlayLabelInput = {
  id: string;
  text: string;
  anchor: ViewRect;
  placement: "selection" | "slot";
};

export type CanvasOverlayLabel = CanvasOverlayLabelInput & ViewRect;

export type EmptySlotOverlayInput = { id: string; rect: ViewRect };

const baseGridStep = 20;
const baseGridDotRadius = 2;
const minimumGridScreenStep = 12;
const maximumGridScreenStep = 32;
const labelHeight = 20;
const labelMargin = 4;

export function measureCanvasSelector(
  world: HTMLElement,
  selector: string,
  viewport: DOMRect,
  devicePixelRatio = currentDevicePixelRatio(),
): ViewRect | undefined {
  const rects = [...world.querySelectorAll<HTMLElement>(selector)]
    .filter((element) => element.isConnected)
    .flatMap((element) => measurableRects(element))
    .filter((rect) => rect.width > 0 || rect.height > 0);
  if (!rects.length) return undefined;
  const left = snapToDevicePixel(Math.min(...rects.map((rect) => rect.left)) - viewport.left, devicePixelRatio);
  const top = snapToDevicePixel(Math.min(...rects.map((rect) => rect.top)) - viewport.top, devicePixelRatio);
  const right = snapToDevicePixel(Math.max(...rects.map((rect) => rect.right)) - viewport.left, devicePixelRatio);
  const bottom = snapToDevicePixel(Math.max(...rects.map((rect) => rect.bottom)) - viewport.top, devicePixelRatio);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function selectorForSelection(selection: Selection): string {
  if (selection.kind === "component") return attributeSelector("data-design-space-instance-id", selection.id);
  if (selection.kind === "slot") return attributeSelector("data-design-space-slot-id", selection.id);
  if (selection.kind === "html") return attributeSelector("data-design-space-html-id", selection.id);
  return attributeSelector("data-design-space-outlet-id", selection.outletId);
}

export function selectorForStrictUiTarget(target: StrictUiCanvasTarget): string {
  const attribute = target.kind === "instance"
    ? "data-design-space-instance-id"
    : target.kind === "outlet"
      ? "data-design-space-outlet-id"
      : "data-design-space-slot-id";
  return attributeSelector(attribute, target.id);
}

export function canvasGridPresentation(scale: number, anchor: { x: number; y: number }) {
  const worldStep = gridWorldStep(scale);
  const dotRadius = baseGridDotRadius * scale;
  return {
    anchorX: snapToDevicePixel(anchor.x),
    anchorY: snapToDevicePixel(anchor.y),
    dotRadius,
    opacity: scale < 0.5 ? 0.72 : scale < 0.75 ? 0.58 : 0.42,
    screenStep: worldStep * scale,
    worldStep,
  };
}

export function gridWorldStep(scale: number): number {
  let step = baseGridStep;
  while (step * scale < minimumGridScreenStep) step *= 2;
  while (step * scale > maximumGridScreenStep) step /= 2;
  return step;
}

export function layoutEmptySlotOverlays(
  inputs: readonly EmptySlotOverlayInput[],
  scale: number,
  devicePixelRatio = currentDevicePixelRatio(),
): Readonly<Record<string, ViewRect>> {
  const ordered = [...inputs].sort((first, second) => first.rect.top - second.rect.top || first.rect.left - second.rect.left);
  return Object.fromEntries(ordered.map((input, index) => {
    const minimumHeight = Math.max(1 / devicePixelRatio, snapToDevicePixel(32 * scale, devicePixelRatio));
    let height = Math.max(input.rect.height, minimumHeight);
    const next = ordered.slice(index + 1).find((candidate) => (
      candidate.rect.top > input.rect.top && horizontallyOverlaps(input.rect, candidate.rect)
    ));
    if (next && input.rect.top + height >= next.rect.top) {
      height = Math.max(input.rect.height, 1 / devicePixelRatio, next.rect.top - input.rect.top - 2 / devicePixelRatio);
    }
    return [input.id, { ...input.rect, height: snapToDevicePixel(height, devicePixelRatio) }];
  }));
}

export function placeCanvasOverlayLabels(
  inputs: readonly CanvasOverlayLabelInput[],
  obstacles: readonly ViewRect[],
  viewport: { width: number; height: number },
): readonly CanvasOverlayLabel[] {
  const placed: CanvasOverlayLabel[] = [];
  for (const input of inputs) {
    const width = Math.min(160, Math.max(56, input.text.length * 5.8 + 12));
    const candidates = labelCandidates(input, width);
    const available = candidates
      .map((candidate) => clampRect(candidate, viewport))
      .find((candidate) => ![...obstacles, ...placed].some((occupied) => overlaps(candidate, occupied)));
    const fallback = findVerticalFallback(clampRect(candidates[0], viewport), obstacles, placed, viewport);
    placed.push({ ...input, ...(available ?? fallback) });
  }
  return placed;
}

export function strictUiBadgeObstacle(rect: ViewRect): ViewRect {
  return { left: rect.left + rect.width - 18, top: rect.top - 18, width: 36, height: 36 };
}

export function sameSelection(first: Selection | undefined, second: Selection | undefined): boolean {
  return Boolean(first && second && first.kind === second.kind && first.id === second.id);
}

export function snapToDevicePixel(value: number, devicePixelRatio = currentDevicePixelRatio()): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(value * ratio) / ratio;
}

function currentDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

function measurableRects(element: HTMLElement): DOMRect[] {
  const own = element.getBoundingClientRect();
  if (own.width > 0 || own.height > 0) return [own];
  return [...element.querySelectorAll<HTMLElement>("*")]
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
}

function attributeSelector(attribute: string, value: string): string {
  return `[${attribute}="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

function labelCandidates(input: CanvasOverlayLabelInput, width: number): ViewRect[] {
  const { anchor } = input;
  const above = anchor.top - labelHeight - labelMargin;
  const below = anchor.top + anchor.height + labelMargin;
  const left = anchor.left;
  const right = anchor.left + anchor.width - width;
  const insideTop = anchor.top + labelMargin;
  return input.placement === "selection"
    ? [rect(left, above, width), rect(left, insideTop, width), rect(left, below, width), rect(right, above, width)]
    : anchor.height >= labelHeight + labelMargin * 2
      ? [rect(right, insideTop, width), rect(right, above, width), rect(right, below, width), rect(left, above, width)]
      : [rect(right, above, width), rect(right, below, width), rect(left, above, width), rect(left, below, width)];
}

function rect(left: number, top: number, width: number): ViewRect {
  return { left, top, width, height: labelHeight };
}

function clampRect(value: ViewRect, viewport: { width: number; height: number }): ViewRect {
  return {
    ...value,
    left: Math.min(Math.max(labelMargin, value.left), Math.max(labelMargin, viewport.width - value.width - labelMargin)),
    top: Math.min(Math.max(labelMargin, value.top), Math.max(labelMargin, viewport.height - value.height - labelMargin)),
  };
}

function findVerticalFallback(
  preferred: ViewRect,
  obstacles: readonly ViewRect[],
  placed: readonly ViewRect[],
  viewport: { width: number; height: number },
): ViewRect {
  const occupied = [...obstacles, ...placed];
  for (let top = labelMargin; top <= viewport.height - labelHeight - labelMargin; top += labelHeight + labelMargin) {
    const candidate = { ...preferred, top };
    if (!occupied.some((item) => overlaps(candidate, item))) return candidate;
  }
  return preferred;
}

function overlaps(first: ViewRect, second: ViewRect): boolean {
  return first.left < second.left + second.width
    && first.left + first.width > second.left
    && first.top < second.top + second.height
    && first.top + first.height > second.top;
}

function horizontallyOverlaps(first: ViewRect, second: ViewRect): boolean {
  return first.left < second.left + second.width && first.left + first.width > second.left;
}
