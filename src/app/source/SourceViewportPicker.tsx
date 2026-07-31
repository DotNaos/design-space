import { Label, ListBox, Select, Slider, ToggleButton, Tooltip } from "@heroui/react";
import { Crop, Frame, MonitorSmartphone, Scan } from "lucide-react";
import type { ReactNode } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import { SourceDeviceTabs } from "./SourceDeviceTabs";
import type { SourceTreeNode } from "./source-workspace-tree";
import { sourceViewportPresets } from "./source-viewports";

export function SourceViewportPicker(props: {
  after?: ReactNode;
  clipToScreen: boolean;
  device: DesignSpaceDevice;
  showDeviceFrame: boolean;
  node?: SourceTreeNode;
  presetId: string;
  responsiveWidth: number;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onClipToScreenChange: (clipToScreen: boolean) => void;
  onShowDeviceFrameChange: (showDeviceFrame: boolean) => void;
  onPresetChange: (id: string) => void;
  onResponsiveWidthChange: (width: number) => void;
}) {
  return (
    <div className="pointer-events-auto flex h-9 min-w-0 items-center gap-1 px-0.5 lg:h-7">
      <SourceDeviceTabs device={props.device} node={props.node} onChange={props.onDeviceChange} />
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />
      <MonitorSmartphone aria-hidden="true" className="hidden shrink-0 text-zinc-500 sm:block group-data-[narrow=true]/canvas-controls:hidden" size={13} />
      <Select
        aria-label="Preview dimensions"
        className="w-28 min-w-0 shrink sm:w-36 lg:w-44 group-data-[narrow=true]/canvas-controls:w-24"
        selectedKey={props.presetId}
        onSelectionChange={(key) => props.onPresetChange(String(key))}
      >
        <Select.Trigger className="flex h-6 min-w-0 items-center gap-1 bg-transparent text-[10px] text-zinc-300 outline-none">
          <Select.Value className="min-w-0 flex-1 truncate text-left" />
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover placement="bottom" className="max-h-80 min-w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-2xl">
          <ListBox items={sourceViewportPresets}>
            {(preset) => <ListBox.Item id={preset.id} textValue={preset.label} className="flex min-h-9 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300">{preset.label}<ListBox.ItemIndicator className="ml-auto size-3" /></ListBox.Item>}
          </ListBox>
        </Select.Popover>
      </Select>
      {props.presetId === "responsive" && (
        <>
          <span className="hidden shrink-0 text-[9px] tabular-nums text-sky-300 xl:inline">{props.responsiveWidth}px</span>
          <Slider
            aria-label="Responsive preview width"
            className="hidden w-20 shrink-0 xl:block"
            maxValue={1440}
            minValue={320}
            step={1}
            value={props.responsiveWidth}
            onChange={(value) => props.onResponsiveWidthChange(Number(Array.isArray(value) ? value[0] : value))}
          >
            <Label className="sr-only">Responsive preview width</Label>
            <Slider.Track className="relative h-6 w-full cursor-pointer">
              <span className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/10" />
              <Slider.Fill className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-sky-400" />
              <Slider.Thumb className="top-1/2 size-3 rounded-full border border-[#17181b] bg-sky-300 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-300" />
            </Slider.Track>
          </Slider>
        </>
      )}
      <Tooltip delay={350} closeDelay={80}>
        <ToggleButton
          isIconOnly
          aria-label={props.showDeviceFrame ? "Hide device mockup" : "Show device mockup"}
          className="size-6 min-w-6 rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 data-[selected]:bg-sky-400/15 data-[selected]:text-sky-200"
          isSelected={props.showDeviceFrame}
          size="sm"
          variant="ghost"
          onChange={props.onShowDeviceFrameChange}
        >
          <Frame aria-hidden="true" size={12} />
        </ToggleButton>
        <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
          {props.showDeviceFrame ? "Hide device mockup" : "Show device mockup"}
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={350} closeDelay={80}>
        <ToggleButton
          isIconOnly
          aria-label={props.clipToScreen ? "Clip preview to selected screen" : "Hug preview content"}
          className="size-6 min-w-6 rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 data-[selected]:bg-sky-400/15 data-[selected]:text-sky-200"
          isSelected={props.clipToScreen}
          size="sm"
          variant="ghost"
          onChange={props.onClipToScreenChange}
        >
          {props.clipToScreen ? <Crop aria-hidden="true" size={12} /> : <Scan aria-hidden="true" size={12} />}
        </ToggleButton>
        <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
          {props.clipToScreen ? "Clip to selected screen" : "Hug rendered content"}
        </Tooltip.Content>
      </Tooltip>
      {props.after ? <><span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />{props.after}</> : null}
    </div>
  );
}
