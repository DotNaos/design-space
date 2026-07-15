import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { useWorkspacePanelWidths } from "./use-workspace-panel-widths";
import {
  clampPanelWidth,
  fitWorkspacePanelWidths,
  normalizePanelBounds,
  type PanelWidthBounds,
  type WorkspacePanelNamespace,
  type WorkspacePanelWidths,
} from "./workspace-panel-state";

export const DESKTOP_WORKSPACE_MEDIA_QUERY = "(min-width: 1024px)";

const LEFT_PANEL_DEFAULTS: PanelWidthBounds = { defaultWidth: 280, minWidth: 208, maxWidth: 440 };
const RIGHT_PANEL_DEFAULTS: PanelWidthBounds = { defaultWidth: 320, minWidth: 240, maxWidth: 520 };
const MINIMUM_CANVAS_WIDTH = 320;
const SEPARATOR_WIDTH = 2;

export type WorkspacePanelDefinition = Partial<PanelWidthBounds> & {
  label: string;
  content: ReactNode;
  className?: string;
};

export type ResizableWorkspacePanelsProps = {
  namespace: WorkspacePanelNamespace;
  left: WorkspacePanelDefinition;
  right: WorkspacePanelDefinition;
  children: ReactNode;
  mobile?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ResizableWorkspacePanels(props: ResizableWorkspacePanelsProps) {
  const isDesktop = useDesktopWorkspace();
  const layoutRef = useRef<HTMLDivElement>(null);
  const leftPanelId = useId();
  const rightPanelId = useId();
  const leftBounds = normalizePanelBounds(props.left, LEFT_PANEL_DEFAULTS);
  const rightBounds = normalizePanelBounds(props.right, RIGHT_PANEL_DEFAULTS);
  const bounds = { left: leftBounds, right: rightBounds };
  const { widths, setWidths } = useWorkspacePanelWidths(props.namespace, bounds);
  const [layoutWidth, setLayoutWidth] = useState(viewportWidth);
  const displayWidths = fitWorkspacePanelWidths(widths, bounds, layoutWidth, MINIMUM_CANVAS_WIDTH, SEPARATOR_WIDTH);
  const dragCleanup = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => dragCleanup.current?.(), []);
  useEffect(() => {
    if (!isDesktop) dragCleanup.current?.();
  }, [isDesktop]);
  useEffect(() => {
    if (!isDesktop) return;
    const layout = layoutRef.current;
    if (!layout) return;
    const update = () => setLayoutWidth(layout.clientWidth || viewportWidth());
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(layout);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isDesktop]);

  const resizePanel = useCallback((side: keyof WorkspacePanelWidths, requestedWidth: number) => {
    const other = side === "left" ? "right" : "left";
    const panelBudget = Math.max(
      bounds.left.minWidth + bounds.right.minWidth,
      layoutWidth - MINIMUM_CANVAS_WIDTH - SEPARATOR_WIDTH,
    );
    const available = Math.max(bounds[side].minWidth, panelBudget - displayWidths[other]);
    const width = clampPanelWidth(requestedWidth, {
      minWidth: bounds[side].minWidth,
      maxWidth: Math.min(bounds[side].maxWidth, available),
    });
    setWidths({ ...displayWidths, [side]: width });
  }, [bounds, displayWidths, layoutWidth, setWidths]);

  const startResize = useCallback((side: keyof WorkspacePanelWidths, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragCleanup.current?.();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = displayWidths[side];
    const direction = side === "left" ? 1 : -1;
    const target = event.currentTarget;
    const previousCursor = document.documentElement.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.documentElement.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    target.setPointerCapture?.(pointerId);

    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      resizePanel(side, startWidth + ((moveEvent.clientX - startX) * direction));
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.documentElement.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      try {
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture?.(pointerId);
      } catch {
        // The browser may release capture before the pointerup handler runs.
      }
      if (dragCleanup.current === cleanup) dragCleanup.current = undefined;
    };
    const finish = (finishEvent: globalThis.PointerEvent) => {
      if (finishEvent.pointerId === pointerId) cleanup();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    dragCleanup.current = cleanup;
  }, [displayWidths, resizePanel]);

  if (!isDesktop) {
    return <>{props.mobile ?? props.children}</>;
  }

  return (
    <div
      ref={layoutRef}
      className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${props.className ?? ""}`}
      data-workspace-panel-layout="desktop"
      style={{ gridTemplateColumns: `${displayWidths.left}px 1px minmax(${MINIMUM_CANVAS_WIDTH}px, 1fr) 1px ${displayWidths.right}px` }}
    >
      <section id={leftPanelId} aria-label={props.left.label} className={`min-h-0 min-w-0 overflow-hidden ${props.left.className ?? ""}`}>
        {props.left.content}
      </section>
      <WorkspacePanelSeparator
        bounds={leftBounds}
        controls={leftPanelId}
        label={props.left.label}
        side="left"
        value={displayWidths.left}
        onPointerDown={(event) => startResize("left", event)}
        onReset={() => resizePanel("left", leftBounds.defaultWidth)}
        onResize={(width) => resizePanel("left", width)}
      />
      <div className={`min-h-0 min-w-0 overflow-hidden ${props.contentClassName ?? ""}`}>{props.children}</div>
      <WorkspacePanelSeparator
        bounds={rightBounds}
        controls={rightPanelId}
        label={props.right.label}
        side="right"
        value={displayWidths.right}
        onPointerDown={(event) => startResize("right", event)}
        onReset={() => resizePanel("right", rightBounds.defaultWidth)}
        onResize={(width) => resizePanel("right", width)}
      />
      <section id={rightPanelId} aria-label={props.right.label} className={`min-h-0 min-w-0 overflow-hidden ${props.right.className ?? ""}`}>
        {props.right.content}
      </section>
    </div>
  );
}

function WorkspacePanelSeparator(props: {
  bounds: PanelWidthBounds;
  controls: string;
  label: string;
  side: keyof WorkspacePanelWidths;
  value: number;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onReset: () => void;
  onResize: (width: number) => void;
}) {
  const resizeFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 48 : 16;
    let next: number | undefined;
    if (event.key === "Home") next = props.bounds.minWidth;
    if (event.key === "End") next = props.bounds.maxWidth;
    if (event.key === "ArrowLeft") next = props.value + (props.side === "left" ? -step : step);
    if (event.key === "ArrowRight") next = props.value + (props.side === "left" ? step : -step);
    if (next === undefined) return;
    event.preventDefault();
    props.onResize(next);
  };

  return (
    <div
      aria-label={`Resize ${props.label}`}
      aria-controls={props.controls}
      aria-orientation="vertical"
      aria-valuemax={props.bounds.maxWidth}
      aria-valuemin={props.bounds.minWidth}
      aria-valuenow={Math.round(props.value)}
      aria-valuetext={`${Math.round(props.value)} pixels`}
      className="group relative z-20 w-px touch-none cursor-col-resize bg-white/10 outline-none before:absolute before:inset-y-0 before:-inset-x-1 before:content-[''] hover:bg-cyan-400/70 focus-visible:bg-cyan-300"
      onDoubleClick={props.onReset}
      onKeyDown={resizeFromKeyboard}
      onPointerDown={props.onPointerDown}
      role="separator"
      tabIndex={0}
      title="Drag or use arrow keys to resize. Double-click to reset."
    />
  );
}

function useDesktopWorkspace() {
  const [matches, setMatches] = useState(() => mediaQueryMatches());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DESKTOP_WORKSPACE_MEDIA_QUERY);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return matches;
}

function mediaQueryMatches() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(DESKTOP_WORKSPACE_MEDIA_QUERY).matches;
}

function viewportWidth() {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}
