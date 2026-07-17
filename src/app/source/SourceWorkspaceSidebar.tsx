import { Button, Checkbox } from "@heroui/react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CodeXml,
  Component,
  FileCode2,
  FilePlus2,
  Layers3,
  Monitor,
  PanelTop,
  Smartphone,
  Tablet,
  TriangleAlert,
} from "lucide-react";

import { designSpaceDevices, type DesignSpaceDevice, type RuntimeSourceWorkspace, type SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentPicker } from "./SourceComponentPicker";
import {
  initialFocusOccurrence,
  sourceFocusGraph,
  sourceFocusRows,
  type SourceExplorerMode,
  type SourceFocusGraph,
  type SourceFocusRow,
  type SourceOccurrence,
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
  mode: SourceExplorerMode;
  autoCollapse: boolean;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onFocus: (occurrenceId: string, selection: SourceWorkspaceSelection) => void;
  onModeChange: (mode: SourceExplorerMode) => void;
  onAutoCollapseChange: (autoCollapse: boolean) => void;
  onApplySlot: (
    slot: SourceWorkspaceLayer,
    occurrence: SourceOccurrence,
    candidate: SourceComponentCandidate,
    action: "add" | "replace",
  ) => void;
  onCreateComponent?: () => void;
}

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const device = props.selected?.device ?? "desktop";
  const nodes = sourceTreeNodes(props.workspace);
  const graph = sourceFocusGraph(nodes, device);
  const focusId = graph.occurrences.has(props.focusId ?? "") ? props.focusId! : initialFocusOccurrence(graph);
  const rows = focusId ? sourceFocusRows(graph, focusId, props.mode, props.autoCollapse) : [];
  const shared = nodes.filter((node) => node.area === "components");
  return (
    <aside aria-label="Source workspace" className={`${props.className ?? "flex w-80"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <FileCode2 aria-hidden="true" className="text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">Source tree</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-zinc-600">{props.workspace.sourceRoot} · {props.workspace.runtime === "react-native" ? "React Native" : "React"}</p>
        </div>
        <nav aria-label="Source tree views" className="flex items-center gap-0.5">
          <SecondaryModeButton
            active={props.mode === "overview"}
            icon={<Boxes size={14} />}
            label="Overview"
            onPress={() => props.onModeChange(props.mode === "overview" ? "focus" : "overview")}
          />
          <SecondaryModeButton
            active={props.mode === "layers"}
            icon={<Layers3 size={14} />}
            label="Layers"
            onPress={() => props.onModeChange(props.mode === "layers" ? "focus" : "layers")}
          />
        </nav>
        {props.workspace.capabilities?.createComponents && props.onCreateComponent && (
          <Button aria-label="Create component" className="grid size-8 place-items-center rounded-md text-zinc-500" isIconOnly size="sm" variant="ghost" onPress={props.onCreateComponent}>
            <FilePlus2 aria-hidden="true" size={14} />
          </Button>
        )}
      </header>
      {props.mode === "focus" && (
        <div className="flex h-9 shrink-0 items-center border-b border-white/[0.07] px-4">
          <Checkbox
            aria-label="Automatically collapse branches outside the current focus"
            className="text-zinc-500"
            isSelected={props.autoCollapse}
            onChange={props.onAutoCollapseChange}
          >
            <Checkbox.Content className="gap-2 text-[10px]">
              <Checkbox.Control className="size-3.5 rounded border border-white/15 bg-black/20">
                <Checkbox.Indicator />
              </Checkbox.Control>
              Collapse around focus
            </Checkbox.Content>
          </Checkbox>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div aria-label={props.mode === "overview" ? "Complete app overview" : props.mode === "layers" ? "Focused component layers" : "Focused source tree"} role="tree">
          {rows.map((row) => (
            <FocusTreeRow
              key={`${props.mode}:${row.key}:${row.depth}`}
              device={device}
              graph={graph}
              nodes={nodes}
              row={row}
              selected={props.selected}
              workspace={props.workspace}
              onApplySlot={props.onApplySlot}
              onFocus={props.onFocus}
              onSelect={props.onSelect}
            />
          ))}
          {!rows.length && <p className="px-4 py-4 text-[10px] text-zinc-600">No configured entry component was found.</p>}
        </div>
        {shared.length > 0 && props.mode === "overview" && (
          <section className="mt-4 border-t border-white/[0.07] pt-3">
            <h3 className="px-4 pb-1 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-600">Shared components</h3>
            <p className="px-4 pb-2 text-[9px] leading-4 text-zinc-700">Reusable definitions above the app shell.</p>
            {shared.map((node) => {
              const occurrence = [...graph.occurrences.values()].find((candidate) => candidate.node.id === node.id);
              return (
                <Button key={node.id} className="h-9 w-full justify-start gap-2 rounded-none px-4 text-xs text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200" fullWidth variant="ghost" onPress={() => {
                  if (occurrence) props.onFocus(occurrence.id, { nodeId: node.id, device, occurrenceId: occurrence.id, kind: "component" });
                  else props.onSelect({ nodeId: node.id, device, kind: "component" });
                }}>
                  <Component aria-hidden="true" size={13} /><span className="min-w-0 flex-1 truncate">{node.label}</span><MissingDeviceCluster implementations={node.implementations} />
                </Button>
              );
            })}
          </section>
        )}
      </div>
    </aside>
  );
}

function SecondaryModeButton(props: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Button
      aria-label={props.active ? `Return to focused source tree from ${props.label}` : `Open ${props.label.toLowerCase()} source tree`}
      aria-pressed={props.active}
      className={`grid size-8 min-w-0 place-items-center rounded-md p-0 ${props.active ? "bg-white/[0.08] text-sky-200" : "text-zinc-600 hover:text-zinc-300"}`}
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}
    </Button>
  );
}

function FocusTreeRow(props: {
  device: DesignSpaceDevice;
  graph: SourceFocusGraph;
  nodes: ReturnType<typeof sourceTreeNodes>;
  row: SourceFocusRow;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onApplySlot: SourceWorkspaceSidebarProps["onApplySlot"];
  onFocus: SourceWorkspaceSidebarProps["onFocus"];
  onSelect: SourceWorkspaceSidebarProps["onSelect"];
}) {
  const { row } = props;
  const occurrenceRow = row.kind === "component" && !row.layer;
  const active = occurrenceRow
    ? props.selected?.occurrenceId === row.occurrence?.id && props.selected?.kind === "component"
    : props.selected?.kind === row.kind && (
      props.selected?.layerId === row.layer?.id
      || (row.kind === "slot" && props.selected?.slotName === row.layer?.label)
    );
  const Icon = row.kind === "component" ? Component : row.kind === "html" ? CodeXml : PanelTop;
  const slot = row.kind === "slot" ? row.layer : undefined;
  const status = slot?.slot;
  const sourceOwner = row.occurrence?.usageOwnerId
    ? props.nodes.find((node) => node.id === row.occurrence?.usageOwnerId)
    : row.occurrence?.node;
  const ownerPath = sourceOwner?.implementations[props.device].entry?.relativePath ?? row.occurrence?.entry?.relativePath ?? "";
  const candidates = slot ? sourceSlotCandidates(props.workspace, props.nodes, slot, props.device, ownerPath) : [];
  const triggerId = slot ? `source-slot-picker-${safeId(slot.id)}` : undefined;
  const select = () => {
    if (occurrenceRow && row.occurrence) {
      props.onFocus(row.occurrence.id, {
        nodeId: row.occurrence.node.id,
        device: props.device,
        occurrenceId: row.occurrence.id,
        kind: "component",
      });
      return;
    }
    if (row.layer && row.occurrence) {
      props.onSelect({
        nodeId: row.occurrence.node.id,
        sourceNodeId: row.kind === "slot" ? row.occurrence.usageOwnerId : row.occurrence.node.id,
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
      <span className="relative z-10 grid size-6 shrink-0 place-items-center text-zinc-700">
        {row.role === "focus"
          ? <CircleDot size={11} className="text-sky-400" />
          : row.collapsible
            ? row.expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
            : null}
      </span>
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
        {row.kind === "component" && row.occurrence && <MissingDeviceCluster implementations={row.occurrence.node.implementations} />}
        {status && <SlotStatus layer={slot!} />}
      </Button>
      {slot && row.occurrence && active && (
        <SourceComponentPicker
          candidates={candidates}
          slot={slot}
          triggerId={triggerId}
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
