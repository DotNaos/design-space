import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Grid2X2, Grip, Hand, Maximize2, Minus, MousePointer2, Plus, RotateCcw } from "lucide-react";

export type CanvasGridMode = "dots" | "lines";

type CanvasViewportControlsProps = {
  compact?: boolean;
  gridMode: CanvasGridMode;
  interactionMode: "select" | "interact";
  scale: number;
  onFit: () => void;
  onGridModeChange: (mode: CanvasGridMode) => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInteractionMode: () => void;
};

export function CanvasViewportControls(props: CanvasViewportControlsProps) {
  return (
    <>
      {!props.compact && (
        <button
          aria-label={props.interactionMode === "select" ? "Switch to interact mode" : "Switch to select mode"}
          aria-pressed={props.interactionMode === "select"}
          className={`absolute left-3 top-3 z-20 grid size-11 place-items-center rounded-lg border shadow-xl lg:size-8 ${props.interactionMode === "select" ? "border-sky-300/30 bg-sky-500 text-white" : "border-white/10 bg-[#17181b]/95 text-zinc-300"}`}
          title={props.interactionMode === "select" ? "Select elements" : "Use the rendered UI"}
          type="button"
          onClick={(event) => { event.stopPropagation(); props.onToggleInteractionMode(); }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {props.interactionMode === "select" ? <MousePointer2 size={15} /> : <Hand size={15} />}
        </button>
      )}
      <div
        className="absolute right-3 top-3 z-20 flex h-11 items-center rounded-lg border border-white/10 bg-[#17181b]/95 px-1 shadow-xl lg:h-8"
        onKeyDownCapture={(event) => {
          const nextMode = gridModeForKey(event.key, props.gridMode);
          if (!nextMode || !(event.target instanceof Element) || !event.target.closest('[role="radiogroup"]')) return;
          event.preventDefault();
          props.onGridModeChange(nextMode);
          event.currentTarget.querySelector<HTMLElement>(`[aria-label="${nextMode === "dots" ? "Dot grid" : "Line grid"}"]`)?.focus();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <ToggleButtonGroup
          aria-label="Canvas grid style"
          className="mr-1 h-9 border-r border-white/10 pr-1 lg:h-7"
          disallowEmptySelection
          selectedKeys={[props.gridMode]}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys) => {
            const mode = [...keys][0];
            if (mode === "dots" || mode === "lines") props.onGridModeChange(mode);
          }}
        >
          <ToggleButton
            isIconOnly
            aria-label="Dot grid"
            className="size-9 min-w-9 rounded-md bg-transparent text-zinc-500 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-white/10 data-[selected]:text-zinc-100 lg:size-7 lg:min-w-7"
            id="dots"
            variant="ghost"
          >
            <Grip size={13} />
          </ToggleButton>
          <ToggleButton
            isIconOnly
            aria-label="Line grid"
            className="size-9 min-w-9 rounded-md bg-transparent text-zinc-500 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-white/10 data-[selected]:text-zinc-100 lg:size-7 lg:min-w-7"
            id="lines"
            variant="ghost"
          >
            <Grid2X2 size={13} />
          </ToggleButton>
        </ToggleButtonGroup>
        <button aria-label="Zoom out" className="grid size-9 place-items-center text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); props.onZoomOut(); }}><Minus size={14} /></button>
        <span className="min-w-10 text-center text-[10px] tabular-nums text-zinc-300">{Math.round(props.scale * 100)}%</span>
        <button aria-label="Zoom in" className="grid size-9 place-items-center text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); props.onZoomIn(); }}><Plus size={14} /></button>
        <button aria-label="Fit canvas" className="grid h-9 min-w-11 place-items-center border-l border-white/10 px-2 text-[10px] text-zinc-300 lg:h-7" type="button" onClick={(event) => { event.stopPropagation(); props.onFit(); }}><span className="flex items-center gap-1"><Maximize2 size={12} /> Fit</span></button>
        <button aria-label="Reset zoom to 100%" className="grid size-9 place-items-center border-l border-white/10 text-zinc-400 lg:size-7" type="button" onClick={(event) => { event.stopPropagation(); props.onReset(); }}><RotateCcw size={13} /></button>
      </div>
    </>
  );
}

function gridModeForKey(key: string, current: CanvasGridMode): CanvasGridMode | undefined {
  if (key === "Home") return "dots";
  if (key === "End") return "lines";
  if (key === "ArrowLeft" || key === "ArrowUp") return current === "lines" ? "dots" : "lines";
  if (key === "ArrowRight" || key === "ArrowDown") return current === "dots" ? "lines" : "dots";
  return undefined;
}
