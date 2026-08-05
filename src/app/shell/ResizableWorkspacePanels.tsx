

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { useWorkspacePanelWidths } from "./use-workspace-panel-widths";
import { useWorkspacePanelVisibility } from "./use-workspace-panel-visibility";
import { useWorkspacePanelControl } from "./use-workspace-panel-control";
import { clampPanelWidth, fitWorkspacePanelWidths, normalizePanelBounds, type PanelWidthBounds, type WorkspacePanelNamespace, type WorkspacePanelWidths } from "./workspace-panel-state";
import { WorkspacePanel } from "./WorkspacePanel";
import { WorkspacePanelSeparator } from "./WorkspacePanelSeparator";

export const DESKTOP_WORKSPACE_MEDIA_QUERY = "(min-width: 1024px)";

const LEFT_PANEL_DEFAULTS: PanelWidthBounds = { defaultWidth: 280, minWidth: 208, maxWidth: 440 };
const RIGHT_PANEL_DEFAULTS: PanelWidthBounds = { defaultWidth: 320, minWidth: 240, maxWidth: 520 };
const MINIMUM_CANVAS_WIDTH = 320;
const SEPARATOR_WIDTH = 2;
const COLLAPSED_PANEL_WIDTH = 36;
const SNAP_RESISTANCE_DISTANCE = 56;

type PanelSide = keyof WorkspacePanelWidths;
export type PanelSnapFeedback = "resist-collapse" | "collapse" | "resist-expand" | "expand" | "resist-restore" | "restore";

export type WorkspacePanelDefinition = Partial<PanelWidthBounds> & {
  label: string;
  content: ReactNode;
  className?: string;
};

export type WorkspacePanelControls = {
  controls: string;
  visible: boolean;
  onToggle: () => void;
};

export type WorkspacePanelsControls = {
  left: WorkspacePanelControls;
  right: WorkspacePanelControls;
};

