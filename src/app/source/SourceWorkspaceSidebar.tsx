import { useState } from "react";
import { Button } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Component,
  FileCode2,
  Monitor,
  PanelsTopLeft,
  Smartphone,
  Tablet,
} from "lucide-react";

import {
  designSpaceAreas,
  designSpaceDevices,
  type DesignSpaceArea,
  type DesignSpaceDevice,
  type RuntimeSourceWorkspace,
  type RuntimeSourceWorkspaceEntry,
  type SourceWorkspaceDeviceState,
} from "../../shared/source-workspace";

export interface SourceWorkspaceSelection {
  device: DesignSpaceDevice;
  entryId: string;
}

export interface SourceWorkspaceSidebarProps {
  className?: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onSelect: (selection: SourceWorkspaceSelection) => void;
}

const areaLabels: Record<DesignSpaceArea, string> = {
  root: "Root",
  pages: "Pages",
  components: "Components",
};

const deviceLabels: Record<DesignSpaceDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const [collapsedAreas, setCollapsedAreas] = useState<ReadonlySet<DesignSpaceArea>>(new Set());
  const [collapsedDevices, setCollapsedDevices] = useState<ReadonlySet<string>>(new Set());

  const toggleArea = (area: DesignSpaceArea) => {
    setCollapsedAreas((current) => toggledSet(current, area));
  };
  const toggleDevice = (state: SourceWorkspaceDeviceState) => {
    setCollapsedDevices((current) => toggledSet(current, deviceKey(state)));
  };

  return (
    <aside
      aria-label="Source workspace"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">App source</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            {props.workspace.sourceRoot} · {props.workspace.runtime === "react-native" ? "React Native" : "React"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {designSpaceAreas.map((area) => {
          const states = orderedDeviceStates(props.workspace, area);
          const collapsed = collapsedAreas.has(area);
          const AreaIcon = area === "components" ? Component : PanelsTopLeft;
          return (
            <section key={area} aria-label={`${areaLabels[area]} source`}>
              <Button
                aria-expanded={!collapsed}
                className="min-h-10 w-full justify-start rounded-none px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]"
                fullWidth
                size="sm"
                variant="ghost"
                onPress={() => toggleArea(area)}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
                  size={13}
                />
                <AreaIcon aria-hidden="true" className="shrink-0 text-zinc-500" size={15} />
                <span className="min-w-0 flex-1 truncate text-left">{areaLabels[area]}</span>
              </Button>

              {!collapsed && (
                <div className="pb-1 pl-4">
                  {states.map((state) => (
                    <DeviceBranch
                      key={deviceKey(state)}
                      collapsed={collapsedDevices.has(deviceKey(state))}
                      entries={entriesForState(props.workspace, state)}
                      selected={props.selected}
                      state={state}
                      onSelect={props.onSelect}
                      onToggle={() => toggleDevice(state)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function DeviceBranch(props: {
  collapsed: boolean;
  entries: readonly RuntimeSourceWorkspaceEntry[];
  selected?: SourceWorkspaceSelection;
  state: SourceWorkspaceDeviceState;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onToggle: () => void;
}) {
  const label = deviceLabels[props.state.device];
  const DeviceIcon = props.state.device === "desktop" ? Monitor : props.state.device === "tablet" ? Tablet : Smartphone;
  const expandable = props.state.state !== "missing";
  const content = (
    <>
      {expandable ? (
        props.collapsed ? <ChevronRight aria-hidden="true" size={12} /> : <ChevronDown aria-hidden="true" size={12} />
      ) : <span aria-hidden="true" className="w-3" />}
      <DeviceIcon aria-hidden="true" className="shrink-0 text-zinc-500" size={14} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <DeviceStateLabel state={props.state} />
    </>
  );

  return (
    <section aria-label={`${areaLabels[props.state.area]} ${label}`}>
      {expandable ? (
        <Button
          aria-expanded={!props.collapsed}
          className="min-h-9 w-full justify-start gap-2 rounded-lg px-2 text-xs text-zinc-400 hover:bg-white/[0.04]"
          fullWidth
          size="sm"
          variant="ghost"
          onPress={props.onToggle}
        >
          {content}
        </Button>
      ) : (
        <div className="flex min-h-9 items-center gap-2 px-2 text-xs text-zinc-600">{content}</div>
      )}

      <p className="truncate px-8 text-[9px] leading-4 text-zinc-700" title={props.state.path}>{props.state.path}</p>
      {expandable && !props.collapsed && (
        <div className="py-1 pl-5" role="list">
          {props.entries.map((entry) => {
            const active = props.selected?.entryId === entry.id && props.selected.device === props.state.device;
            return (
              <Button
                key={entry.id}
                aria-label={`${entry.label} for ${label}`}
                aria-pressed={active}
                className={`min-h-9 w-full justify-start gap-2 rounded-lg px-2 text-left ${active ? "bg-sky-500/15 text-sky-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
                fullWidth
                size="sm"
                variant="ghost"
                onPress={() => props.onSelect({ device: props.state.device, entryId: entry.id })}
              >
                <FileCode2 aria-hidden="true" className="shrink-0" size={13} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{entry.label}</span>
                  <span className="block truncate text-[9px] text-zinc-600">{entry.relativePath}</span>
                </span>
              </Button>
            );
          })}
          {!props.entries.length && (
            <p className="px-2 py-1 text-[10px] leading-4 text-zinc-600">No exported components found.</p>
          )}
        </div>
      )}
    </section>
  );
}

function DeviceStateLabel(props: { state: SourceWorkspaceDeviceState }) {
  if (props.state.state === "configured") {
    return <span className="text-[9px] font-medium text-emerald-400">Configured</span>;
  }
  if (props.state.state === "fallback") {
    return (
      <span className="text-[9px] font-medium text-amber-300">
        Uses {props.state.fallback ? deviceLabels[props.state.fallback] : "fallback"}
      </span>
    );
  }
  return <span className="text-[9px] text-zinc-700">Not configured</span>;
}

function orderedDeviceStates(workspace: RuntimeSourceWorkspace, area: DesignSpaceArea) {
  return designSpaceDevices.flatMap((device) => {
    const state = workspace.devices.find((candidate) => candidate.area === area && candidate.device === device);
    return state ? [state] : [];
  });
}

function entriesForState(
  workspace: RuntimeSourceWorkspace,
  state: SourceWorkspaceDeviceState,
): readonly RuntimeSourceWorkspaceEntry[] {
  const sourceDevice = state.state === "fallback" ? state.fallback : state.device;
  if (!sourceDevice) return [];
  return workspace.entries.filter((entry) => entry.area === state.area && entry.device === sourceDevice);
}

function deviceKey(state: SourceWorkspaceDeviceState): string {
  return `${state.area}:${state.device}`;
}

function toggledSet<Value>(current: ReadonlySet<Value>, value: Value): ReadonlySet<Value> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
