import { Button } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  CodeXml,
  Component,
  FileCode2,
  FilePlus2,
  Monitor,
  PanelTop,
  Smartphone,
  Tablet,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import { designSpaceDevices, type DesignSpaceDevice, type RuntimeSourceWorkspace, type SourceWorkspaceLayer } from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceComponentPicker } from "./SourceComponentPicker";
import { SourceDesignStatus } from "./SourceDesignStatus";
import {
  initialFocusOccurrence,
  initiallyCollapsedSourceBranches,
  sourceCompositionRows,
  sourceFocusGraph,
  type SourceFocusGraph,
  type SourceFocusRow,
  type SourceOccurrence,
  visibleSourceCompositionRows,
} from "./source-focus-tree";
import { sourceSlotCandidates, type SourceComponentCandidate } from "./source-slot-composition";
import { sourceTreeNodes, type SourceImplementation, type SourceTreeNode, type SourceTreeSelection } from "./source-workspace-tree";

export interface SourceWorkspaceSelection extends SourceTreeSelection {
  occurrenceId?: string;
  sourceNodeId?: string;
  slotName?: string;
  kind?: "component" | "html" | "slot";
}

export interface SourceWorkspaceSidebarProps {
  className?: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  focusId?: string;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onFocus: (occurrenceId: string, selection: SourceWorkspaceSelection) => void;
  onApplySlot: (
    slot: SourceWorkspaceLayer,
    occurrence: SourceOccurrence,
    candidate: SourceComponentCandidate,
    action: "add" | "replace",
  ) => void;
  editingSourceOwnerId?: string;
  slotEditorReady?: boolean;
  onPrepareSlotEdit?: (occurrence: SourceOccurrence) => void;
  onCreateComponent?: () => void;
}

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const device = props.selected?.device ?? "desktop";
  const nodes = useMemo(() => sourceTreeNodes(props.workspace), [props.workspace]);
  const graph = useMemo(() => sourceFocusGraph(nodes, device), [device, nodes]);
  const definitionSelected = props.selected?.kind === "component" && !props.selected.occurrenceId;
  const focusId = definitionSelected
    ? undefined
    : graph.occurrences.has(props.focusId ?? "") ? props.focusId! : initialFocusOccurrence(graph);
  const rows = useMemo(() => sourceCompositionRows(graph, focusId), [focusId, graph]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => initiallyCollapsedSourceBranches(rows, focusId));
  const visibleRows = useMemo(() => visibleSourceCompositionRows(rows, collapsed), [collapsed, rows]);
  const toggleBranch = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return (
    <aside aria-label="Source workspace" className={`${props.className ?? "flex w-80"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <FileCode2 aria-hidden="true" className="text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">Source tree</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-zinc-600">{props.workspace.sourceRoot} · {props.workspace.runtime === "react-native" ? "React Native" : "React"}</p>
        </div>
        {props.workspace.capabilities?.createComponents && props.onCreateComponent && (
          <Button aria-label="Create component" className="grid size-8 place-items-center rounded-md text-zinc-500" isIconOnly size="sm" variant="ghost" onPress={props.onCreateComponent}>
            <FilePlus2 aria-hidden="true" size={14} />
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div aria-label="Source tree" role="tree">
          {visibleRows.map((row) => (
            <FocusTreeRow
              key={`${row.key}:${row.depth}`}
              collapsed={collapsed.has(row.key)}
              device={device}
              graph={graph}
              nodes={nodes}
              row={row}
              selected={props.selected}
              workspace={props.workspace}
              onApplySlot={props.onApplySlot}
              editingSourceOwnerId={props.editingSourceOwnerId}
              slotEditorReady={props.slotEditorReady}
              onPrepareSlotEdit={props.onPrepareSlotEdit}
              onFocus={props.onFocus}
              onSelect={props.onSelect}
              onToggleBranch={toggleBranch}
            />
          ))}
          {!rows.length && <p className="px-4 py-4 text-[10px] text-zinc-600">No configured entry component was found.</p>}
        </div>
      </div>
    </aside>
  );
}

function FocusTreeRow(props: {
  device: DesignSpaceDevice;
  collapsed: boolean;
  graph: SourceFocusGraph;
  nodes: ReturnType<typeof sourceTreeNodes>;
  row: SourceFocusRow;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onApplySlot: SourceWorkspaceSidebarProps["onApplySlot"];
  editingSourceOwnerId?: string;
  slotEditorReady?: boolean;
  onPrepareSlotEdit?: SourceWorkspaceSidebarProps["onPrepareSlotEdit"];
  onFocus: SourceWorkspaceSidebarProps["onFocus"];
  onSelect: SourceWorkspaceSidebarProps["onSelect"];
  onToggleBranch: (key: string) => void;
}) {
  const { row } = props;
  const occurrenceRow = row.kind === "component" && !row.layer;
  const focusTarget = row.targetOccurrence ?? (occurrenceRow ? row.occurrence : undefined);
  const active = occurrenceRow
    ? props.selected?.occurrenceId === row.occurrence?.id && props.selected?.kind === "component"
    : props.selected?.occurrenceId === row.occurrence?.id && props.selected?.kind === row.kind && (
      props.selected?.layerId === row.layer?.id
      || (row.kind === "slot" && props.selected?.slotName === row.layer?.label)
    );
  const Icon = row.kind === "component" ? Component : row.kind === "html" ? CodeXml : PanelTop;
  const slot = row.kind === "slot" ? row.layer : undefined;
  const status = slot?.slot;
  const sourceOwnerId = row.sourceOwnerId ?? row.occurrence?.usageOwnerId;
  const sourceOwner = sourceOwnerId
    ? props.nodes.find((node) => node.id === sourceOwnerId)
    : row.occurrence?.node;
  const ownerPath = sourceOwner?.implementations[props.device].entry?.relativePath ?? row.occurrence?.entry?.relativePath ?? "";
  const candidates = slot ? sourceSlotCandidates(props.workspace, props.nodes, slot, props.device, ownerPath) : [];
  const triggerId = slot ? `source-slot-picker-${safeId(slot.id)}` : undefined;
  const componentEntry = occurrenceRow ? row.occurrence?.entry : undefined;
  const select = () => {
    if (focusTarget) {
      props.onFocus(focusTarget.id, {
        nodeId: focusTarget.node.id,
        device: props.device,
        occurrenceId: focusTarget.id,
        kind: "component",
      });
      return;
    }
    if (row.layer && row.occurrence) {
      props.onSelect({
        nodeId: row.occurrence.node.id,
        sourceNodeId: row.sourceOwnerId ?? (row.kind === "slot" ? row.occurrence.usageOwnerId : row.occurrence.node.id),
        device: props.device,
        occurrenceId: row.occurrence.id,
        layerId: row.layer.id,
        ...(row.kind === "slot" ? { slotName: row.layer.label } : {}),
        kind: row.kind,
      });
    }
  };
  return (
    <div aria-label={row.label} className="relative flex min-h-10 items-center pr-2 transition-[padding,opacity,transform] duration-150 ease-out motion-reduce:transition-none" role="treeitem" aria-level={row.depth + 1} aria-selected={active} style={{ paddingLeft: 8 + row.depth * 18 }}>
      {row.depth > 0 && <span aria-hidden="true" className="absolute bottom-0 top-0 border-l border-white/[0.07]" style={{ left: 20 + (row.depth - 1) * 18 }} />}
      {row.collapsible ? (
        <Button
          isIconOnly
          aria-expanded={!props.collapsed}
          aria-label={`${props.collapsed ? "Expand" : "Collapse"} ${row.label}`}
          className="relative z-10 size-6 min-w-6 shrink-0 rounded text-zinc-700 hover:bg-white/[0.06] hover:text-zinc-300"
          size="sm"
          variant="ghost"
          onPress={() => props.onToggleBranch(row.key)}
        >
          {props.collapsed ? <ChevronRight aria-hidden="true" size={11} /> : <ChevronDown aria-hidden="true" size={11} />}
        </Button>
      ) : <span aria-hidden="true" className="size-6 shrink-0" />}
      <Button
        aria-label={`${row.label}${row.role === "focus" ? ", focused" : ""}`}
        className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-1.5 text-left ${active ? "bg-sky-500/15 text-sky-100" : row.role === "focus" ? "text-zinc-200" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`}
        fullWidth
        size="sm"
        variant="ghost"
        onKeyDown={(event) => {
          if (event.key === "Enter" && triggerId && active) {
            event.preventDefault();
            document.getElementById(triggerId)?.click();
          }
        }}
        onPress={select}
      >
        <Icon aria-hidden="true" className="shrink-0" size={13} />
        <span className={`min-w-0 flex-1 truncate text-xs ${row.kind === "html" ? "font-mono text-[10px]" : ""}`}>{row.label}</span>
        {row.role === "focus" && <CircleDot aria-label="Selected component" className="shrink-0 text-sky-400" size={11} />}
        {row.kind === "component" && row.occurrence && <MissingDeviceCluster implementations={row.occurrence.node.implementations} />}
        {status && <SlotStatus layer={slot!} />}
      </Button>
      {componentEntry && !componentEntry.design ? (
        <SourceDesignStatus
          designPath={suggestedSourceDesignPath(componentEntry, props.workspace.entries)}
          label={componentEntry.label}
        />
      ) : null}
      {slot && row.occurrence && (
        <SourceComponentPicker
          candidates={candidates}
          isBusy={props.editingSourceOwnerId === sourceOwnerId && props.slotEditorReady === false}
          slot={slot}
          triggerId={triggerId}
          onOpen={() => props.onPrepareSlotEdit?.(row.occurrence!)}
          onApply={(candidate, action) => props.onApplySlot(slot, row.occurrence!, candidate, action)}
        />
      )}
    </div>
  );
}

