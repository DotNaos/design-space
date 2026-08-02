import type { CanvasCamera } from "../../canvas-transform";
import type { ViewRect } from "./canvas-overlay-geometry";

export function applyCanvasCamera(world: HTMLElement, camera: CanvasCamera): void {
  const scale = String(camera.scale);
  const transform = canvasWorldTransform(camera);
  if (world.dataset.canvasScale !== scale) world.dataset.canvasScale = scale;
  if (world.style.transform !== transform) world.style.transform = transform;
}

export function canvasWorldTransform(camera: CanvasCamera): string {
  return `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
}

export function sameViewRect(current: ViewRect | undefined, next: ViewRect | undefined): ViewRect | undefined {
  if (!current || !next) return current === next ? current : next;
  return current.left === next.left
    && current.top === next.top
    && current.width === next.width
    && current.height === next.height
    ? current
    : next;
}

export function sameViewRectMap(
  current: Readonly<Record<string, ViewRect>>,
  next: Readonly<Record<string, ViewRect>>,
): Readonly<Record<string, ViewRect>> {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return next;
  return nextKeys.every((key) => sameViewRect(current[key], next[key]) === current[key])
    ? current
    : next;
}

export function sameKeyedViewRects<T extends { rect: ViewRect }>(
  current: readonly T[],
  next: readonly T[],
  key: (value: T) => string,
): readonly T[] {
  if (current.length !== next.length) return next;
  return next.every((value, index) => (
    key(value) === (current[index] ? key(current[index]) : undefined)
    && sameViewRect(current[index]?.rect, value.rect) === current[index]?.rect
  ))
    ? current
    : next;
}
