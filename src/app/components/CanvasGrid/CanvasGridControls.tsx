import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Grid2X2, Grid3X3, Grip } from "lucide-react";

import type { CanvasGridMode, CanvasLayoutGridSettings } from "./canvas-grid-types";
import { LayoutGridMenu } from "./LayoutGridMenu";
import { GridModeButton } from "./GridModeButton";

export const colorPresets = ["#22D3EE", "#60A5FA", "#34D399", "#FBBF24", "#FB7185", "#F8FAFC"];

export function CanvasGridControls(props: {
  gridVisible: boolean;
  layoutGrid: CanvasLayoutGridSettings;
  mode: CanvasGridMode;
  onGridVisibleChange: (visible: boolean) => void;
  onLayoutGridChange: (settings: CanvasLayoutGridSettings) => void;
  onModeChange: (mode: CanvasGridMode) => void;
}) {
  return (
    <div
      className="mr-1 flex h-9 items-center gap-1 border-r border-white/10 pr-1 lg:h-7"
      onKeyDownCapture={(event) => {
        const nextMode = gridModeForKey(event.key, props.mode);
        if (!nextMode || !(event.target instanceof Element) || !event.target.closest('[aria-label="Canvas grid style"]')) return;
        event.preventDefault();
        props.onGridVisibleChange(true);
        props.onModeChange(nextMode);
        event.currentTarget.querySelector<HTMLElement>(`[aria-label="${nextMode === "dots" ? "Dot grid" : "Line grid"}"]`)?.focus();
      }}
    >
      <LayoutGridMenu settings={props.layoutGrid} onChange={props.onLayoutGridChange} />
      <ToggleButton
        isIconOnly
        aria-label={props.gridVisible ? "Hide canvas grid" : "Show canvas grid"}
        className="size-9 min-w-9 rounded-md bg-transparent text-zinc-500 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-white/10 data-[selected]:text-zinc-100 lg:size-7 lg:min-w-7"
        isSelected={props.gridVisible}
        size="sm"
        variant="ghost"
        onChange={props.onGridVisibleChange}
      >
        <Grid3X3 size={13} />
      </ToggleButton>
      <ToggleButtonGroup
        aria-label="Canvas grid style"
        className={`hidden lg:flex ${props.gridVisible ? "" : "opacity-45"}`}
        disallowEmptySelection
        selectedKeys={[props.mode]}
        selectionMode="single"
        size="sm"
        onSelectionChange={(keys) => {
          const mode = [...keys][0];
          if (mode === "dots" || mode === "lines") {
            props.onGridVisibleChange(true);
            props.onModeChange(mode);
          }
        }}
      >
        <GridModeButton icon={<Grip size={13} />} id="dots" label="Dot grid" />
        <GridModeButton icon={<Grid2X2 size={13} />} id="lines" label="Line grid" />
      </ToggleButtonGroup>
    </div>
  );
}

function gridModeForKey(key: string, current: CanvasGridMode): CanvasGridMode | undefined {
  if (key === "Home") return "dots";
  if (key === "End") return "lines";
  if (key === "ArrowLeft" || key === "ArrowUp") return current === "lines" ? "dots" : "lines";
  if (key === "ArrowRight" || key === "ArrowDown") return current === "dots" ? "lines" : "dots";
  return undefined;
}
