import { Button, Tabs, Tooltip } from "@heroui/react";
import { Braces, ChevronDown, CircleDot, LayoutPanelTop, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ComponentControl } from "../../../shared/contracts";
import type { DesignValue } from "../../../shared/design-document";
import type { SlotState } from "../../types";
import { TailwindClassField } from "../../inspector/TailwindClassField";
import { TailwindMappedControls } from "../../inspector/TailwindMappedControls";
import { EditorSelectField } from "../EditorSelectField/EditorSelectField";
import { PropertyControlField } from "../PropertyControlField/PropertyControlField";

type ToolId = "design" | "properties" | "slots" | "classes";
type Tool = { id: ToolId; label: string; icon: React.ReactNode };

export function ItemEditorTools(props: {
  mode: "desktop" | "mobile";
  controls: readonly ComponentControl[];
  values: Readonly<Record<string, DesignValue | undefined>>;
  slots: readonly SlotState[];
  compileError?: string;
  onControlChange: (prop: string, value: DesignValue | undefined) => void;
  onSelectSlot?: (slot: SlotState) => void;
}) {
  const tailwindControls = useMemo(() => props.controls.filter((control) => control.kind === "tailwind"), [props.controls]);
  const propertyControls = useMemo(() => props.controls.filter((control) => control.kind !== "tailwind"), [props.controls]);
  const tools = useMemo<Tool[]>(() => [
    ...(tailwindControls.length ? [{ id: "design" as const, label: "Design", icon: <LayoutPanelTop size={17} /> }] : []),
    ...(propertyControls.length ? [{ id: "properties" as const, label: "Properties", icon: <SlidersHorizontal size={17} /> }] : []),
    ...(props.slots.length ? [{ id: "slots" as const, label: "Slots", icon: <CircleDot size={17} /> }] : []),
    ...(tailwindControls.length ? [{ id: "classes" as const, label: "Classes", icon: <Braces size={17} /> }] : []),
  ], [propertyControls.length, props.slots.length, tailwindControls.length]);
  const [selectedTool, setSelectedTool] = useState<ToolId>(tools[0]?.id ?? "properties");
  const [selectedTailwindProp, setSelectedTailwindProp] = useState(tailwindControls[0]?.prop ?? "");
  const selectedTailwindControl = tailwindControls.find((control) => control.prop === selectedTailwindProp) ?? tailwindControls[0];
  const rawTailwindValue = selectedTailwindControl ? props.values[selectedTailwindControl.prop] : "";
  const tailwindValue = typeof rawTailwindValue === "string" ? rawTailwindValue : "";

  useEffect(() => {
    if (!tools.some((tool) => tool.id === selectedTool)) setSelectedTool(tools[0]?.id ?? "properties");
  }, [selectedTool, tools]);
  useEffect(() => {
    if (!tailwindControls.some((control) => control.prop === selectedTailwindProp)) {
      setSelectedTailwindProp(tailwindControls[0]?.prop ?? "");
    }
  }, [selectedTailwindProp, tailwindControls]);

  if (!tools.length) {
    return <div className="grid min-h-0 flex-1 place-items-center px-5 text-center text-xs text-zinc-600">This component has no editable properties.</div>;
  }

  const desktop = props.mode === "desktop";
  return (
    <Tabs
      aria-label="Item editor tools"
      className={desktop ? "relative min-h-0 flex-1 !gap-0" : "flex min-h-0 flex-1 flex-col !gap-0"}
      orientation={desktop ? "vertical" : "horizontal"}
      selectedKey={selectedTool}
      variant="secondary"
      onSelectionChange={(key) => setSelectedTool(String(key) as ToolId)}
    >
      <Tabs.List
        aria-label="Item editor tools"
        className={desktop
          ? "absolute inset-y-0 left-0 z-20 flex w-12 flex-col items-stretch gap-1 border-r border-white/10 bg-[#111215] px-1.5 py-2"
          : "grid h-14 shrink-0 border-b border-white/10 bg-[#111215] px-1.5"
        }
        style={desktop ? undefined : { gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
      >
        {tools.map((tool) => (
          <Tooltip key={tool.id} delay={350} isDisabled={!desktop}>
          <Tabs.Tab
            id={tool.id}
            aria-label={tool.label}
            className={desktop
              ? "group relative grid size-9 place-items-center justify-self-center rounded-lg text-zinc-600 outline-none transition-colors hover:bg-white/5 hover:text-zinc-300 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-sky-400/10 data-[selected]:text-sky-300"
              : "group relative flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] text-zinc-600 outline-none transition-colors data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:text-sky-300"
            }
            style={desktop ? { width: 36, minWidth: 36, maxWidth: 36 } : undefined}
          >
            {tool.icon}
            {!desktop && <span className="truncate">{tool.label}</span>}
            <span
              aria-hidden="true"
              className={`${desktop ? "absolute -right-1.5 h-5 w-0.5 rounded-l-full" : "absolute inset-x-3 bottom-0 h-0.5 rounded-t-full"} bg-sky-400 opacity-0 group-data-[selected]:opacity-100`}
            />
          </Tabs.Tab>
          <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[9px] font-medium text-zinc-200 shadow-xl" placement="right">{tool.label}</Tooltip.Content>
          </Tooltip>
        ))}
      </Tabs.List>

      {tailwindControls.length > 0 && (
        <ToolPanel desktop={desktop} id="design">
          <ToolHeading description="Tailwind-backed visual controls" strictUi title="Design" />
          <TailwindTargetPicker controls={tailwindControls} selectedProp={selectedTailwindControl?.prop ?? ""} onChange={setSelectedTailwindProp} />
          {selectedTailwindControl && (
            <div className="px-4 py-4">
              <TailwindMappedControls
                value={tailwindValue}
                onChange={(value) => props.onControlChange(selectedTailwindControl.prop, value)}
              />
            </div>
          )}
        </ToolPanel>
      )}

      {propertyControls.length > 0 && (
        <ToolPanel desktop={desktop} id="properties">
          <ToolHeading description="Properties declared by the target" title="Properties" />
          {Object.entries(groupControls(propertyControls)).map(([section, controls]) => controls.length > 0 && (
            <PropertyGroup key={section} title={sectionLabel(section)}>
              {controls.map((control) => (
                <PropertyControlField
                  key={control.id}
                  control={control}
                  value={props.values[control.prop]}
                  onChange={(value) => props.onControlChange(control.prop, value)}
                />
              ))}
            </PropertyGroup>
          ))}
        </ToolPanel>
      )}

      {props.slots.length > 0 && (
        <ToolPanel desktop={desktop} id="slots">
          <ToolHeading description="Explicit child contracts for this component" title="Slots" />
          <div className="border-b border-white/10">
            {props.slots.map((slot) => {
              const full = slot.max !== undefined && slot.count >= slot.max;
              const detail = slot.count
                ? slot.childLabel ?? "Filled slot"
                : slot.acceptedLabels?.length ? `Accepts ${slot.acceptedLabels.join(", ")}` : "Ready for content";
              const status = slot.count ? `${slot.count}${slot.max ? ` / ${slot.max}` : ""} used` : "Empty";
              return (
                <Button
                  key={slot.id}
                  aria-label={`${slot.label} slot, ${slot.count ? `${slot.count} used` : "empty"}`}
                  className="group flex min-h-14 w-full items-center justify-start gap-3 rounded-none border-t border-white/10 px-4 text-left first:border-t-0 hover:bg-white/[0.025]"
                  isDisabled={!props.onSelectSlot}
                  variant="ghost"
                  onPress={() => props.onSelectSlot?.(slot)}
                >
                  <CircleDot size={14} className={slot.count ? "text-emerald-400" : "text-zinc-600"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs text-zinc-200">
                      <span className="truncate">{slot.label}</span>
                      {slot.min ? <span className="text-[8px] text-zinc-600">Required</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{detail}</span>
                  </span>
                  <span className={`shrink-0 text-[9px] ${slot.count ? "text-emerald-400" : "text-zinc-600"}`}>{status}</span>
                  {!slot.count && !full && <Plus size={14} className="text-sky-300" />}
                </Button>
              );
            })}
          </div>
        </ToolPanel>
      )}

      {tailwindControls.length > 0 && (
        <ToolPanel desktop={desktop} id="classes">
          <ToolHeading description="One field with project IntelliSense" strictUi title="Classes" />
          <TailwindTargetPicker controls={tailwindControls} selectedProp={selectedTailwindControl?.prop ?? ""} onChange={setSelectedTailwindProp} />
          <div className="px-4 py-4">
            {selectedTailwindControl && (
              <TailwindClassField
                compileError={props.compileError}
                label={selectedTailwindControl.label}
                value={tailwindValue}
                onChange={(value) => props.onControlChange(selectedTailwindControl.prop, value)}
              />
            )}
          </div>
        </ToolPanel>
      )}
    </Tabs>
  );
}

function ToolPanel(props: { desktop: boolean; id: ToolId; children: React.ReactNode }) {
  return (
    <Tabs.Panel
      id={props.id}
      className={`${props.desktop ? "!ml-12 !mt-0 !mr-0 !mb-0" : "!m-0"} h-full min-h-0 overflow-y-auto overscroll-contain bg-[#141518] !p-0 outline-none`}
    >
      {props.children}
    </Tabs.Panel>
  );
}

function ToolHeading(props: { title: string; description: string; strictUi?: boolean }) {
  return (
    <div className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#141518] px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-zinc-200">{props.title}</span>
        <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{props.description}</span>
      </span>
      {props.strictUi && (
        <Tooltip delay={350}>
          <span className="flex shrink-0 items-center gap-1 text-[9px] text-emerald-400/80">
            <ShieldCheck size={12} /> Strict UI
          </span>
          <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[9px] text-zinc-200 shadow-xl">Only controls that map deterministically to Tailwind CSS</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}

function TailwindTargetPicker(props: {
  controls: readonly ComponentControl[];
  selectedProp: string;
  onChange: (prop: string) => void;
}) {
  if (props.controls.length < 2) return null;
  return (
    <div className="border-b border-white/10 px-4 py-3">
      <EditorSelectField
        ariaLabel="Tailwind property"
        density="compact"
        label="Style property"
        options={props.controls.map((control) => ({ id: control.id, label: control.label, value: control.prop }))}
        value={props.selectedProp}
        onChange={props.onChange}
      />
    </div>
  );
}

function PropertyGroup(props: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-white/10">
      <Button
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-start gap-2 rounded-none px-4 text-left text-[10px] font-medium text-zinc-400 hover:bg-white/[0.02]"
        variant="ghost"
        onPress={() => setOpen((value) => !value)}
      >
        <span className="flex-1">{props.title}</span>
        <ChevronDown size={13} className={`text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && <div className="space-y-4 px-4 pb-4">{props.children}</div>}
    </section>
  );
}

function groupControls(controls: readonly ComponentControl[]) {
  const result: Record<string, ComponentControl[]> = { content: [], layout: [], style: [], behavior: [], advanced: [] };
  for (const control of controls) result[control.section ?? "content"].push(control);
  return result;
}

function sectionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
