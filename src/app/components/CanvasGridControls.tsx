import {
  Button,
  ColorField,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
  Popover,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  parseColor,
} from "@heroui/react";
import { Grid2X2, Grip, LayoutGrid } from "lucide-react";

import type { CanvasGridMode, CanvasLayoutGridSettings, CanvasLayoutGridSize } from "./canvas-grid-types";

const colorPresets = ["#22D3EE", "#60A5FA", "#34D399", "#FBBF24", "#FB7185", "#F8FAFC"];

export function CanvasGridControls(props: {
  layoutGrid: CanvasLayoutGridSettings;
  mode: CanvasGridMode;
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
        props.onModeChange(nextMode);
        event.currentTarget.querySelector<HTMLElement>(`[aria-label="${nextMode === "dots" ? "Dot grid" : "Line grid"}"]`)?.focus();
      }}
    >
      <LayoutGridMenu settings={props.layoutGrid} onChange={props.onLayoutGridChange} />
      <ToggleButtonGroup
        aria-label="Canvas grid style"
        disallowEmptySelection
        selectedKeys={[props.mode]}
        selectionMode="single"
        size="sm"
        onSelectionChange={(keys) => {
          const mode = [...keys][0];
          if (mode === "dots" || mode === "lines") props.onModeChange(mode);
        }}
      >
        <GridModeButton icon={<Grip size={13} />} id="dots" label="Dot grid" />
        <GridModeButton icon={<Grid2X2 size={13} />} id="lines" label="Line grid" />
      </ToggleButtonGroup>
    </div>
  );
}

function LayoutGridMenu(props: {
  settings: CanvasLayoutGridSettings;
  onChange: (settings: CanvasLayoutGridSettings) => void;
}) {
  const parsedColor = parseColor(props.settings.color);
  const update = (patch: Partial<CanvasLayoutGridSettings>) => props.onChange({ ...props.settings, ...patch });
  return (
    <Popover>
      <Button
        isIconOnly
        aria-label="Layout grid settings"
        className={`relative size-9 min-w-9 rounded-md bg-transparent outline-none lg:size-7 lg:min-w-7 ${props.settings.enabled ? "text-sky-300" : "text-zinc-500"}`}
        size="sm"
        variant="ghost"
      >
        <LayoutGrid size={13} />
        {props.settings.enabled && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-sky-300" />}
      </Button>
      <Popover.Content
        className="w-64 rounded-xl border border-white/10 bg-[#18191c] p-0 text-zinc-200 shadow-2xl"
        offset={10}
        placement="bottom end"
      >
        <Popover.Dialog className="outline-none">
          <div className="border-b border-white/10 px-3 py-3">
            <Popover.Heading className="text-sm font-semibold">Layout grid</Popover.Heading>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">An always-on-top spacing guide. Pixel grid appears automatically at 400%.</p>
          </div>
          <div className="space-y-4 p-3">
            <Switch isSelected={props.settings.enabled} size="sm" onChange={(enabled) => update({ enabled })}>
              <Switch.Content className="flex w-full items-center justify-between gap-3 text-xs text-zinc-300">
                <span>Show layout grid</span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            <div className={props.settings.enabled ? "space-y-4" : "pointer-events-none space-y-4 opacity-40"}>
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">Spacing</p>
                <ToggleButtonGroup
                  aria-label="Layout grid spacing"
                  className="w-full"
                  disallowEmptySelection
                  fullWidth
                  selectedKeys={[String(props.settings.size)]}
                  selectionMode="single"
                  size="sm"
                  onSelectionChange={(keys) => {
                    const size = Number([...keys][0]);
                    if (size === 4 || size === 8) update({ size: size as CanvasLayoutGridSize });
                  }}
                >
                  <ToggleButton className="bg-white/[0.03] text-zinc-500 data-[selected]:bg-sky-400/15 data-[selected]:text-sky-200" id="4" variant="ghost">4 px</ToggleButton>
                  <ToggleButton className="bg-white/[0.03] text-zinc-500 data-[selected]:bg-sky-400/15 data-[selected]:text-sky-200" id="8" variant="ghost">8 px</ToggleButton>
                </ToggleButtonGroup>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">Color</p>
                <ColorSwatchPicker
                  aria-label="Layout grid color presets"
                  className="justify-between"
                  size="sm"
                  value={parsedColor}
                  onChange={(color) => update({ color: color.toString("hex") })}
                >
                  {colorPresets.map((color) => (
                    <ColorSwatchPicker.Item key={color} color={color}>
                      <ColorSwatchPicker.Swatch />
                      <ColorSwatchPicker.Indicator />
                    </ColorSwatchPicker.Item>
                  ))}
                </ColorSwatchPicker>
                <ColorField
                  fullWidth
                  className="mt-3"
                  name="layout-grid-color"
                  value={parsedColor}
                  onChange={(color) => color && update({ color: color.toString("hex") })}
                >
                  <Label className="sr-only">Custom layout grid color</Label>
                  <ColorField.Group className="h-9 border-white/10 bg-black/20" variant="secondary">
                    <ColorField.Prefix className="pl-2"><ColorSwatch color={parsedColor} size="xs" /></ColorField.Prefix>
                    <ColorField.Input aria-label="Custom layout grid color" className="font-mono text-xs uppercase text-zinc-300" />
                  </ColorField.Group>
                </ColorField>
              </div>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function GridModeButton(props: { icon: React.ReactNode; id: CanvasGridMode; label: string }) {
  return (
    <ToggleButton
      isIconOnly
      aria-label={props.label}
      className="size-9 min-w-9 rounded-md bg-transparent text-zinc-500 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-white/10 data-[selected]:text-zinc-100 lg:size-7 lg:min-w-7"
      id={props.id}
      variant="ghost"
    >
      {props.icon}
    </ToggleButton>
  );
}

function gridModeForKey(key: string, current: CanvasGridMode): CanvasGridMode | undefined {
  if (key === "Home") return "dots";
  if (key === "End") return "lines";
  if (key === "ArrowLeft" || key === "ArrowUp") return current === "lines" ? "dots" : "lines";
  if (key === "ArrowRight" || key === "ArrowDown") return current === "dots" ? "lines" : "dots";
  return undefined;
}
