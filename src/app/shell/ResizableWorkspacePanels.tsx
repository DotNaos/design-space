import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button, Tooltip } from "@heroui/react";

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
import { useWorkspacePanelVisibility } from "./use-workspace-panel-visibility";
import { useWorkspacePanelControl } from "./use-workspace-panel-control";
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
const COLLAPSED_PANEL_WIDTH = 36;
const SNAP_RESISTANCE_DISTANCE = 56;

type PanelSide = keyof WorkspacePanelWidths;
type PanelSnapFeedback = "resist-collapse" | "collapse" | "resist-expand" | "expand" | "resist-restore" | "restore";

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
  leftHeader?: (controls: WorkspacePanelControls) => ReactNode;
  externalPanelControls?: boolean;
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
    const expandedAtStart = visibility.expanded === side;
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
          feedback = requestedWidth - maximumWidth >= SNAP_RESISTANCE_DISTANCE
            ? "expand"
            : "resist-expand";
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
  }, [bounds, displayWidths, layoutWidth, maximumPanelWidth, resizePanel, setExpanded, setVisible, visibility.expanded]);

  if (!isDesktop) {
    return <>{props.mobile ?? centerContent}</>;
  }

  return (
    <div
      ref={layoutRef}
      className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${props.className ?? ""}`}
      data-workspace-panel-layout="desktop"
      data-workspace-panel-expanded={visibility.expanded ?? undefined}
      style={{
        gridTemplateColumns: visibility.expanded === "left"
          ? "minmax(0,1fr) 1px 0 0 0"
          : visibility.expanded === "right"
            ? "0 0 0 1px minmax(0,1fr)"
            : `${columnWidths.left}px 1px minmax(${MINIMUM_CANVAS_WIDTH}px, 1fr) 1px ${columnWidths.right}px`,
      }}
    >
      <WorkspacePanel
        content={leftContent}
        contentClassName={props.left.className}
        controls={leftPanelId}
        label={props.left.label}
        header={props.leftHeader?.(leftControls)}
        managedHeader={Boolean(props.leftHeader)}
        side="left"
        suppressed={visibility.expanded === "right"}
        visible={visibility.left}
        workspaceExpanded={visibility.expanded === "left"}
        hideToggle={props.externalPanelControls}
        onToggle={() => toggle("left")}
      />
      <WorkspacePanelSeparator
        bounds={leftBounds}
        controls={leftPanelId}
        label={props.left.label}
        side="left"
        snapFeedback={snapFeedback?.side === "left" ? snapFeedback.state : undefined}
        value={visibility.expanded === "left" ? layoutWidth : displayWidths.left}
        visible={visibility.left && visibility.expanded !== "right"}
        workspaceExpanded={visibility.expanded === "left"}
        onPointerDown={(event) => startResize("left", event)}
        onReset={() => {
          setExpanded(null);
          resizePanel("left", leftBounds.defaultWidth);
        }}
        onResize={(width) => resizePanel("left", width)}
      />
      <div
        aria-hidden={visibility.expanded !== null}
        className={`min-h-0 min-w-0 overflow-hidden ${visibility.expanded ? "invisible" : ""} ${props.contentClassName ?? ""}`}
      >
        {centerContent}
      </div>
      <WorkspacePanelSeparator
        bounds={rightBounds}
        controls={rightPanelId}
        label={props.right.label}
        side="right"
        snapFeedback={snapFeedback?.side === "right" ? snapFeedback.state : undefined}
        value={visibility.expanded === "right" ? layoutWidth : displayWidths.right}
        visible={visibility.right && visibility.expanded !== "left"}
        workspaceExpanded={visibility.expanded === "right"}
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
        side="right"
        suppressed={visibility.expanded === "left"}
        visible={visibility.right}
        workspaceExpanded={visibility.expanded === "right"}
        hideToggle={props.externalPanelControls}
        onToggle={() => toggle("right")}
      />
    </div>
  );
}

function WorkspacePanel(props: {
  content: ReactNode;
  contentClassName?: string;
  controls: string;
  label: string;
  header?: ReactNode;
  hideToggle?: boolean;
  managedHeader?: boolean;
  side: keyof WorkspacePanelWidths;
  suppressed: boolean;
  visible: boolean;
  workspaceExpanded: boolean;
  onToggle: () => void;
}) {
  if (props.managedHeader) {
    return (
      <section
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        data-workspace-panel={props.side}
        data-workspace-panel-collapsed={!props.visible || undefined}
        data-workspace-panel-expanded={props.workspaceExpanded || undefined}
        data-workspace-panel-suppressed={props.suppressed || undefined}
      >
        {props.header}
        <div
          id={props.controls}
          aria-label={props.label}
          aria-hidden={!props.visible || props.suppressed}
          className={`min-h-0 min-w-0 flex-1 overflow-hidden ${
            props.visible && !props.suppressed ? props.contentClassName ?? "" : "hidden"
          }`}
          role="region"
        >
          {props.content}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`grid min-h-0 min-w-0 overflow-hidden ${
        props.hideToggle
          ? "grid-cols-[minmax(0,1fr)]"
          : props.visible
          ? props.side === "left"
            ? "grid-cols-[minmax(0,1fr)_36px]"
            : "grid-cols-[36px_minmax(0,1fr)]"
          : "grid-cols-[36px]"
      }`}
      data-workspace-panel={props.side}
      data-workspace-panel-collapsed={!props.visible || undefined}
      data-workspace-panel-expanded={props.workspaceExpanded || undefined}
      data-workspace-panel-suppressed={props.suppressed || undefined}
    >
      <div
        id={props.controls}
        aria-label={props.label}
        aria-hidden={!props.visible || props.suppressed}
        className={`h-full min-h-0 min-w-0 overflow-hidden ${
          props.visible && !props.suppressed ? props.side === "right" ? "order-2" : "order-1" : "hidden"
        } ${props.contentClassName ?? ""}`}
        role="region"
      >
        {props.content}
      </div>
      {props.hideToggle ? null : (
        <div className={`${props.visible && props.side === "left" ? "order-2" : "order-1"} flex min-w-0 justify-center`}>
          <WorkspacePanelToggle
            controls={props.controls}
            label={props.label}
            side={props.side}
            visible={props.visible}
            onToggle={props.onToggle}
          />
        </div>
      )}
    </section>
  );
}

function WorkspacePanelSeparator(props: {
  bounds: PanelWidthBounds;
  controls: string;
  label: string;
  side: keyof WorkspacePanelWidths;
  snapFeedback?: PanelSnapFeedback;
  value: number;
  visible: boolean;
  workspaceExpanded: boolean;
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
    <div className="relative z-30 w-px">
      <div
        aria-label={`Resize ${props.label}`}
        aria-controls={props.controls}
        aria-orientation="vertical"
        aria-valuemax={props.visible ? props.workspaceExpanded ? Math.round(props.value) : props.bounds.maxWidth : undefined}
        aria-valuemin={props.visible ? props.bounds.minWidth : undefined}
        aria-valuenow={props.visible ? Math.round(props.value) : undefined}
        aria-valuetext={props.visible ? props.workspaceExpanded ? "Full width" : `${Math.round(props.value)} pixels` : "Collapsed"}
        className={`group absolute inset-y-0 left-0 w-px touch-none outline-none before:absolute before:inset-y-0 before:-inset-x-2 before:content-[''] ${
          props.visible ? "" : "pointer-events-none"
        } ${
          props.snapFeedback === "collapse" || props.snapFeedback === "expand" || props.snapFeedback === "restore"
            ? "cursor-col-resize bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.85)]"
            : props.snapFeedback
              ? "cursor-col-resize bg-white/70"
              : props.visible
                ? "cursor-col-resize bg-white/10 hover:bg-cyan-400/70 focus-visible:bg-cyan-300"
                : "bg-white/[0.06]"
        }`}
        data-workspace-panel-snap={props.snapFeedback}
        onDoubleClick={props.visible ? props.onReset : undefined}
        onKeyDown={props.visible ? resizeFromKeyboard : undefined}
        onPointerDown={props.visible ? props.onPointerDown : undefined}
        role="separator"
        tabIndex={props.visible ? 0 : -1}
        title={props.visible ? "Drag or use arrow keys to resize. Double-click to reset." : undefined}
      />
    </div>
  );
}

function WorkspacePanelToggle(props: {
  controls: string;
  label: string;
  side: keyof WorkspacePanelWidths;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-controls={props.controls}
        aria-expanded={props.visible}
        aria-label={`${props.visible ? "Hide" : "Show"} ${props.label}`}
        className="mt-2 size-7 min-w-7 rounded-lg border-0 bg-[#17181b]/95 text-zinc-500 shadow-lg shadow-black/20 backdrop-blur hover:bg-[#202126] hover:text-zinc-200"
        data-workspace-panel-toggle={props.side}
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        <PanelToggleIcon side={props.side} visible={props.visible} />
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.visible ? "Hide" : "Show"} {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}

function PanelToggleIcon(props: { side: keyof WorkspacePanelWidths; visible: boolean }) {
  const Icon = props.side === "left"
    ? props.visible ? PanelLeftClose : PanelLeftOpen
    : props.visible ? PanelRightClose : PanelRightOpen;
  return <Icon aria-hidden="true" size={14} />;
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
