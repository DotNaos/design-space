import { useEffect, useRef, type RefObject } from "react";

import { zoomCanvasAt, type CanvasCamera, type Point } from "../canvas-transform";

type CanvasTrackpadGestureOptions = {
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
  const gestureStartCamera = useRef<CanvasCamera | undefined>(undefined);

  useEffect(() => {
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
      options.setCamera({ ...camera, x: camera.x - event.deltaX, y: camera.y - event.deltaY });
    };

    const gestureStart = (event: Event) => {
      preventBrowserGesture(event);
      options.onInteraction();
      gestureStartCamera.current = options.cameraRef.current;
    };

    const gestureChange = (event: Event) => {
      preventBrowserGesture(event);
      options.onInteraction();
      const gestureEvent = event as SafariGestureEvent;
      const start = gestureStartCamera.current ?? options.cameraRef.current;
      const scale = typeof gestureEvent.scale === "number" && Number.isFinite(gestureEvent.scale)
        ? gestureEvent.scale
        : 1;
      options.setCamera(zoomCanvasAt(start, start.scale * Math.max(0.01, scale), eventAnchor(gestureEvent, viewport)));
    };

    const gestureEnd = (event: Event) => {
      preventBrowserGesture(event);
      gestureStartCamera.current = undefined;
    };

    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("gesturestart", gestureStart, { passive: false });
    viewport.addEventListener("gesturechange", gestureChange, { passive: false });
    viewport.addEventListener("gestureend", gestureEnd, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("gesturestart", gestureStart);
      viewport.removeEventListener("gesturechange", gestureChange);
      viewport.removeEventListener("gestureend", gestureEnd);
    };
  }, [options.cameraRef, options.onInteraction, options.setCamera, options.viewportRef]);
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
}