function SlotStatus({ layer }: { layer: SourceWorkspaceLayer }) {
  const usage = layer.slot!;
  const max = usage.contract.max ?? "∞";
  const warning = usage.validity === "missing" || usage.validity === "incompatible";
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[9px] tabular-nums ${warning ? "text-amber-300" : "text-zinc-600"}`}>
      {warning && <TriangleAlert aria-hidden="true" size={10} />}
      {usage.received.length}/{max}
      <span className="sr-only">{usage.validity}</span>
    </span>
  );
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function MissingDeviceCluster(props: { implementations: SourceTreeNode["implementations"] }) {
  const missing = designSpaceDevices.filter((device) => ["missing", "fallback"].includes(props.implementations[device].state));
  if (!missing.length) return null;
  return (
    <span aria-label={missing.map((device) => implementationLabel(props.implementations[device])).join("; ")} className="flex shrink-0 items-center gap-0.5 text-zinc-600" role="img">
      {missing.map((device) => <MissingDeviceIcon key={device} device={device} implementation={props.implementations[device]} />)}
    </span>
  );
}

function MissingDeviceIcon(props: { device: DesignSpaceDevice; implementation: SourceImplementation }) {
  const Icon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  return <span className="relative grid size-4 place-items-center"><Icon aria-hidden="true" size={11} /><span aria-hidden="true" className="absolute h-px w-3 -rotate-45 bg-current" /></span>;
}

function implementationLabel(implementation: SourceImplementation): string {
  const labels: Record<DesignSpaceDevice, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
  return implementation.state === "fallback"
    ? `${labels[implementation.requestedDevice]} uses ${implementation.sourceDevice ? labels[implementation.sourceDevice] : "a fallback"}`
    : `${labels[implementation.requestedDevice]} implementation missing`;
}
