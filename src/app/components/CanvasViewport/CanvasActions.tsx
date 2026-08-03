import { Button } from "@heroui/react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { CanvasGridControls } from "../CanvasGrid/CanvasGridControls";
import { CanvasViewportControlsProps } from "./CanvasViewportControls";

export function CanvasActions(props: CanvasViewportControlsProps & { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center">
      <div className={props.compact ? "block" : "hidden shrink-0 sm:block"}>
        <CanvasGridControls
          gridVisible={props.gridVisible}
          layoutGrid={props.layoutGrid}
          mode={props.gridMode}
          onGridVisibleChange={props.onGridVisibleChange}
          onLayoutGridChange={props.onLayoutGridChange}
          onModeChange={props.onGridModeChange}
        />
      </div>
      <Button isIconOnly aria-label="Zoom out" className={`${props.compact ? "inline-flex" : "hidden sm:inline-flex"} size-8 min-w-8 text-zinc-500 lg:size-7 lg:min-w-7`} size="sm" variant="ghost" onPress={props.onZoomOut}><Minus size={13} /></Button>
      <span className={`${props.compact ? "block" : "hidden sm:block"} min-w-10 text-center text-[10px] tabular-nums text-zinc-300`}>{Math.round(props.scale * 100)}%</span>
      <Button isIconOnly aria-label="Zoom in" className={`${props.compact ? "inline-flex" : "hidden sm:inline-flex"} size-8 min-w-8 text-zinc-500 lg:size-7 lg:min-w-7`} size="sm" variant="ghost" onPress={props.onZoomIn}><Plus size={13} /></Button>
      <Button aria-label="Fit canvas" className="h-8 min-w-10 border-l border-white/[0.07] px-2 text-[10px] text-zinc-300 lg:h-7" size="sm" variant="ghost" onPress={props.onFit}><Maximize2 size={12} /> Fit</Button>
      <Button isIconOnly aria-label="Reset zoom to 100%" className="size-8 min-w-8 border-l border-white/[0.07] text-zinc-500 lg:size-7 lg:min-w-7" size="sm" variant="ghost" onPress={props.onReset}><RotateCcw size={13} /></Button>
    </div>
  );
}