export type ResizableWorkspacePanelsProps = {
  namespace: WorkspacePanelNamespace;
  left: Omit<WorkspacePanelDefinition, "content"> & {
    content: ReactNode | ((controls: WorkspacePanelControls) => ReactNode);
  };
  right: WorkspacePanelDefinition;
  children: ReactNode | ((controls: WorkspacePanelsControls) => ReactNode);
  mobile?: ReactNode;
  className?: string;
  contentClassName?: string;
  leftHeader?: (controls: WorkspacePanelControls, panels: WorkspacePanelsControls) => ReactNode;
  rightHeader?: (controls: WorkspacePanelControls) => ReactNode;
  externalPanelControls?: boolean;
  allowPanelExpansion?: boolean;
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
  const { visibility, setVisible, setExpanded, toggle } = useWorkspacePanelVisibility(props.namespace);
  const expandedPanel = props.allowPanelExpansion === false ? null : visibility.expanded;
  useWorkspacePanelControl({ setVisible, toggle });
  const [layoutWidth, setLayoutWidth] = useState(viewportWidth);
  const [snapFeedback, setSnapFeedback] = useState<{ side: PanelSide; state: PanelSnapFeedback }>();
  const fittedWidths = visibility.left && visibility.right
    ? fitWorkspacePanelWidths(widths, bounds, layoutWidth, MINIMUM_CANVAS_WIDTH, SEPARATOR_WIDTH)
    : {
      left: visibility.left
        ? clampPanelWidth(widths.left, {
          ...leftBounds,
          maxWidth: Math.min(
            leftBounds.maxWidth,
            layoutWidth - MINIMUM_CANVAS_WIDTH - SEPARATOR_WIDTH - (visibility.right || props.externalPanelControls ? 0 : COLLAPSED_PANEL_WIDTH),
          ),
        })
        : 0,
      right: visibility.right
        ? clampPanelWidth(widths.right, {
          ...rightBounds,
          maxWidth: Math.min(
            rightBounds.maxWidth,
            layoutWidth - MINIMUM_CANVAS_WIDTH - SEPARATOR_WIDTH - (visibility.left || props.externalPanelControls ? 0 : COLLAPSED_PANEL_WIDTH),
          ),
        })
        : 0,
    };
  const displayWidths = {
    left: visibility.left ? fittedWidths.left : 0,
    right: visibility.right ? fittedWidths.right : 0,
  };
  const collapsedPanelWidth = props.externalPanelControls ? 0 : COLLAPSED_PANEL_WIDTH;
  const columnWidths = {
    left: visibility.left ? fittedWidths.left : collapsedPanelWidth,
    right: visibility.right ? fittedWidths.right : collapsedPanelWidth,
  };
  const dragCleanup = useRef<(() => void) | undefined>(undefined);
  const pendingSnap = useRef<{ side: PanelSide; state: PanelSnapFeedback } | undefined>(undefined);
  const leftControls = {
    controls: leftPanelId,
    visible: visibility.left,
    onToggle: () => toggle("left"),
  };
  const rightControls = {
    controls: rightPanelId,
    visible: visibility.right,
    onToggle: () => toggle("right"),
  };
  const leftContent = typeof props.left.content === "function"
    ? props.left.content(leftControls)
    : props.left.content;
  const centerContent = typeof props.children === "function"
    ? props.children({ left: leftControls, right: rightControls })
    : props.children;

  useEffect(() => () => dragCleanup.current?.(), []);
  useEffect(() => {
    if (props.allowPanelExpansion === false && visibility.expanded) setExpanded(null);
  }, [props.allowPanelExpansion, setExpanded, visibility.expanded]);
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

  const maximumPanelWidth = useCallback((side: PanelSide) => {
    const other = side === "left" ? "right" : "left";
    const otherMinimum = visibility[other] ? bounds[other].minWidth : collapsedPanelWidth;
    const panelBudget = Math.max(
      bounds[side].minWidth + otherMinimum,
      layoutWidth - MINIMUM_CANVAS_WIDTH - SEPARATOR_WIDTH,
    );
    const available = Math.max(bounds[side].minWidth, panelBudget - displayWidths[other]);
    return Math.min(bounds[side].maxWidth, available);
  }, [bounds, collapsedPanelWidth, displayWidths, layoutWidth, visibility]);

  const resizePanel = useCallback((side: PanelSide, requestedWidth: number) => {
    const width = clampPanelWidth(requestedWidth, {
      minWidth: bounds[side].minWidth,
      maxWidth: maximumPanelWidth(side),
    });
    setWidths({ ...widths, [side]: width });
  }, [bounds, maximumPanelWidth, setWidths, widths]);

  const startResize = useCallback((side: PanelSide, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragCleanup.current?.();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const expandedAtStart = expandedPanel === side;
    const startWidth = expandedAtStart ? layoutWidth : displayWidths[side];
    const direction = side === "left" ? 1 : -1;
    const target = event.currentTarget;
    const previousCursor = document.documentElement.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.documentElement.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    target.setPointerCapture?.(pointerId);
    let snapCommitted = false;

    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId || snapCommitted) return;
      const requestedWidth = startWidth + ((moveEvent.clientX - startX) * direction);
      let feedback: PanelSnapFeedback | undefined;
      if (expandedAtStart) {
        const inwardDistance = layoutWidth - requestedWidth;
        if (inwardDistance > 0) {
          feedback = inwardDistance >= SNAP_RESISTANCE_DISTANCE ? "restore" : "resist-restore";
        }
      } else if (requestedWidth < bounds[side].minWidth) {
        resizePanel(side, bounds[side].minWidth);
        feedback = bounds[side].minWidth - requestedWidth >= SNAP_RESISTANCE_DISTANCE
          ? "collapse"
          : "resist-collapse";
      } else {
        const maximumWidth = maximumPanelWidth(side);
        if (requestedWidth > maximumWidth) {
          resizePanel(side, maximumWidth);
          if (props.allowPanelExpansion !== false) {
            feedback = requestedWidth - maximumWidth >= SNAP_RESISTANCE_DISTANCE
              ? "expand"
              : "resist-expand";
          }
        } else {
          resizePanel(side, requestedWidth);
        }
      }
      pendingSnap.current = feedback ? { side, state: feedback } : undefined;
      setSnapFeedback(pendingSnap.current);
      if (feedback === "collapse") {
        snapCommitted = true;
        setVisible(side, false);
      }
      if (feedback === "expand") {
        snapCommitted = true;
        setExpanded(side);
      }
      if (feedback === "restore") {
        snapCommitted = true;
        setExpanded(null);
      }
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
      pendingSnap.current = undefined;
      setSnapFeedback(undefined);
    };
    const finish = (finishEvent: globalThis.PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      cleanup();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    dragCleanup.current = cleanup;
  }, [bounds, displayWidths, expandedPanel, layoutWidth, maximumPanelWidth, props.allowPanelExpansion, resizePanel, setExpanded, setVisible]);

  if (!isDesktop) {
    return <>{props.mobile ?? centerContent}</>;
  }

  return (
    <div
      ref={layoutRef}
      className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${props.className ?? ""}`}
      data-workspace-panel-layout="desktop"
      data-workspace-panel-expanded={expandedPanel ?? undefined}
      style={{
        gridTemplateColumns: expandedPanel === "left"
          ? "minmax(0,1fr) 1px 0 0 0"
          : expandedPanel === "right"
            ? "0 0 0 1px minmax(0,1fr)"
            : `${columnWidths.left}px 1px minmax(${MINIMUM_CANVAS_WIDTH}px, 1fr) 1px ${columnWidths.right}px`,
      }}
    >
      <WorkspacePanel
        content={leftContent}
        contentClassName={props.left.className}
        controls={leftPanelId}
        label={props.left.label}
        header={props.leftHeader?.(leftControls, { left: leftControls, right: rightControls })}
        managedHeader={Boolean(props.leftHeader)}
        side="left"
        suppressed={expandedPanel === "right"}
        visible={visibility.left}
        workspaceExpanded={expandedPanel === "left"}
        hideToggle={props.externalPanelControls}
        onToggle={() => toggle("left")}
      />
      <WorkspacePanelSeparator
        bounds={leftBounds}
        controls={leftPanelId}
        label={props.left.label}
        side="left"
        snapFeedback={snapFeedback?.side === "left" ? snapFeedback.state : undefined}
        value={expandedPanel === "left" ? layoutWidth : displayWidths.left}
        visible={visibility.left && expandedPanel !== "right"}
        workspaceExpanded={expandedPanel === "left"}
        onPointerDown={(event) => startResize("left", event)}
        onReset={() => {
          setExpanded(null);
          resizePanel("left", leftBounds.defaultWidth);
        }}
        onResize={(width) => resizePanel("left", width)}
      />
      <div
        aria-hidden={expandedPanel !== null}
        className={`min-h-0 min-w-0 overflow-hidden ${expandedPanel ? "invisible" : ""} ${props.contentClassName ?? ""}`}
      >
        {centerContent}
      </div>
      <WorkspacePanelSeparator
        bounds={rightBounds}
        controls={rightPanelId}
        label={props.right.label}
        side="right"
        snapFeedback={snapFeedback?.side === "right" ? snapFeedback.state : undefined}
        value={expandedPanel === "right" ? layoutWidth : displayWidths.right}
        visible={visibility.right && expandedPanel !== "left"}
        workspaceExpanded={expandedPanel === "right"}
        onPointerDown={(event) => startResize("right", event)}
        onReset={() => {
          setExpanded(null);
          resizePanel("right", rightBounds.defaultWidth);
        }}
        onResize={(width) => resizePanel("right", width)}
      />
      <WorkspacePanel
        content={props.right.content}
        contentClassName={props.right.className}
        controls={rightPanelId}
        label={props.right.label}
        header={props.rightHeader?.(rightControls)}
        managedHeader={Boolean(props.rightHeader)}
        side="right"
        suppressed={expandedPanel === "left"}
        visible={visibility.right}
        workspaceExpanded={expandedPanel === "right"}
        hideToggle={props.externalPanelControls}
        onToggle={() => toggle("right")}
      />
    </div>
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
