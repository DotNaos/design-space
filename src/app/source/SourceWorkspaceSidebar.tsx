import { useState } from "react";
import { Button } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  Component,
  CornerUpRight,
  FileCode2,
  FolderOpen,
  Layers3,
  LayoutTemplate,
  Monitor,
  Smartphone,
  Tablet,
  Link2,
} from "lucide-react";

import {
  designSpaceDevices,
  type DesignSpaceArea,
  type DesignSpaceDevice,
  type RuntimeSourceWorkspace,
} from "../../shared/source-workspace";
import {
  sourceTreeNodes,
  type SourceImplementation,
  type SourceTreeNode,
  type SourceTreeSelection,
} from "./source-workspace-tree";

export type SourceWorkspaceSelection = SourceTreeSelection;

export interface SourceWorkspaceSidebarProps {
  className?: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onSelect: (selection: SourceWorkspaceSelection) => void;
}

const areaLabels: Record<DesignSpaceArea, string> = {
  layout: "Layout",
  pages: "Pages",
  components: "Components",
};

const areaIcons = {
  layout: LayoutTemplate,
  pages: FolderOpen,
  components: Component,
} as const;

const deviceLabels: Record<DesignSpaceDevice, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<DesignSpaceArea>>(new Set());
  const nodes = sourceTreeNodes(props.workspace);

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
        <span aria-label="Device status is shown on every source item" className="text-zinc-600" title="Desktop, Tablet, and Mobile status">
          <Layers3 aria-hidden="true" size={14} />
        </span>
      </header>

      <div aria-label="App source tree" className="min-h-0 flex-1 overflow-y-auto py-2" role="tree">
        {(["layout", "pages", "components"] as const).map((area) => (
          <SourceAreaBranch
            key={area}
            area={area}
            collapsed={collapsed.has(area)}
            nodes={nodes.filter((node) => node.area === area)}
            selected={props.selected}
            onSelect={props.onSelect}
            onToggle={() => setCollapsed((current) => toggledSet(current, area))}
          />
        ))}
      </div>
    </aside>
  );
}

function SourceAreaBranch(props: {
  area: DesignSpaceArea;
  collapsed: boolean;
  nodes: readonly SourceTreeNode[];
  selected?: SourceWorkspaceSelection;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onToggle: () => void;
}) {
  const AreaIcon = areaIcons[props.area];
  return (
    <section aria-label={`${areaLabels[props.area]} source`} className="pb-1">
      <Button
        aria-expanded={!props.collapsed}
        className="min-h-9 w-full justify-start gap-2 rounded-none px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]"
        fullWidth
        size="sm"
        variant="ghost"
        onPress={props.onToggle}
      >
        {props.collapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
        <AreaIcon aria-hidden="true" className="shrink-0 text-zinc-500" size={14} />
        <span className="min-w-0 flex-1 truncate text-left">{areaLabels[props.area]}</span>
        <span className="text-[9px] tabular-nums text-zinc-700">{props.nodes.length}</span>
      </Button>

      {!props.collapsed && (
        <div className="ml-[18px] border-l border-white/[0.07] py-0.5 pl-2 pr-2" role="group">
          {props.nodes.map((node) => (
            <SourceNodeRow
              key={node.id}
              active={props.selected?.nodeId === node.id}
              node={node}
              requestedDevice={props.selected?.device ?? "desktop"}
              onPress={() => props.onSelect({ nodeId: node.id, device: props.selected?.device ?? "desktop" })}
            />
          ))}
          {!props.nodes.length && <p className="px-3 py-2 text-[10px] leading-4 text-zinc-700">No {areaLabels[props.area].toLowerCase()} found.</p>}
        </div>
      )}
    </section>
  );
}

function SourceNodeRow(props: {
  active: boolean;
  node: SourceTreeNode;
  requestedDevice: DesignSpaceDevice;
  onPress: () => void;
}) {
  const NodeIcon = props.node.area === "layout" ? LayoutTemplate : props.node.area === "components" ? Component : FileCode2;
  return (
    <Button
      aria-label={props.node.label}
      aria-pressed={props.active}
      className={`group min-h-9 w-full justify-start gap-2 rounded-lg px-2 text-left ${props.active ? "bg-sky-500/15 text-sky-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
      fullWidth
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      <NodeIcon aria-hidden="true" className="shrink-0" size={13} />
      <span className="min-w-0 flex-1 truncate text-xs">{props.node.label}</span>
      <DeviceStatusCluster implementations={props.node.implementations} requestedDevice={props.requestedDevice} />
    </Button>
  );
}

function DeviceStatusCluster(props: {
  implementations: SourceTreeNode["implementations"];
  requestedDevice: DesignSpaceDevice;
}) {
  const label = designSpaceDevices.map((device) => implementationLabel(props.implementations[device])).join("; ");
  return (
    <span aria-label={label} className="ml-1 flex shrink-0 items-center gap-1" role="img">
      {designSpaceDevices.map((device) => (
        <DeviceStatusIcon
          key={device}
          current={device === props.requestedDevice}
          device={device}
          implementation={props.implementations[device]}
        />
      ))}
    </span>
  );
}

function DeviceStatusIcon(props: {
  current: boolean;
  device: DesignSpaceDevice;
  implementation: SourceImplementation;
}) {
  const DeviceIcon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  const tone = props.implementation.state === "fallback"
    ? "text-amber-300"
    : props.implementation.state === "missing"
      ? "text-zinc-700"
      : props.implementation.state === "responsive"
        ? props.current ? "text-cyan-300" : "text-cyan-400/70"
      : props.current
        ? "text-sky-300"
        : "text-zinc-300";
  return (
    <span className={`relative grid size-4 place-items-center ${tone}`} title={implementationLabel(props.implementation)}>
      <DeviceIcon aria-hidden="true" size={12} strokeWidth={1.8} />
      {props.implementation.state === "fallback" && (
        <CornerUpRight aria-hidden="true" className="absolute -right-1 -top-1 rounded-sm bg-[#141518]" size={7} strokeWidth={2.4} />
      )}
      {props.implementation.state === "missing" && (
        <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />
      )}
      {props.implementation.state === "responsive" && (
        <Link2 aria-hidden="true" className="absolute -right-1 -top-1 rounded-sm bg-[#141518]" size={6} strokeWidth={2.2} />
      )}
    </span>
  );
}

function implementationLabel(implementation: SourceImplementation): string {
  const label = deviceLabels[implementation.requestedDevice];
  if (implementation.state === "direct") return `${label} implemented`;
  if (implementation.state === "fallback") return `${label} uses ${implementation.sourceDevice ? deviceLabels[implementation.sourceDevice] : "fallback"}`;
  if (implementation.state === "responsive") return `${label} uses the declared responsive implementation`;
  return `${label} missing`;
}

function toggledSet<Value>(current: ReadonlySet<Value>, value: Value): ReadonlySet<Value> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
