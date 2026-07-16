import { useState } from "react";
import { Button } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Component,
  FileCode2,
  FolderOpen,
  LayoutTemplate,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

import {
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

const deviceLabels: Record<DesignSpaceDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setCollapsed((current) => toggledSet(current, key));

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
        {designSpaceDevices.map((device) => (
          <AppDeviceBranch
            key={device}
            collapsed={collapsed.has(`app:${device}`)}
            device={device}
            selected={props.selected}
            workspace={props.workspace}
            onSelect={props.onSelect}
            onToggle={() => toggle(`app:${device}`)}
          />
        ))}
        <ComponentList
          collapsed={collapsed.has("components")}
          selected={props.selected}
          workspace={props.workspace}
          onSelect={props.onSelect}
          onToggle={() => toggle("components")}
        />
      </div>
    </aside>
  );
}

function AppDeviceBranch(props: {
  collapsed: boolean;
  device: DesignSpaceDevice;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onToggle: () => void;
}) {
  const label = deviceLabels[props.device];
  const DeviceIcon = deviceIcon(props.device);
  const layoutState = stateFor(props.workspace, "layout", props.device);
  const pageState = stateFor(props.workspace, "pages", props.device);
  const layouts = layoutState ? entriesForState(props.workspace, layoutState) : [];
  const pages = pageState ? entriesForState(props.workspace, pageState) : [];

  return (
    <section aria-label={`${label} app`}>
      <Button
        aria-expanded={!props.collapsed}
        className="min-h-10 w-full justify-start gap-2 rounded-none px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]"
        fullWidth
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        {props.collapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
        <DeviceIcon aria-hidden="true" className="shrink-0 text-zinc-500" size={15} />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {layoutState && <DeviceStateLabel state={layoutState} />}
      </Button>

      {!props.collapsed && (
        <div className="pb-2 pl-5 pr-2">
          <p className="truncate px-3 text-[9px] leading-4 text-zinc-700">{props.workspace.sourceRoot}/{props.device}</p>
          <EntryList
            device={props.device}
            emptyLabel="Layout not configured."
            entries={layouts}
            icon="layout"
            selected={props.selected}
            onSelect={props.onSelect}
          />
          <div aria-label={`Pages ${label}`} className="mt-1">
            <div className="flex min-h-8 items-center gap-2 px-3 text-[11px] text-zinc-400">
              <FolderOpen aria-hidden="true" className="text-zinc-600" size={13} />
              <span className="flex-1">Pages</span>
              {pageState && <DeviceStateLabel state={pageState} />}
            </div>
            <p className="truncate px-8 text-[9px] leading-4 text-zinc-700">{pageState?.path ?? `${props.workspace.sourceRoot}/${props.device}/pages`}</p>
            <div className="pl-4">
              <EntryList
                device={props.device}
                emptyLabel="No pages found."
                entries={pages}
                icon="file"
                selected={props.selected}
                onSelect={props.onSelect}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EntryList(props: {
  device: DesignSpaceDevice;
  emptyLabel: string;
  entries: readonly RuntimeSourceWorkspaceEntry[];
  icon: "file" | "layout";
  selected?: SourceWorkspaceSelection;
  onSelect: (selection: SourceWorkspaceSelection) => void;
}) {
  if (!props.entries.length) return <p className="px-3 py-1 text-[10px] leading-4 text-zinc-700">{props.emptyLabel}</p>;
  const EntryIcon = props.icon === "layout" ? LayoutTemplate : FileCode2;
  const label = deviceLabels[props.device];
  return (
    <div className="py-1" role="list">
      {props.entries.map((entry) => {
        const active = props.selected?.entryId === entry.id && props.selected.device === props.device;
        return (
          <Button
            key={entry.id}
            aria-label={`${entry.label} for ${label}`}
            aria-pressed={active}
            className={`min-h-9 w-full justify-start gap-2 rounded-lg px-3 text-left ${active ? "bg-sky-500/15 text-sky-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
            fullWidth
            size="sm"
            variant="ghost"
            onPress={() => props.onSelect({ device: props.device, entryId: entry.id })}
          >
            <EntryIcon aria-hidden="true" className="shrink-0" size={13} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs">{entry.label}</span>
              <span className="block truncate text-[9px] text-zinc-600">{entry.relativePath}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function ComponentList(props: {
  collapsed: boolean;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onToggle: () => void;
}) {
  const groups = componentGroups(props.workspace);
  return (
    <section aria-label="Components source" className="border-t border-white/[0.06] pt-1">
      <Button
        aria-expanded={!props.collapsed}
        className="min-h-10 w-full justify-start gap-2 rounded-none px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]"
        fullWidth
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        {props.collapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
        <Component aria-hidden="true" className="shrink-0 text-zinc-500" size={15} />
        <span className="min-w-0 flex-1 truncate text-left">Components</span>
        <span className="text-[9px] text-zinc-600">{groups.length}</span>
      </Button>
      {!props.collapsed && (
        <div className="space-y-1 px-2 pb-2 pl-5">
          {groups.map((group) => (
            <ComponentImplementations
              key={group.key}
              entries={group.entries}
              label={group.label}
              selected={props.selected}
              workspace={props.workspace}
              onSelect={props.onSelect}
            />
          ))}
          {!groups.length && <p className="px-3 py-2 text-[10px] leading-4 text-zinc-700">No components found.</p>}
        </div>
      )}
    </section>
  );
}

function ComponentImplementations(props: {
  entries: readonly RuntimeSourceWorkspaceEntry[];
  label: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onSelect: (selection: SourceWorkspaceSelection) => void;
}) {
  const activeEntry = props.entries.find((entry) => entry.id === props.selected?.entryId);
  const selectedPath = activeEntry?.relativePath ?? props.entries[0]?.relativePath;
  return (
    <section aria-label={`Component ${props.label}`} className="rounded-lg px-2 py-2 hover:bg-white/[0.025]">
      <div className="flex items-center gap-2">
        <Component aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">{props.label}</span>
      </div>
      <div aria-label={`${props.label} implementations`} className="mt-2 grid grid-cols-3 gap-1">
        {designSpaceDevices.map((device) => {
          const implementation = componentImplementation(props.workspace, props.entries, device);
          const active = props.selected?.device === device && Boolean(activeEntry);
          const fallback = implementation && implementation.device !== device;
          return (
            <Button
              key={device}
              aria-label={`${props.label} ${deviceLabels[device]} implementation${fallback ? `, uses ${deviceLabels[implementation.device]}` : ""}`}
              aria-pressed={active}
              className={`min-h-7 min-w-0 rounded-md px-1 text-[9px] ${active ? "bg-sky-500/20 text-sky-100" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"}`}
              isDisabled={!implementation}
              size="sm"
              variant="ghost"
              onPress={() => implementation && props.onSelect({ device, entryId: implementation.entry.id })}
            >
              {deviceLabels[device]}
              {fallback && <span aria-hidden="true" className="text-amber-300">↗</span>}
            </Button>
          );
        })}
      </div>
      {selectedPath && <p className="mt-1 truncate text-[9px] leading-4 text-zinc-700" title={selectedPath}>{selectedPath}</p>}
    </section>
  );
}

function DeviceStateLabel(props: { state: SourceWorkspaceDeviceState }) {
  if (props.state.state === "configured") return <span className="text-[9px] font-medium text-emerald-400">Configured</span>;
  if (props.state.state === "fallback") {
    return <span className="text-[9px] font-medium text-amber-300">Uses {props.state.fallback ? deviceLabels[props.state.fallback] : "fallback"}</span>;
  }
  return <span className="text-[9px] text-zinc-700">Not configured</span>;
}

function stateFor(workspace: RuntimeSourceWorkspace, area: DesignSpaceArea, device: DesignSpaceDevice) {
  return workspace.devices.find((state) => state.area === area && state.device === device);
}

function entriesForState(workspace: RuntimeSourceWorkspace, state: SourceWorkspaceDeviceState) {
  const sourceDevice = state.state === "fallback" ? state.fallback : state.device;
  if (!sourceDevice) return [];
  return workspace.entries.filter((entry) => entry.area === state.area && entry.device === sourceDevice);
}

function componentGroups(workspace: RuntimeSourceWorkspace) {
  const groups = new Map<string, { key: string; label: string; entries: RuntimeSourceWorkspaceEntry[] }>();
  for (const entry of workspace.entries.filter((candidate) => candidate.area === "components")) {
    const folder = /^src\/app\/components\/([^/]+)\//.exec(entry.relativePath)?.[1] ?? entry.label;
    const key = `${folder}:${entry.exportName}`;
    const group = groups.get(key) ?? { key, label: entry.label, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label, "en"));
}

function componentImplementation(
  workspace: RuntimeSourceWorkspace,
  entries: readonly RuntimeSourceWorkspaceEntry[],
  requested: DesignSpaceDevice,
): { device: DesignSpaceDevice; entry: RuntimeSourceWorkspaceEntry } | undefined {
  const direct = entries.find((entry) => entry.device === requested);
  if (direct) return { device: requested, entry: direct };
  const state = stateFor(workspace, "components", requested);
  if (state?.state !== "fallback" || !state.fallback) return undefined;
  const entry = entries.find((candidate) => candidate.device === state.fallback);
  return entry ? { device: state.fallback, entry } : undefined;
}

function deviceIcon(device: DesignSpaceDevice) {
  return device === "desktop" ? Monitor : device === "tablet" ? Tablet : Smartphone;
}

function toggledSet<Value>(current: ReadonlySet<Value>, value: Value): ReadonlySet<Value> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
