export interface CanvasCamera {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CanvasWorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const minimumCanvasScale = 0.25;
export const maximumCanvasScale = 256;

export function clampCanvasScale(scale: number): number {
  return Math.min(maximumCanvasScale, Math.max(minimumCanvasScale, scale));
}

export function zoomCanvasAt(camera: CanvasCamera, scale: number, anchor: Point): CanvasCamera {
  const nextScale = clampCanvasScale(scale);
  const worldX = (anchor.x - camera.x) / camera.scale;
  const worldY = (anchor.y - camera.y) / camera.scale;
  return {
    x: anchor.x - worldX * nextScale,
    y: anchor.y - worldY * nextScale,
    scale: nextScale,
  };
}

export function pinchCanvas(
  camera: CanvasCamera,
  startCentroid: Point,
  currentCentroid: Point,
  startDistance: number,
  currentDistance: number,
): CanvasCamera {
  const ratio = startDistance > 0 ? currentDistance / startDistance : 1;
  const scaled = zoomCanvasAt(camera, camera.scale * ratio, startCentroid);
  return {
    ...scaled,
    x: scaled.x + currentCentroid.x - startCentroid.x,
    y: scaled.y + currentCentroid.y - startCentroid.y,
  };
}

export function fitCanvas(
  viewport: { width: number; height: number },
  world: { width: number; height: number },
  margin = 16,
  topInset = 48,
  verticalAlignment: "center" | "start" = "center",
): CanvasCamera {
  const usableWidth = Math.max(1, viewport.width - margin * 2);
  const usableHeight = Math.max(1, viewport.height - topInset - margin);
  const scale = clampCanvasScale(Math.min(1, usableWidth / world.width, usableHeight / world.height));
  return {
    x: (viewport.width - world.width * scale) / 2,
    y: verticalAlignment === "start"
      ? topInset + margin
      : topInset + (usableHeight - world.height * scale) / 2,
    scale,
  };
}

export function revealCanvasRect(
  camera: CanvasCamera,
  viewport: { width: number; height: number },
  target: CanvasWorldRect,
  margin = 24,
  topInset = 64,
): CanvasCamera {
  const safeLeft = Math.min(margin, viewport.width / 2);
  const safeRight = Math.max(safeLeft, viewport.width - margin);
  const safeTop = Math.min(topInset, viewport.height / 2);
  const safeBottom = Math.max(safeTop, viewport.height - margin);
  const left = camera.x + target.x * camera.scale;
  const top = camera.y + target.y * camera.scale;
  const right = left + target.width * camera.scale;
  const bottom = top + target.height * camera.scale;
  return {
    ...camera,
    x: camera.x + revealAxisShift(left, right, safeLeft, safeRight),
    y: camera.y + revealAxisShift(top, bottom, safeTop, safeBottom),
  };
}

function revealAxisShift(
  targetStart: number,
  targetEnd: number,
  safeStart: number,
  safeEnd: number,
): number {
  if (targetEnd - targetStart > safeEnd - safeStart) {
    return (safeStart + safeEnd - targetStart - targetEnd) / 2;
  }
  if (targetStart < safeStart) return safeStart - targetStart;
  if (targetEnd > safeEnd) return safeEnd - targetEnd;
  return 0;
}
