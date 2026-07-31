import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { StrictUiViolation } from "../../../shared/strict-ui";
import {
  fitCanvas,
  revealCanvasRect,
  zoomCanvasAt,
  type CanvasCamera,
  type CanvasWorldRect,
} from "../../canvas-transform";
import { indexPreviewDom, type PreviewDomSnapshot } from "../../dom/dom-snapshot";
import { StrictUiIndicator, strictUiOutlineTone } from "../../strict-ui/StrictUiIndicator";
import {
  buildStrictUiCanvasTargets,
  describeStrictUiMarker,
  type StrictUiCanvasTarget,
} from "../../strict-ui/strict-ui-markers";
import type { Selection, SlotState } from "../../types";
import type { SelectionNavigationCommand } from "../../document/selection-navigation";
import {
  canvasGridPresentation,
  layoutEmptySlotOverlays,
  measureCanvasSelector,
  placeCanvasOverlayLabels,
  sameSelection,
  selectorForSelection,
  selectorForInternalHtml,
  selectorForStrictUiTarget,
  strictUiBadgeObstacle,
  type ViewRect,
} from "./canvas-overlay-geometry";
import {
  actionForStrictUiTarget,
  componentToEdit,
  selectionForCanvasTarget,
  type CanvasContextMenuRequest,
} from "./canvas-target-selection";
import { CanvasGridLayer } from "../CanvasGrid/CanvasGridLayer";
import { CanvasViewportControls } from "../CanvasViewport/CanvasViewportControls";
import { defaultCanvasLayoutGrid, type CanvasGridMode } from "../CanvasGrid/canvas-grid-types";
import { useCanvasTrackpadGestures } from "./use-canvas-trackpad-gestures";
import { useCanvasTouchGestures } from "./use-canvas-touch-gestures";
import {
  applyCanvasCamera,
  canvasWorldTransform,
  sameKeyedViewRects,
  sameViewRect,
  sameViewRectMap,
} from "./preview-canvas-performance";

export type { CanvasContextMenuRequest } from "./canvas-target-selection";

