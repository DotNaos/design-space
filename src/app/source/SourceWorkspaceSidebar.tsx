import { Button } from "@heroui/react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  CodeXml,
  Component,
  FileCode2,
  GitBranch,
  LayoutTemplate,
  Monitor,
  PanelTop,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  designSpaceDevices,
  type DesignSpaceDevice,
  type RuntimeSourceWorkspace,
} from "../../shared/source-workspace";
import {
  sourceTreeNodes,
  sourceTreeRows,
  type SourceImplementation,
  type SourceTreeRow,
  type SourceTreeNode,
  type SourceTreeSelection,
  visibleSourceTreeRows,
} from "./source-workspace-tree";

export type SourceWorkspaceSelection = SourceTreeSelection;

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
  const device = props.selected?.device ?? "desktop";
  const rows = useMemo(
    () => sourceTreeRows(sourceTreeNodes(props.workspace), device),
    [device, props.workspace],
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => defaultCollapsedRows(rows));

  useEffect(() => {
    setCollapsed(defaultCollapsedRows(rows));
  }, [rows]);

  const visibleRows = visibleSourceTreeRows(rows, collapsed);
  const toggleBranch = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return (
    <aside
      aria-label="Source workspace"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">App tree</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            {props.workspace.sourceRoot} · {props.workspace.runtime === "react-native" ? "React Native" : "React"}
          </p>
        </div>
        <GitBranch aria-label="Static source composition" className="text-zinc-600" size={14} />
      </header>

      <div aria-label="App source tree" className="min-h-0 flex-1 overflow-y-auto py-2" role="tree">
        {visibleRows.map((row) => (
          <SourceNodeRow
            key={row.key}
            active={row.layer?.kind === "html"
              ? props.selected?.nodeId === row.selectionNode.id && props.selected.layerId === row.layer.id
              : Boolean(row.node && props.selected?.nodeId === row.node.id && !props.selected.layerId)}
            collapsed={collapsed.has(row.key)}
            row={row}
            onPress={() => props.onSelect({
              nodeId: row.selectionNode.id,
              device,
              ...(row.layer?.kind === "html" ? { layerId: row.layer.id } : {}),
            })}
            onToggle={() => toggleBranch(row.key)}
          />
        ))}
        {!rows.length && <p className="px-4 py-3 text-[10px] leading-4 text-zinc-700">No exported app tree was found.</p>}
      </div>
    </aside>
  );
}

function SourceNodeRow(props: {
  active: boolean;
  collapsed: boolean;
  row: SourceTreeRow;
  onPress: () => void;
  onToggle: () => void;
}) {
  const { row } = props;
  const NodeIcon = row.node
    ? row.node.area === "layout"
      ? LayoutTemplate
      : row.node.area === "pages"
        ? PanelTop
        : Component
    : row.layer?.kind === "html"
      ? CodeXml
      : row.layer?.kind === "fragment"
        ? Braces
        : Component;
  const label = row.node?.label ?? (row.layer?.kind === "html" ? `<${row.layer.label}>` : row.layer?.label ?? "Layer");
  return (
    <div
      aria-expanded={row.hasChildren ? !props.collapsed : undefined}
      aria-label={label}
      aria-level={row.depth + 1}
      aria-selected={props.active}
      className="relative flex min-h-10 items-center pr-2"
      role="treeitem"
      style={{ paddingLeft: 4 + row.depth * 18 }}
    >
      {row.depth > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 top-0 border-l border-white/[0.07]"
          style={{ left: 18 + (row.depth - 1) * 18 }}
        />
      )}
      {row.hasChildren ? (
        <Button
          aria-label={`${props.collapsed ? "Expand" : "Collapse"} ${label}`}
          className="relative z-10 grid size-6 shrink-0 place-items-center rounded text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300"
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={props.onToggle}
        >
          {props.collapsed ? <ChevronRight aria-hidden="true" size={12} /> : <ChevronDown aria-hidden="true" size={12} />}
        </Button>
      ) : <span aria-hidden="true" className="size-6 shrink-0" />}
      <Button
        aria-label={label}
        aria-pressed={props.active}
        className={`group min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-1.5 text-left ${props.active ? "bg-sky-500/15 text-sky-100" : row.layer ? "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
        fullWidth
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        <NodeIcon aria-hidden="true" className="shrink-0" size={13} />
        <span className={`min-w-0 flex-1 truncate text-xs ${row.layer?.kind === "html" ? "font-mono text-[10px]" : ""}`}>{label}</span>
        {row.node && <MissingDeviceCluster implementations={row.node.implementations} />}
      </Button>
    </div>
  );
}

function defaultCollapsedRows(rows: readonly SourceTreeRow[]): ReadonlySet<string> {
  return new Set(rows.filter((row) => (
    row.hasChildren && row.depth > 0 && (row.node || row.layer?.kind === "component")
  )).map((row) => row.key));
}

function MissingDeviceCluster(props: { implementations: SourceTreeNode["implementations"] }) {
  const missing = designSpaceDevices.filter((device) => {
    const state = props.implementations[device].state;
    return state === "missing" || state === "fallback";
  });
  if (!missing.length) return null;
  const label = missing.map((device) => implementationLabel(props.implementations[device])).join("; ");
  return (
    <span aria-label={label} className="ml-1 flex shrink-0 items-center gap-1 text-zinc-600" role="img">
      {missing.map((device) => (
        <MissingDeviceIcon key={device} device={device} implementation={props.implementations[device]} />
      ))}
    </span>
  );
}

function MissingDeviceIcon(props: { device: DesignSpaceDevice; implementation: SourceImplementation }) {
  const DeviceIcon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  return (
    <span className="relative grid size-4 place-items-center" title={implementationLabel(props.implementation)}>
      <DeviceIcon aria-hidden="true" size={12} strokeWidth={1.8} />
      <span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" />
    </span>
  );
}

function implementationLabel(implementation: SourceImplementation): string {
  const label = deviceLabels[implementation.requestedDevice];
  if (implementation.state === "fallback") {
    return `${label} has no dedicated implementation and uses ${implementation.sourceDevice ? deviceLabels[implementation.sourceDevice] : "a fallback"}`;
  }
  return `${label} implementation missing`;
}
