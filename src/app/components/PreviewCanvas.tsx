import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, MousePointer2, Plus, RotateCcw } from "lucide-react";

import { fitCanvas, pinchCanvas, zoomCanvasAt, type CanvasCamera, type Point } from "../canvas-transform";
import type { Selection, SlotState } from "../types";

type PreviewCanvasProps = {
  className?: string;
  preview: React.ReactNode;
  rootInstanceId: string;
  selectedComponentInstanceId: string;
  selectionLabel: string;
  slots: SlotState[];
  selection: Selection;
  compact?: boolean;
  onSelect: (selection: Selection) => void;
  onEditComponent?: (instanceId: string) => void;
};

type ViewRect = { left: number; top: number; width: number; height: number };
type GestureStart = {
  camera: CanvasCamera;
  points: readonly Point[];
  moved: boolean;
};

const worldWidth = 620;

export function PreviewCanvas(props: PreviewCanvasProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<GestureStart | undefined>(undefined);
  const suppressClick = useRef(false);
  const cameraRef = useRef<CanvasCamera>({ x: 16, y: 56, scale: 1 });
  const autoFit = useRef(true);
  const frame = useRef<number | undefined>(undefined);
  const [camera, setCameraState] = useState(cameraRef.current);
  const [selectionRect, setSelectionRect] = useState<ViewRect>();
  const [emptyRects, setEmptyRects] = useState<Readonly<Record<string, ViewRect>>>({});
  const [showGestureHint, setShowGestureHint] = useState(true);

  const setCamera = useCallback((next: CanvasCamera) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const viewportRect = viewport.getBoundingClientRect();
    const selectedSelector = props.selection.kind === "component"
      ? `[data-design-space-instance-id="${escapeAttribute(props.selection.id)}"]`
      : props.selection.kind === "slot"
        ? `[data-design-space-slot-id="${escapeAttribute(props.selection.id)}"]`
        : undefined;
    setSelectionRect(selectedSelector ? measureSelector(world, selectedSelector, viewportRect) : undefined);
    setEmptyRects(Object.fromEntries(props.slots.filter((slot) => slot.count === 0).flatMap((slot) => {
      const rect = measureSelector(
        world,
        `[data-design-space-slot-id="${escapeAttribute(slot.selectionId)}"]`,
        viewportRect,
      );
      return rect ? [[slot.selectionId, rect]] : [];
    })));
  }, [props.selection, props.slots]);

  const scheduleMeasure = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  }, [measure]);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    if (viewport.clientWidth <= 0 || viewport.clientHeight <= 0 || world.offsetHeight <= 0) return;
    setCamera(fitCanvas(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      { width: worldWidth, height: Math.max(1, world.offsetHeight) },
      props.compact ? 12 : 16,
      props.compact ? 42 : 52,
    ));
  }, [props.compact, setCamera]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
      if (autoFit.current) fit();
      scheduleMeasure();
    });
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(world);
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(world, { attributes: true, childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", scheduleMeasure);
    if (autoFit.current) fit();
    scheduleMeasure();
    void document.fonts?.ready.then(scheduleMeasure);
    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [fit, scheduleMeasure]);

  useLayoutEffect(scheduleMeasure, [camera, props.preview, scheduleMeasure]);

  const reset = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    suppressClick.current = false;
    autoFit.current = false;
    setCamera({ x: (viewport.clientWidth - worldWidth) / 2, y: props.compact ? 44 : 56, scale: 1 });
  };

  const zoomBy = (amount: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    suppressClick.current = false;
    autoFit.current = false;
    setCamera(zoomCanvasAt(cameraRef.current, cameraRef.current.scale + amount, {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    }));
  };

  const rebaseGesture = () => {
    gesture.current = {
      camera: cameraRef.current,
      points: [...pointers.current.values()],
      moved: false,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    autoFit.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    rebaseGesture();
    setShowGestureHint(false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
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
      setCamera(next);
      return;
    }
    if (current.length === 1 && start.points.length === 1) {
      const dx = current[0].x - start.points[0].x;
      const dy = current[0].y - start.points[0].y;
      gesture.current.moved ||= Math.hypot(dx, dy) > 5;
      if (gesture.current.moved) setCamera({ ...start.camera, x: start.camera.x + dx, y: start.camera.y + dy });
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLElement>) => {
    if (gesture.current?.moved) suppressClick.current = true;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rebaseGesture();
  };

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target instanceof Element ? event.target : undefined;
    const slotElement = target?.closest<HTMLElement>("[data-design-space-slot-id]");
    const slotId = slotElement?.dataset.designSpaceSlotId;
    const slot = props.slots.find((item) => item.selectionId === slotId);
    if (slot && slot.count === 0) {
      props.onSelect({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id });
      return;
    }
    const instanceId = target?.closest<HTMLElement>("[data-design-space-instance-id]")?.dataset.designSpaceInstanceId;
    if (!instanceId) return;
    props.onSelect({ kind: "component", id: instanceId });
    props.onEditComponent?.(instanceId);
  };

  return (
    <main
      ref={viewportRef}
      aria-label="Preview canvas"
      className={`${props.className ?? "flex"} relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0d0e10]`}
      style={{ touchAction: "none" }}
      onClick={onClick}
      onPointerCancel={finishPointer}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onWheel={(event) => {
        event.preventDefault();
        setShowGestureHint(false);
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        autoFit.current = false;
        if (event.ctrlKey || event.metaKey) setCamera(zoomCanvasAt(cameraRef.current, cameraRef.current.scale * Math.exp(-event.deltaY * 0.01), anchor));
        else setCamera({ ...cameraRef.current, x: cameraRef.current.x - event.deltaX, y: cameraRef.current.y - event.deltaY });
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle, #3f3f46 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

      {!props.compact && (
        <div className="absolute left-3 top-3 z-20 grid size-11 place-items-center rounded-lg border border-indigo-300/30 bg-indigo-500 text-white shadow-xl lg:size-8">
          <MousePointer2 size={15} />
        </div>
      )}
      <div
        className="absolute right-3 top-3 z-20 flex h-11 items-center rounded-lg border border-white/10 bg-[#17181b]/95 px-1 shadow-xl lg:h-8"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <button aria-label="Zoom out" className="grid size-9 place-items-center text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); zoomBy(-0.1); }}><Minus size={14} /></button>
        <span className="min-w-10 text-center text-[10px] tabular-nums text-zinc-300">{Math.round(camera.scale * 100)}%</span>
        <button aria-label="Zoom in" className="grid size-9 place-items-center text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); zoomBy(0.1); }}><Plus size={14} /></button>
        <button aria-label="Fit canvas" className="grid h-9 min-w-11 place-items-center border-l border-white/10 px-2 text-[10px] text-zinc-300 lg:h-7" type="button" onClick={(event) => { event.stopPropagation(); suppressClick.current = false; autoFit.current = true; fit(); }}><span className="flex items-center gap-1"><Maximize2 size={12} /> Fit</span></button>
        <button aria-label="Reset zoom to 100%" className="grid size-9 place-items-center border-l border-white/10 text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); reset(); }}><RotateCcw size={13} /></button>
      </div>

      <div
        ref={worldRef}
        className="absolute left-0 top-0 w-[620px] will-change-transform"
        style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`, transformOrigin: "0 0" }}
      >
        {props.preview}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {selectionRect && (
          <div
            data-testid="selection-outline"
            className="absolute border-2 border-indigo-400 shadow-[0_0_0_1px_rgba(13,14,16,0.7)]"
            style={{ left: selectionRect.left, top: selectionRect.top, width: selectionRect.width, height: selectionRect.height }}
          >
            <span className="absolute -top-6 left-0 max-w-40 truncate rounded bg-indigo-500 px-1.5 py-1 text-[10px] font-medium text-white shadow-lg">{props.selectionLabel}</span>
          </div>
        )}
        {!props.compact && props.slots.filter((slot) => slot.count === 0).map((slot) => {
          const rect = emptyRects[slot.selectionId];
          if (!rect || props.selection.id === slot.selectionId) return null;
          return (
            <button
              key={slot.selectionId}
              aria-label={`Add to empty ${slot.label} slot`}
              className="pointer-events-auto absolute border border-dashed border-emerald-400/60 bg-emerald-400/[0.04] text-left"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: Math.max(32, rect.height) }}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onSelect({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id });
              }}
            >
              <span className="absolute right-1 top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-medium text-emerald-950">{slot.label} · empty</span>
            </button>
          );
        })}
      </div>

      {showGestureHint && !props.compact && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[#17181b]/90 px-3 py-2 text-[10px] text-zinc-400 shadow-xl">Pinch to zoom · drag to pan</div>
      )}
    </main>
  );
}

function measureSelector(world: HTMLElement, selector: string, viewport: DOMRect): ViewRect | undefined {
  const rects = [...world.querySelectorAll<HTMLElement>(selector)]
    .filter((element) => element.isConnected)
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
  if (!rects.length) return undefined;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left: left - viewport.left, top: top - viewport.top, width: right - left, height: bottom - top };
}

function escapeAttribute(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
