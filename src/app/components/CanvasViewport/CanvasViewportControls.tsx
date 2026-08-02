import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { Fingerprint, Hand, Maximize2, Minus, MonitorSmartphone, MousePointer2, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import { CanvasGridControls } from "../CanvasGrid/CanvasGridControls";
import type { CanvasGridMode, CanvasLayoutGridSettings } from "../CanvasGrid/canvas-grid-types";

type CanvasViewportControlsProps = {
  compact?: boolean;
  headerContent?: React.ReactNode;
  headerHeight?: number;
  leadingContent?: React.ReactNode;
  narrow?: boolean;
  signingContent?: React.ReactNode;
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
  const [toolbarTab, setToolbarTab] = useState<"viewport" | "canvas" | "signing">(() => props.leadingContent ? "viewport" : "canvas");
  const headerHeight = props.headerContent ? props.headerHeight ?? 36 : 0;
  const toolbarTop = headerHeight + (props.narrow ? 8 : 12);
  const nested = props.narrow || Boolean(props.signingContent);

  useEffect(() => {
    if (toolbarTab === "signing" && !props.signingContent) {
      setToolbarTab(props.leadingContent ? "viewport" : "canvas");
    }
  }, [props.leadingContent, props.signingContent, toolbarTab]);
  return (
    <>
      {props.headerContent ? (
        <div
          className="pointer-events-auto absolute inset-x-0 top-0 z-20"
          data-design-space-canvas-chrome
          data-testid="canvas-fixed-header"
          style={{ height: headerHeight }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {props.headerContent}
        </div>
      ) : null}
      {!props.compact && props.showInteractionToggle !== false && (
        <Tooltip delay={350}>
        <ToggleButton
          isIconOnly
          aria-label={props.interactionMode === "select" ? "Switch to interact mode" : "Switch to select mode"}
          className={`absolute left-2 z-20 grid size-8 place-items-center rounded-lg border-0 ${props.interactionMode === "select" ? "bg-sky-500 text-white" : "bg-[#17181b]/96 text-zinc-300"}`}
          style={{ top: toolbarTop }}
          isSelected={props.interactionMode === "select"}
          variant="ghost"
          onChange={props.onToggleInteractionMode}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {props.interactionMode === "select" ? <MousePointer2 size={15} /> : <Hand size={15} />}
        </ToggleButton>
        <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
          {props.interactionMode === "select" ? "Select elements" : "Use the rendered UI"}
        </Tooltip.Content>
        </Tooltip>
      )}
      {nested ? (
        <div
          data-testid="canvas-viewport-toolbar"
          data-layout="nested"
          className={`group/canvas-controls absolute left-12 right-2 z-20 overflow-hidden rounded-xl bg-[#17181b]/96 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm ${props.narrow ? "" : "mx-auto max-w-[760px]"}`}
          data-narrow={props.narrow || undefined}
          style={{ top: toolbarTop }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <nav aria-label="Canvas toolbar sections" className="flex h-7 items-end gap-1 border-b border-white/[0.06] px-1">
            {props.leadingContent ? (
              <NarrowToolbarTab active={toolbarTab === "viewport"} label="Viewport" onPress={() => setToolbarTab("viewport")}>
                <MonitorSmartphone size={12} />
              </NarrowToolbarTab>
            ) : null}
            <NarrowToolbarTab active={toolbarTab === "canvas"} label="Canvas" onPress={() => setToolbarTab("canvas")}>
              <SlidersHorizontal size={12} />
            </NarrowToolbarTab>
            {props.signingContent ? (
              <NarrowToolbarTab active={toolbarTab === "signing"} label="Signing" onPress={() => setToolbarTab("signing")}>
                <Fingerprint size={12} />
              </NarrowToolbarTab>
            ) : null}
          </nav>
          <div className="flex h-9 min-w-0 items-center overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {toolbarTab === "viewport" ? (
              <div className="min-w-0 shrink-0">{props.leadingContent}</div>
            ) : toolbarTab === "signing" ? (
              <div className="flex min-w-0 flex-1 items-center px-1">{props.signingContent}</div>
            ) : (
              <CanvasActions {...props} compact />
            )}
          </div>
        </div>
      ) : (
        <div
          data-testid="canvas-viewport-toolbar"
          className={`group/canvas-controls absolute z-20 flex h-9 max-w-[calc(100%-1rem)] items-center overflow-x-auto rounded-xl bg-[#17181b]/96 px-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:h-8 ${props.leadingContent ? "left-1/2 -translate-x-1/2" : "right-2"}`}
          style={{ top: toolbarTop }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {props.leadingContent && <div className="min-w-0 shrink">{props.leadingContent}</div>}
          {props.leadingContent && <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-white/10" />}
          <CanvasActions {...props} />
        </div>
      )}
    </>
  );
}

function NarrowToolbarTab(props: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      className={`relative h-6 gap-1 rounded-none px-2 text-[9px] ${props.active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.children}
      {props.label}
      {props.active ? <span aria-hidden="true" className="absolute inset-x-1 bottom-0 h-0.5 rounded-t-full bg-sky-300" /> : null}
    </Button>
  );
}

function CanvasActions(props: CanvasViewportControlsProps & { compact?: boolean }) {
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
