import { Label, ListBox, Select, Slider, ToggleButton, Tooltip } from "@heroui/react";
import { Crop, Frame, Monitor, Scan, Scaling, Smartphone, Tablet } from "lucide-react";
import type { ReactNode } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import { SourceDeviceTabs } from "./SourceDeviceTabs";
import type { SourceTreeNode } from "./source-workspace-tree";
import { sourceViewportPresets, type SourceViewportPreset } from "./source-viewports";

function ViewportDeviceIcon(props: { device: SourceViewportPreset["device"]; className?: string }) {
  const iconProps = { "aria-hidden": true as const, className: props.className, size: 12, strokeWidth: 1.8 };
  if (props.device === "desktop") return <Monitor {...iconProps} />;
  if (props.device === "tablet") return <Tablet {...iconProps} />;
  if (props.device === "mobile") return <Smartphone {...iconProps} />;
  return <Scaling {...iconProps} />;
}

const viewportSectionLabel: Partial<Record<string, string>> = {
  responsive: "Responsive",
  "desktop-1440": "Desktop",
  "tablet-1024": "Tablet",
  "mobile-430": "Mobile",
};

export function SourceViewportPicker(props: {
  after?: ReactNode;
  clipToScreen: boolean;
  device: DesignSpaceDevice;
  showDeviceFrame: boolean;
  node?: SourceTreeNode;
  presetId: string;
  responsiveWidth: number;
  showDeviceTabs?: boolean;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onClipToScreenChange: (clipToScreen: boolean) => void;
  onShowDeviceFrameChange: (showDeviceFrame: boolean) => void;
  onPresetChange: (id: string) => void;
  onResponsiveWidthChange: (width: number) => void;
}) {
  const selectedPreset = sourceViewportPresets.find((preset) => preset.id === props.presetId);
  return (
    <div className="pointer-events-auto flex h-8 min-w-0 items-center gap-1 px-0.5 lg:h-7">
      {props.showDeviceTabs !== false ? <SourceDeviceTabs device={props.device} node={props.node} onChange={props.onDeviceChange} /> : null}
      {props.showDeviceTabs !== false ? <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" /> : null}
      <Select
        aria-label="Preview dimensions"
        className="w-[4.75rem] shrink-0"
        selectedKey={props.presetId}
        onSelectionChange={(key) => props.onPresetChange(String(key))}
      >
        <Select.Trigger className="flex h-6 min-w-0 items-center gap-1 bg-transparent text-zinc-300 outline-none">
          <Select.Value className="flex min-w-0 flex-1 items-center gap-1 text-left leading-none text-zinc-300">
            <ViewportDeviceIcon device={selectedPreset?.device ?? "responsive"} className="shrink-0 text-zinc-400" />
            <span className="text-[8px] font-medium">{selectedPreset?.compactLabel}</span>
          </Select.Value>
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover placement="bottom" className="max-h-80 min-w-52 overflow-y-auto rounded-xl bg-[#1a1b1e] p-1.5 shadow-2xl">
          <ListBox items={sourceViewportPresets} className="flex flex-col gap-0">
            {(preset) => (
              <ListBox.Item id={preset.id} textValue={preset.label} className="group !block !min-h-0 cursor-default !rounded-none !bg-transparent !p-0 outline-none">
                {viewportSectionLabel[preset.id] ? <span className={`block px-2.5 pb-1 text-[9px] font-medium text-zinc-500 ${preset.id === "responsive" ? "pt-0.5" : "pt-2"}`}>{viewportSectionLabel[preset.id]}</span> : null}
                <span className="flex h-7 items-center gap-2 rounded-lg px-2.5 text-[11px] text-zinc-300 group-data-[focused]:bg-white/[0.07] group-data-[selected]:bg-white/10 group-data-[selected]:text-sky-300">
                  <ViewportDeviceIcon device={preset.device} className="shrink-0 text-zinc-500" />
                  <span>{preset.device === "responsive" ? "Fluid" : preset.label.split(" · ")[1]}</span>
                  <ListBox.ItemIndicator className="ml-auto size-3" />
                </span>
              </ListBox.Item>
            )}
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
        <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
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
        <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
          {props.clipToScreen ? "Clip to selected screen" : "Hug rendered content"}
        </Tooltip.Content>
      </Tooltip>
      {props.after ? <><span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />{props.after}</> : null}
    </div>
  );
}