type PreviewCanvasProps = {
  className?: string;
  toolbar?: React.ReactNode;
  preview: React.ReactNode;
  rootInstanceId: string;
  selectedComponentInstanceId: string;
  selectionLabel: string;
  slots: readonly SlotState[];
  selection?: Selection;
  hoveredSelection?: Selection;
  hud?: React.ReactNode;
  highlightedInternalHtmlComponentId?: string;
  htmlClassNames?: Readonly<Record<string, string>>;
  cameraKey?: string;
  revealTarget?: { key: string; rect: CanvasWorldRect };
  strictUiViolations?: readonly StrictUiViolation[];
  compact?: boolean;
  staticPreview?: boolean;
  forcedInteractionMode?: "select" | "interact";
  worldWidth?: number;
  worldHeader?: React.ReactNode;
  worldHeaderHeight?: number;
  verticalAlignment?: "center" | "start";
  onSelect: (selection: Selection) => void;
  onDeselect?: () => void;
  onNavigate?: (command: SelectionNavigationCommand) => void;
  onEditComponent?: (instanceId: string) => void;
  onContextMenuRequest?: (request: CanvasContextMenuRequest) => void;
  onDomSnapshot?: (snapshot: PreviewDomSnapshot) => void;
};
type MeasuredStrictUiTarget = { target: StrictUiCanvasTarget; rect: ViewRect };
const defaultWorldWidth = 620;
export function PreviewCanvas(props: PreviewCanvasProps) {
  const worldWidth = props.worldWidth ?? defaultWorldWidth;
  const worldHeaderHeight = props.worldHeader ? props.worldHeaderHeight ?? 36 : 0;
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const overlayChromeRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const cameraRef = useRef<CanvasCamera>({ x: 16, y: 56, scale: 1 });
  const lastCameraResetKey = useRef<string | undefined>(undefined);
  const lastRevealKey = useRef<string | undefined>(undefined);
  const lastDomSnapshot = useRef("");
  const autoFit = useRef(true);
  const frame = useRef<number | undefined>(undefined);
  const cameraCommitTimer = useRef<number | undefined>(undefined);
  const pendingGestureCamera = useRef<CanvasCamera | undefined>(undefined);
  const [camera, setCameraState] = useState(cameraRef.current);
  const [selectionRect, setSelectionRect] = useState<ViewRect>();
  const [pointerHoveredSelection, setPointerHoveredSelection] = useState<Selection>();
  const [hoveredRect, setHoveredRect] = useState<ViewRect>();
  const [internalHtmlRect, setInternalHtmlRect] = useState<ViewRect>();
  const [emptyRects, setEmptyRects] = useState<Readonly<Record<string, ViewRect>>>({});
  const [strictUiRects, setStrictUiRects] = useState<readonly MeasuredStrictUiTarget[]>([]);
  const [gridRootRect, setGridRootRect] = useState<ViewRect>();
  const [gridMode, setGridMode] = useState<CanvasGridMode>("dots");
  const [gridVisible, setGridVisible] = useState(false);
  const [layoutGrid, setLayoutGrid] = useState(defaultCanvasLayoutGrid);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [showGestureHint, setShowGestureHint] = useState(true);
  const [interactionMode, setInteractionMode] = useState<"select" | "interact">("select");
  const activeInteractionMode = props.forcedInteractionMode ?? interactionMode;
  const strictUiTargets = useMemo(
    () => buildStrictUiCanvasTargets(props.strictUiViolations ?? [], props.rootInstanceId),
    [props.rootInstanceId, props.strictUiViolations],
  );
  const needsCameraMeasurement = gridVisible
    || layoutGrid.enabled
    || Boolean(
      props.selection
      || pointerHoveredSelection
      || props.hoveredSelection
      || props.highlightedInternalHtmlComponentId
      || props.slots.some((slot) => slot.count === 0)
      || strictUiTargets.length,
    );

  const setCamera = useCallback((next: CanvasCamera) => {
    if (cameraCommitTimer.current !== undefined) window.clearTimeout(cameraCommitTimer.current);
    cameraCommitTimer.current = undefined;
    pendingGestureCamera.current = undefined;
    if (overlayChromeRef.current) overlayChromeRef.current.style.visibility = "";
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  const commitPendingGestureCamera = useCallback(() => {
    cameraCommitTimer.current = undefined;
    const next = pendingGestureCamera.current;
    pendingGestureCamera.current = undefined;
    if (overlayChromeRef.current) overlayChromeRef.current.style.visibility = "";
    if (next) setCameraState(next);
  }, []);

  const setGestureCamera = useCallback((next: CanvasCamera) => {
    cameraRef.current = next;
    pendingGestureCamera.current = next;
    const world = worldRef.current;
    if (world) applyCanvasCamera(world, next);
    if (overlayChromeRef.current) overlayChromeRef.current.style.visibility = "hidden";
    if (cameraCommitTimer.current !== undefined) window.clearTimeout(cameraCommitTimer.current);
    cameraCommitTimer.current = window.setTimeout(commitPendingGestureCamera, 80);
  }, [commitPendingGestureCamera]);

  const beginCameraInteraction = useCallback(() => {
    autoFit.current = false;
    setShowGestureHint(false);
  }, []);

  useCanvasTrackpadGestures({
    enabled: activeInteractionMode === "select",
    viewportRef,
    cameraRef,
    setCamera: setGestureCamera,
    onInteraction: beginCameraInteraction,
  });
  const touchGestures = useCanvasTouchGestures({
    viewportRef,
    cameraRef,
    suppressClick,
    interactionMode: activeInteractionMode,
    slots: props.slots,
    selectedComponentInstanceId: props.selectedComponentInstanceId,
    setCamera,
    onInteraction: beginCameraInteraction,
    onContextMenuRequest: props.onContextMenuRequest,
  });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const viewportRect = viewport.getBoundingClientRect();
    applyHtmlClassNames(world, props.htmlClassNames);
    if (props.onDomSnapshot) {
      const snapshot = indexPreviewDom(world);
      const serialized = JSON.stringify(snapshot);
      if (serialized !== lastDomSnapshot.current) {
        lastDomSnapshot.current = serialized;
        props.onDomSnapshot(snapshot);
      }
    }
    setViewportSize((current) => current.width === viewportRect.width && current.height === viewportRect.height
      ? current
      : { width: viewportRect.width, height: viewportRect.height });
    const rootRect = measureCanvasSelector(world, selectorForSelection({ kind: "component", id: props.rootInstanceId }), viewportRect);
    if (rootRect) {
      setGridRootRect((current) => current?.left === rootRect.left
        && current.top === rootRect.top
        && current.width === rootRect.width
        && current.height === rootRect.height
        ? current
        : rootRect);
    } else setGridRootRect((current) => current === undefined ? current : undefined);
    setSelectionRect((current) => sameViewRect(
      current,
      props.selection
        ? measureCanvasSelector(world, selectorForSelection(props.selection), viewportRect)
        : undefined,
    ));
    const hoveredSelection = pointerHoveredSelection ?? props.hoveredSelection;
    setHoveredRect((current) => sameViewRect(
      current,
      hoveredSelection && (!props.selection || !sameSelection(hoveredSelection, props.selection))
        ? measureCanvasSelector(world, selectorForSelection(hoveredSelection), viewportRect)
        : undefined,
    ));
    setInternalHtmlRect((current) => sameViewRect(
      current,
      props.highlightedInternalHtmlComponentId
        ? measureCanvasSelector(world, selectorForInternalHtml(props.highlightedInternalHtmlComponentId), viewportRect)
          ?? measureCanvasSelector(world, selectorForSelection({ kind: "component", id: props.highlightedInternalHtmlComponentId }), viewportRect)
        : undefined,
    ));
    const nextEmptyRects = Object.fromEntries(props.slots.filter((slot) => slot.count === 0).flatMap((slot) => {
      const rect = measureCanvasSelector(
        world,
        selectorForSelection({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id }),
        viewportRect,
      );
      return rect ? [[slot.selectionId, rect]] : [];
    }));
    setEmptyRects((current) => sameViewRectMap(current, nextEmptyRects));
    const nextStrictUiRects = strictUiTargets.flatMap((target) => {
      const rect = measureCanvasSelector(world, selectorForStrictUiTarget(target), viewportRect);
      return rect ? [{ target, rect }] : [];
    });
    setStrictUiRects((current) => sameKeyedViewRects(
      current,
      nextStrictUiRects,
      (value) => value.target.marker.key,
    ));
  }, [pointerHoveredSelection, props.highlightedInternalHtmlComponentId, props.hoveredSelection, props.htmlClassNames, props.onDomSnapshot, props.rootInstanceId, props.selectedComponentInstanceId, props.selection, props.slots, strictUiTargets]);

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
      (props.compact ? 42 : 52) + worldHeaderHeight,
      props.verticalAlignment,
    ));
  }, [props.compact, props.verticalAlignment, setCamera, worldHeaderHeight, worldWidth]);

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
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => (
        mutation.type === "attributes"
        && mutation.target === world
        && (mutation.attributeName === "style" || mutation.attributeName === "data-canvas-scale")
      ))) return;
      scheduleMeasure();
    });
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
      if (cameraCommitTimer.current !== undefined) window.clearTimeout(cameraCommitTimer.current);
    };
  }, [fit, scheduleMeasure]);

  useLayoutEffect(() => {
    if (needsCameraMeasurement) scheduleMeasure();
  }, [camera, needsCameraMeasurement, props.preview, scheduleMeasure]);

  useLayoutEffect(() => {
    if (!props.selection) setSelectionRect(undefined);
  }, [props.selection]);

  useLayoutEffect(() => {
    if (props.cameraKey === undefined) return;
    const resetKey = `${props.cameraKey}:${props.compact ? "compact" : "full"}:${props.verticalAlignment ?? "center"}:${worldHeaderHeight}`;
    if (lastCameraResetKey.current === resetKey) return;
    lastCameraResetKey.current = resetKey;
    touchGestures.resetTouchGestures();
    suppressClick.current = false;
    autoFit.current = true;
    setGridRootRect(undefined);
    setShowGestureHint(true);
    setInteractionMode("select");
    setCamera({ x: 16, y: props.compact ? 44 : 56, scale: 1 });
    fit();
    scheduleMeasure();
    const settleFrame = requestAnimationFrame(() => {
      if (autoFit.current) fit();
      scheduleMeasure();
    });
    return () => cancelAnimationFrame(settleFrame);
  }, [fit, props.cameraKey, props.compact, scheduleMeasure, setCamera, touchGestures.resetTouchGestures, worldHeaderHeight]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const target = props.revealTarget;
    if (!viewport || !target || lastRevealKey.current === target.key) return;
    if (viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
    lastRevealKey.current = target.key;
    autoFit.current = false;
    setShowGestureHint(false);
    setCamera(revealCanvasRect(
      cameraRef.current,
      { width: viewport.clientWidth, height: viewport.clientHeight },
      target.rect,
      props.compact ? 16 : 24,
      (props.compact ? 48 : 72) + worldHeaderHeight,
    ));
    scheduleMeasure();
  }, [props.compact, props.revealTarget, scheduleMeasure, setCamera, worldHeaderHeight]);

  const reset = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    suppressClick.current = false;
    autoFit.current = false;
    setCamera({ x: (viewport.clientWidth - worldWidth) / 2, y: (props.compact ? 44 : 56) + worldHeaderHeight, scale: 1 });
  };

  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    suppressClick.current = false;
    autoFit.current = false;
    setCamera(zoomCanvasAt(cameraRef.current, cameraRef.current.scale * factor, {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    }));
  };

  const grid = useMemo(
    () => canvasGridPresentation(camera.scale, gridRootRect
      ? { x: gridRootRect.left, y: gridRootRect.top }
      : { x: camera.x, y: camera.y }),
    [camera.scale, camera.x, camera.y, gridRootRect],
  );
  const emptySlotOverlayRects = useMemo(() => layoutEmptySlotOverlays(
    props.slots.filter((slot) => slot.count === 0).flatMap((slot) => {
      const rect = emptyRects[slot.selectionId];
      return rect ? [{ id: slot.selectionId, rect }] : [];
    }),
    camera.scale,
  ), [camera.scale, emptyRects, props.slots]);
  const visibleSelectionRect = props.selection ? selectionRect : undefined;
  const overlayLabels = useMemo(() => placeCanvasOverlayLabels([
    ...(visibleSelectionRect ? [{
      id: "selection-label",
      text: props.selectionLabel,
      anchor: visibleSelectionRect,
      placement: "selection" as const,
    }] : []),
    ...props.slots.filter((slot) => slot.count === 0 && props.selection?.id !== slot.selectionId).flatMap((slot) => {
      const rect = emptySlotOverlayRects[slot.selectionId];
      return rect ? [{
        id: `slot-label:${slot.selectionId}`,
        text: `${slot.label} · empty`,
        anchor: rect,
        placement: "slot" as const,
      }] : [];
    }),
  ], strictUiRects.map(({ rect }) => strictUiBadgeObstacle(rect)), viewportSize), [
    emptySlotOverlayRects,
    props.selection?.id,
    props.selectionLabel,
    props.slots,
    visibleSelectionRect,
    strictUiRects,
    viewportSize,
  ]);

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isCanvasChromeTarget(event.target)) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selection = selectionForCanvasTarget(
      event.target instanceof Element ? event.target : undefined,
      props.slots,
      props.selectedComponentInstanceId,
    );
    if (selection) {
      event.preventDefault();
      event.stopPropagation();
      props.onSelect(selection);
      viewportRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.target === event.currentTarget) {
      props.onDeselect?.();
      viewportRef.current?.focus({ preventScroll: true });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (activeInteractionMode !== "select" || event.target !== event.currentTarget || !props.onNavigate) return;
    const command = event.key === "Enter"
      ? event.shiftKey ? "parent" : "child"
      : event.key === "Escape"
        ? "parent"
      : event.key === "Tab"
        ? event.shiftKey ? "previous-sibling" : "next-sibling"
        : undefined;
    if (!command) return;
    event.preventDefault();
    props.onNavigate(command);
  };

  useEffect(() => {
    if (activeInteractionMode !== "select" || !props.selection || !props.onNavigate) return;
    const navigateToParent = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || target.matches("input, textarea, select")
        || Boolean(target.closest('[role="dialog"], [role="listbox"], [role="menu"]'))
      )) return;
      event.preventDefault();
      props.onNavigate?.("parent");
    };
    window.addEventListener("keydown", navigateToParent);
    return () => window.removeEventListener("keydown", navigateToParent);
  }, [activeInteractionMode, props.onNavigate, props.selection]);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    touchGestures.onPointerMove(event);
    if (activeInteractionMode !== "select" || event.pointerType !== "mouse") return;
    if (isCanvasChromeTarget(event.target)) {
      setPointerHoveredSelection(undefined);
      return;
    }
    const next = selectionForCanvasTarget(
      event.target instanceof Element ? event.target : undefined,
      props.slots,
      props.selectedComponentInstanceId,
    );
    setPointerHoveredSelection((current) => sameSelection(current, next) ? current : next);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isCanvasChromeTarget(event.target)) return;
    if (!props.onEditComponent) return;
    const selection = selectionForCanvasTarget(
      event.target instanceof Element ? event.target : undefined,
      props.slots,
      props.selectedComponentInstanceId,
    );
    const instanceId = selection ? componentToEdit(selection) : undefined;
    if (!instanceId) return;
    event.preventDefault();
    event.stopPropagation();
    props.onEditComponent(instanceId);
  };

  const onContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (isCanvasChromeTarget(event.target)) return;
    if (!props.onContextMenuRequest) return;
    const selection = selectionForCanvasTarget(
      event.target instanceof Element ? event.target : undefined,
      props.slots,
      props.selectedComponentInstanceId,
    );
    const viewport = viewportRef.current;
    if (!selection || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    props.onContextMenuRequest({
      selection,
      clientPosition: { x: event.clientX, y: event.clientY },
      viewportPosition: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    });
  };

  const selectStrictUiTarget = (target: StrictUiCanvasTarget) => {
    const action = actionForStrictUiTarget(target, props.rootInstanceId);
    props.onSelect(action.selection);
    if (action.editInstanceId) props.onEditComponent?.(action.editInstanceId);
  };

  return (
    <main
      ref={viewportRef}
      aria-label="Preview canvas"
      className={`${props.className ?? "flex"} relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0d0e10]`}
      data-design-space-canvas-viewport
      style={{
        touchAction: activeInteractionMode === "select" ? "none" : "pan-x pan-y",
        overscrollBehavior: activeInteractionMode === "select" ? "none" : "contain",
      }}
      onClickCapture={activeInteractionMode === "select" ? onClick : undefined}
      onContextMenuCapture={activeInteractionMode === "select" ? onContextMenu : undefined}
      onDoubleClickCapture={activeInteractionMode === "select" ? onDoubleClick : undefined}
      onKeyDown={onKeyDown}
      onPointerCancel={touchGestures.finishPointer}
      onPointerDown={touchGestures.onPointerDown}
      onPointerLeave={() => setPointerHoveredSelection(undefined)}
      onPointerMove={onPointerMove}
      onPointerUp={touchGestures.finishPointer}
      tabIndex={activeInteractionMode === "select" ? 0 : -1}
    >
      <CanvasGridLayer
        grid={grid}
        layoutGrid={layoutGrid}
        mode={gridMode}
        rootRect={gridRootRect}
        scale={camera.scale}
        visible={gridVisible}
      />

      <CanvasViewportControls
        compact={props.compact}
        leadingContent={props.toolbar}
        narrow={viewportSize.width > 0 && viewportSize.width < 760}
        showInteractionToggle={!props.staticPreview}
        gridMode={gridMode}
        gridVisible={gridVisible}
        interactionMode={activeInteractionMode}
        layoutGrid={layoutGrid}
        scale={camera.scale}
        onFit={() => {
          suppressClick.current = false;
          autoFit.current = true;
          fit();
        }}
        onReset={reset}
        onGridModeChange={setGridMode}
        onGridVisibleChange={setGridVisible}
        onLayoutGridChange={setLayoutGrid}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onToggleInteractionMode={() => {
          if (!props.staticPreview) setInteractionMode((current) => current === "select" ? "interact" : "select");
        }}
      />

      <div
        ref={worldRef}
        data-canvas-scale={cameraRef.current.scale}
        data-testid="canvas-world"
        className="absolute left-0 top-0"
        style={{
          width: worldWidth,
          transform: canvasWorldTransform(cameraRef.current),
          transformOrigin: "0 0",
        }}
      >
        {props.preview}
      </div>

      <div ref={overlayChromeRef} className="pointer-events-none absolute inset-0 z-10">
        {props.worldHeader ? (
          <div
            className="pointer-events-auto absolute"
            data-testid="canvas-world-header"
            style={{
              height: worldHeaderHeight,
              left: camera.x,
              top: camera.y - worldHeaderHeight,
              width: worldWidth * camera.scale,
            }}
          >
            {props.worldHeader}
          </div>
        ) : null}
        {strictUiRects.map(({ target, rect }) => (
          <div
            key={target.marker.key}
            className={`absolute border border-dashed ${strictUiOutlineTone(target.marker.severity)}`}
            data-strict-ui-count={target.marker.violations.length}
            data-strict-ui-severity={target.marker.severity}
            data-strict-ui-target={`${target.kind}:${target.id}`}
            data-testid="strict-ui-canvas-marker"
            style={{ left: rect.left, top: rect.top, width: rect.width, height: Math.max(2, rect.height) }}
          >
            <button
              aria-label={describeStrictUiMarker(target.marker)}
              className="pointer-events-auto absolute -right-2 -top-2 grid size-10 place-items-center rounded-full outline-none ring-offset-2 ring-offset-[#0d0e10] focus-visible:ring-2 focus-visible:ring-sky-300 lg:size-7"
              data-strict-ui-action={target.marker.key}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                selectStrictUiTarget(target);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              <StrictUiIndicator decorative marker={target.marker} />
            </button>
          </div>
        ))}
        {visibleSelectionRect && (
          <div
            data-testid="selection-outline"
            className="absolute border-2 border-sky-400 shadow-[0_0_0_1px_rgba(13,14,16,0.7)]"
            style={{ left: visibleSelectionRect.left, top: visibleSelectionRect.top, width: visibleSelectionRect.width, height: visibleSelectionRect.height }}
          />
        )}
        {hoveredRect && (
          <div
            aria-hidden="true"
            data-testid="hover-outline"
            className="absolute border border-dashed border-sky-300/80 bg-sky-300/[0.025]"
            style={{ left: hoveredRect.left, top: hoveredRect.top, width: hoveredRect.width, height: Math.max(1, hoveredRect.height) }}
          />
        )}
        {internalHtmlRect && (
          <div
            aria-hidden="true"
            data-testid="internal-html-outline"
            className="absolute border border-dashed border-amber-300/80 bg-amber-300/[0.045] shadow-[inset_0_0_0_1px_rgba(252,211,77,0.08)]"
            style={{ left: internalHtmlRect.left, top: internalHtmlRect.top, width: internalHtmlRect.width, height: Math.max(1, internalHtmlRect.height) }}
          />
        )}
        {!props.compact && props.slots.filter((slot) => slot.count === 0).map((slot) => {
          const rect = emptySlotOverlayRects[slot.selectionId];
          if (!rect || props.selection?.id === slot.selectionId) return null;
          return (
            <button
              key={slot.selectionId}
              aria-label={`Add to empty ${slot.label} slot`}
              className="pointer-events-auto absolute border border-dashed border-emerald-400/60 bg-emerald-400/[0.04] text-left"
              data-design-space-slot-id={slot.selectionId}
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onSelect({ kind: "slot", id: slot.selectionId, componentInstanceId: props.selectedComponentInstanceId, slotId: slot.id });
              }}
            />
          );
        })}
        {overlayLabels.map((label) => (
          <span
            key={label.id}
            aria-hidden="true"
            className={`absolute truncate text-[11px] font-medium [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_8px_rgba(0,0,0,0.8)] ${label.placement === "selection" ? "text-sky-400" : "text-emerald-300"}`}
            data-testid="canvas-overlay-label"
            style={{ left: label.left, top: label.top, width: label.width, height: label.height }}
          >
            {label.text}
          </span>
        ))}
      </div>

      {props.hud ? (
        <div data-testid="canvas-hud" className="pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 lg:bottom-4">
          {props.hud}
        </div>
      ) : showGestureHint && !props.compact ? (
        <div data-design-space-gesture-hint className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[#17181b]/90 px-3 py-2 text-[10px] text-zinc-400 shadow-xl">
          <span className="lg:hidden">Drag to pan · pinch to zoom</span>
          <span className="hidden lg:inline">Trackpad scroll to pan · pinch to zoom</span>
        </div>
      ) : null}
    </main>
  );
}

function isCanvasChromeTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-design-space-canvas-chrome]"));
}

function applyHtmlClassNames(root: HTMLElement, values: Readonly<Record<string, string>> | undefined): void {
  for (const [selectionId, className] of Object.entries(values ?? {})) {
    const element = root.querySelector<HTMLElement>(`[data-design-space-html-id="${CSS.escape(selectionId)}"]`);
    if (element && element.className !== className) element.className = className;
  }
}
