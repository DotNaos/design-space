import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { Hand, Maximize2, Minus, MousePointer2, Plus, RotateCcw } from "lucide-react";

import { CanvasGridControls } from "../CanvasGrid/CanvasGridControls";
import type { CanvasGridMode, CanvasLayoutGridSettings } from "../CanvasGrid/canvas-grid-types";

type CanvasViewportControlsProps = {
  compact?: boolean;
  showInteractionToggle?: boolean;
  gridMode: CanvasGridMode;
  gridVisible: boolean;
  interactionMode: "select" | "interact";
  layoutGrid: CanvasLayoutGridSettings;
  scale: number;
  onFit: () => void;
  onGridModeChange: (mode: CanvasGridMode) => void;
  onGridVisibleChange: (visible: boolean) => void;
  onLayoutGridChange: (settings: CanvasLayoutGridSettings) => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInteractionMode: () => void;
};

export function CanvasViewportControls(props: CanvasViewportControlsProps) {
  return (
    <>
      {!props.compact && props.showInteractionToggle !== false && (
        <Tooltip delay={350}>
        <ToggleButton
          isIconOnly
          aria-label={props.interactionMode === "select" ? "Switch to interact mode" : "Switch to select mode"}
          className={`absolute left-3 top-3 z-20 grid size-11 place-items-center rounded-lg border shadow-xl lg:size-8 ${props.interactionMode === "select" ? "border-sky-300/30 bg-sky-500 text-white" : "border-white/10 bg-[#17181b]/95 text-zinc-300"}`}
          isSelected={props.interactionMode === "select"}
          variant="ghost"
          onChange={props.onToggleInteractionMode}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {props.interactionMode === "select" ? <MousePointer2 size={15} /> : <Hand size={15} />}
        </ToggleButton>
        <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
          {props.interactionMode === "select" ? "Select elements" : "Use the rendered UI"}
        </Tooltip.Content>
        </Tooltip>
      )}
      <div
        className="absolute right-3 top-3 z-20 flex h-11 items-center rounded-lg border border-white/10 bg-[#17181b]/95 px-1 shadow-xl lg:h-8"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <CanvasGridControls
          gridVisible={props.gridVisible}
          layoutGrid={props.layoutGrid}
          mode={props.gridMode}
          onGridVisibleChange={props.onGridVisibleChange}
          onLayoutGridChange={props.onLayoutGridChange}
          onModeChange={props.onGridModeChange}
        />
        <Button isIconOnly aria-label="Zoom out" className="size-9 min-w-9 text-zinc-400 lg:size-7 lg:min-w-7" size="sm" variant="ghost" onPress={props.onZoomOut}><Minus size={14} /></Button>
        <span className="min-w-10 text-center text-[10px] tabular-nums text-zinc-300">{Math.round(props.scale * 100)}%</span>
        <Button isIconOnly aria-label="Zoom in" className="size-9 min-w-9 text-zinc-400 lg:size-7 lg:min-w-7" size="sm" variant="ghost" onPress={props.onZoomIn}><Plus size={14} /></Button>
        <Button aria-label="Fit canvas" className="h-9 min-w-11 border-l border-white/10 px-2 text-[10px] text-zinc-300 lg:h-7" size="sm" variant="ghost" onPress={props.onFit}><Maximize2 size={12} /> Fit</Button>
        <Button isIconOnly aria-label="Reset zoom to 100%" className="size-9 min-w-9 border-l border-white/10 text-zinc-400 lg:size-7 lg:min-w-7" size="sm" variant="ghost" onPress={props.onReset}><RotateCcw size={13} /></Button>
      </div>
    </>
  );
}
