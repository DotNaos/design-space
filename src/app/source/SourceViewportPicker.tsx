import { Label, ListBox, Select, Slider } from "@heroui/react";
import { MonitorSmartphone } from "lucide-react";

import { sourceViewportPresets } from "./source-viewports";

export function SourceViewportPicker(props: {
  presetId: string;
  responsiveWidth: number;
  onPresetChange: (id: string) => void;
  onResponsiveWidthChange: (width: number) => void;
}) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex h-8 max-w-[44%] -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-[#17181b]/95 px-2 shadow-xl">
      <MonitorSmartphone aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />
      <Select
        aria-label="Preview dimensions"
        className="min-w-0 flex-1"
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
    </div>
  );
}
