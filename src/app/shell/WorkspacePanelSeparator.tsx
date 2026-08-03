
import { type KeyboardEvent, type PointerEvent } from "react";
import { type PanelWidthBounds, type WorkspacePanelWidths } from "./workspace-panel-state";
import { PanelSnapFeedback } from "./ResizableWorkspacePanels";

export function WorkspacePanelSeparator(props: {
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
