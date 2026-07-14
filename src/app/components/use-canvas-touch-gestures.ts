import { useCallback, useEffect, useRef, type MutableRefObject, type PointerEvent, type RefObject } from "react";

import { pinchCanvas, type CanvasCamera, type Point } from "../canvas-transform";
import type { Selection, SlotState } from "../types";
import { selectionForCanvasTarget, type CanvasContextMenuRequest } from "./canvas-target-selection";

type GestureStart = {
  camera: CanvasCamera;
  points: readonly Point[];
  moved: boolean;
};

type LongPressGesture = {
  pointerId: number;
  origin: Point;
  timer: number;
};

export function useCanvasTouchGestures(options: {
  viewportRef: RefObject<HTMLElement | null>;
  cameraRef: RefObject<CanvasCamera>;
  suppressClick: MutableRefObject<boolean>;
  interactionMode: "select" | "interact";
  slots: readonly SlotState[];
  selectedComponentInstanceId: string;
  setCamera: (camera: CanvasCamera) => void;
  onInteraction: () => void;
  onContextMenuRequest?: (request: CanvasContextMenuRequest) => void;
}) {
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureStart | undefined>(undefined);
  const longPress = useRef<LongPressGesture | undefined>(undefined);

  const cancelLongPress = useCallback(() => {
    if (!longPress.current) return;
    window.clearTimeout(longPress.current.timer);
    longPress.current = undefined;
  }, []);

  const reset = useCallback(() => {
    cancelLongPress();
    pointers.current.clear();
    gesture.current = undefined;
  }, [cancelLongPress]);

  useEffect(() => reset, [reset]);
  useEffect(() => {
    if (options.interactionMode === "interact") reset();
  }, [options.interactionMode, reset]);

  const rebaseGesture = () => {
    gesture.current = {
      camera: options.cameraRef.current,
      points: [...pointers.current.values()],
      moved: false,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" || options.interactionMode === "interact") return;
    cancelLongPress();
    event.currentTarget.setPointerCapture(event.pointerId);
    options.onInteraction();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebaseGesture();
    if (pointers.current.size !== 1 || !options.onContextMenuRequest) return;
    const selection = selectionForCanvasTarget(
      event.target instanceof Element ? event.target : undefined,
      options.slots,
      options.selectedComponentInstanceId,
    );
    const viewport = options.viewportRef.current;
    if (!selection || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    const clientPosition = { x: event.clientX, y: event.clientY };
    longPress.current = {
      pointerId: event.pointerId,
      origin: clientPosition,
      timer: window.setTimeout(() => {
        options.suppressClick.current = true;
        longPress.current = undefined;
        options.onContextMenuRequest?.({
          selection: selection as Selection,
          clientPosition,
          viewportPosition: { x: clientPosition.x - rect.left, y: clientPosition.y - rect.top },
        });
      }, 520),
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    const pendingLongPress = longPress.current;
    if (
      pendingLongPress &&
      (pointers.current.size > 1 || Math.hypot(event.clientX - pendingLongPress.origin.x, event.clientY - pendingLongPress.origin.y) > 8)
    ) cancelLongPress();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = [...pointers.current.values()];
    const start = gesture.current;
    if (current.length >= 2 && start.points.length >= 2) {
      const startCentroid = midpoint(start.points[0], start.points[1]);
      const currentCentroid = midpoint(current[0], current[1]);
      const next = pinchCanvas(
        start.camera,
        startCentroid,
        currentCentroid,
        distance(start.points[0], start.points[1]),
        distance(current[0], current[1]),
      );
      gesture.current.moved ||= distance(startCentroid, currentCentroid) > 3 || Math.abs(next.scale - start.camera.scale) > 0.01;
      options.setCamera(next);
      return;
    }
    if (current.length === 1 && start.points.length === 1) {
      const dx = current[0].x - start.points[0].x;
      const dy = current[0].y - start.points[0].y;
      gesture.current.moved ||= Math.hypot(dx, dy) > 5;
      if (gesture.current.moved) options.setCamera({ ...start.camera, x: start.camera.x + dx, y: start.camera.y + dy });
    }
  };

  const finishPointer = (event: PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    if (longPress.current?.pointerId === event.pointerId) cancelLongPress();
    if (gesture.current?.moved) options.suppressClick.current = true;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rebaseGesture();
  };

  return { onPointerDown, onPointerMove, finishPointer, resetTouchGestures: reset };
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
