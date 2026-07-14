import { useEffect, useRef, type RefObject } from "react";

import { zoomCanvasAt, type CanvasCamera, type Point } from "../canvas-transform";

type CanvasTrackpadGestureOptions = {
  enabled: boolean;
  viewportRef: RefObject<HTMLElement | null>;
  cameraRef: RefObject<CanvasCamera>;
  setCamera: (camera: CanvasCamera) => void;
  onInteraction: () => void;
};

type SafariGestureEvent = Event & {
  readonly clientX?: number;
  readonly clientY?: number;
  readonly scale?: number;
};

export function useCanvasTrackpadGestures(options: CanvasTrackpadGestureOptions) {
  const gestureStart = useRef<{ camera: CanvasCamera; anchor: Point } | undefined>(undefined);

  useEffect(() => {
    if (!options.enabled) return;
    const viewport = options.viewportRef.current;
    if (!viewport) return;

    const wheel = (event: WheelEvent) => {
      preventBrowserGesture(event);
      options.onInteraction();
      const camera = options.cameraRef.current;
      const anchor = eventAnchor(event, viewport);
      if (event.ctrlKey || event.metaKey) {
        options.setCamera(zoomCanvasAt(camera, camera.scale * Math.exp(-event.deltaY * 0.01), anchor));
        return;
      }
      const multiplier = wheelDeltaMultiplier(event, viewport);
      options.setCamera({
        ...camera,
        x: camera.x - event.deltaX * multiplier,
        y: camera.y - event.deltaY * multiplier,
      });
    };

    const startGesture = (event: Event) => {
      preventBrowserGesture(event);
      options.onInteraction();
      gestureStart.current = { camera: options.cameraRef.current, anchor: eventAnchor(event as SafariGestureEvent, viewport) };
    };

    const gestureChange = (event: Event) => {
      preventBrowserGesture(event);
      options.onInteraction();
      const gestureEvent = event as SafariGestureEvent;
      const start = gestureStart.current ?? { camera: options.cameraRef.current, anchor: eventAnchor(gestureEvent, viewport) };
      const anchor = eventAnchor(gestureEvent, viewport);
      const scale = typeof gestureEvent.scale === "number" && Number.isFinite(gestureEvent.scale)
        ? gestureEvent.scale
        : 1;
      const scaled = zoomCanvasAt(start.camera, start.camera.scale * Math.max(0.01, scale), start.anchor);
      options.setCamera({
        ...scaled,
        x: scaled.x + anchor.x - start.anchor.x,
        y: scaled.y + anchor.y - start.anchor.y,
      });
    };

    const gestureEnd = (event: Event) => {
      preventBrowserGesture(event);
      gestureStart.current = undefined;
    };

    const listenerOptions = { passive: false, capture: true } as const;
    viewport.addEventListener("wheel", wheel, listenerOptions);
    viewport.addEventListener("gesturestart", startGesture, listenerOptions);
    viewport.addEventListener("gesturechange", gestureChange, listenerOptions);
    viewport.addEventListener("gestureend", gestureEnd, listenerOptions);
    return () => {
      viewport.removeEventListener("wheel", wheel, true);
      viewport.removeEventListener("gesturestart", startGesture, true);
      viewport.removeEventListener("gesturechange", gestureChange, true);
      viewport.removeEventListener("gestureend", gestureEnd, true);
    };
  }, [options.cameraRef, options.enabled, options.onInteraction, options.setCamera, options.viewportRef]);
}

function wheelDeltaMultiplier(event: WheelEvent, viewport: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return viewport.clientHeight || viewport.getBoundingClientRect().height || 1;
  }
  return 1;
}

function eventAnchor(
  event: { readonly clientX?: number; readonly clientY?: number },
  viewport: HTMLElement,
): Point {
  const rect = viewport.getBoundingClientRect();
  return {
    x: typeof event.clientX === "number" ? event.clientX - rect.left : rect.width / 2,
    y: typeof event.clientY === "number" ? event.clientY - rect.top : rect.height / 2,
  };
}

function preventBrowserGesture(event: Event) {
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}
