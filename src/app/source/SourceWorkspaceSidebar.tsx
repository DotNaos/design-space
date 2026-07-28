import { Button, Tooltip } from "@heroui/react";
import {
  ArrowDown,
  ArrowUpToLine,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Component,
  Diamond,
  FileCode2,
  FilePlus2,
  Frame,
  House,
  Image,
  ListCollapse,
  LocateFixed,
  Monitor,
  PanelTop,
  Square,
  Smartphone,
  Tablet,
  Type,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { designSpaceDevices, type DesignSpaceDevice, type RuntimeSourceWorkspace, type SourceWorkspaceLayer } from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceComponentPicker } from "./SourceComponentPicker";
import { SourceDesignStatus } from "./SourceDesignStatus";
import {
  initialFocusOccurrence,
  sourceCompositionRows,
  sourceFocusGraph,
  sourceOccurrenceSubtree,
  type SourceFocusGraph,
  type SourceFocusRow,
  type SourceOccurrence,
  visibleSourceCompositionRows,
} from "./source-focus-tree";
import { sourceSlotCandidates, type SourceComponentCandidate } from "./source-slot-composition";
import { sourceTreeNodes, type SourceImplementation, type SourceTreeNode, type SourceTreeSelection } from "./source-workspace-tree";
import { collapseSourceBranchesOutsideFocus } from "./source-tree-collapse";
import { useSourceTreeCollapsedState } from "./useSourceTreeCollapsedState";
import { useVirtualSourceTree } from "./useVirtualSourceTree";

export interface SourceWorkspaceSelection extends SourceTreeSelection {
  occurrenceId?: string;
  renderedLayerOccurrence?: number;
  sourceNodeId?: string;
  slotName?: string;
  kind?: "component" | "html" | "slot";
}

export interface SourceWorkspaceSidebarProps {
  className?: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  focusId?: string;
  onHover?: (selection: SourceWorkspaceSelection | undefined) => void;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onFocus: (occurrenceId: string, selection: SourceWorkspaceSelection) => void;
  onApplySlot?: (
    slot: SourceWorkspaceLayer,
    occurrence: SourceOccurrence,
    candidate: SourceComponentCandidate,
    action: "add" | "replace",
  ) => void;
  editingSourceOwnerId?: string;
  slotEditorReady?: boolean;
  onPrepareSlotEdit?: (occurrence: SourceOccurrence) => void;
  onCreateComponent?: () => void;
  treeStateKey?: string;
  designNavigation?: {
    parentLabel?: string;
    onExit: () => void;
    onOpenParent?: () => void;
  };
}

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const [collapseOutsideRequest, setCollapseOutsideRequest] = useState(0);
  return (
    <aside aria-label="Source workspace" className={`${props.className ?? "flex w-80"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <FileCode2 aria-hidden="true" className="text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-zinc-100">Source tree</h2>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-zinc-600">{props.workspace.sourceRoot} · {props.workspace.runtime === "react-native" ? "React Native" : "React"}</p>
        </div>
        {props.workspace.entries.length > 0 && (
          <SourceTreeHeaderAction
            label="Collapse outside active component"
            onPress={() => setCollapseOutsideRequest((current) => current + 1)}
          >
            <ListCollapse aria-hidden="true" size={14} />
          </SourceTreeHeaderAction>
        )}
        {props.designNavigation?.onOpenParent && (
          <SourceTreeHeaderAction
            label={`Open parent${props.designNavigation.parentLabel ? ` ${props.designNavigation.parentLabel}` : ""}`}
            onPress={props.designNavigation.onOpenParent}
          >
            <ArrowUpToLine aria-hidden="true" size={14} />
          </SourceTreeHeaderAction>
        )}
        {props.designNavigation && (
          <SourceTreeHeaderAction label="Exit component design" onPress={props.designNavigation.onExit}>
            <House aria-hidden="true" size={14} />
          </SourceTreeHeaderAction>
        )}
        {props.workspace.capabilities?.createComponents && props.onCreateComponent && (
          <Button aria-label="Create component" className="grid size-8 place-items-center rounded-md text-zinc-500" isIconOnly size="sm" variant="ghost" onPress={props.onCreateComponent}>
            <FilePlus2 aria-hidden="true" size={14} />
          </Button>
        )}
      </header>
      <SourceWorkspaceTree {...props} collapseOutsideRequest={collapseOutsideRequest} />
    </aside>
  );
}

function SourceTreeHeaderAction(props: { children: ReactNode; label: string; onPress: () => void }) {
  return (
    <Tooltip closeDelay={80} delay={350}>
      <Button
        aria-label={props.label}
        className="grid size-8 place-items-center rounded-md text-zinc-500 hover:text-zinc-100"
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content
        className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl"
        placement="bottom"
      >
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}

export interface SourceWorkspaceTreeProps extends Omit<SourceWorkspaceSidebarProps, "className" | "onCreateComponent"> {
  collapseOutsideRequest?: number;
  emptyMessage?: string;
  focusNodeId?: string;
  rootLabels?: Readonly<Record<string, string>>;
  rootNodeIds?: readonly string[];
  trailingRows?: ReactNode;
}

export function SourceWorkspaceTree(props: SourceWorkspaceTreeProps) {
  const device = props.selected?.device ?? "desktop";
  const nodes = useMemo(() => sourceTreeNodes(props.workspace), [props.workspace]);
  const graph = useMemo(() => sourceFocusGraph(nodes, device, props.rootNodeIds), [device, nodes, props.rootNodeIds]);
  const definitionSelected = props.selected?.kind === "component" && !props.selected.occurrenceId;
  const requestedRootFocus = graph.roots.find((rootId) => graph.occurrences.get(rootId)?.node.id === props.focusNodeId);
  const focusId = definitionSelected
    ? undefined
    : graph.occurrences.has(props.focusId ?? "") ? props.focusId! : requestedRootFocus ?? initialFocusOccurrence(graph);
  const rows = useMemo(() => sourceCompositionRows(graph, focusId), [focusId, graph]);
  const activeCanvasIds = useMemo(() => sourceOccurrenceSubtree(graph, focusId), [focusId, graph]);
  const activePathKeys = useMemo(() => {
    const focusIndex = rows.findIndex((row) => (
      row.kind === "component"
      && !row.layer
      && row.occurrence?.id === focusId
    ));
    return ancestorRowKeys(rows, focusIndex);
  }, [focusId, rows]);
  const [collapsed, setCollapsed] = useSourceTreeCollapsedState(rows, focusId, props.treeStateKey);
  const previousCollapseOutsideRequest = useRef(props.collapseOutsideRequest);
  const previousFocusId = useRef(focusId);
  const visibleRows = useMemo(() => visibleSourceCompositionRows(rows, collapsed), [collapsed, rows]);
  const selectedVisibleIndex = useMemo(
    () => visibleRows.findIndex((row) => sourceRowMatchesSelection(row, props.selected, focusId)),
    [focusId, props.selected, visibleRows],
  );
  const activeVisibleIndex = useMemo(
    () => visibleRows.findIndex((row) => row.kind === "component" && !row.layer && row.occurrence?.id === focusId),
    [focusId, visibleRows],
  );
  const virtual = useVirtualSourceTree(visibleRows.length, selectedVisibleIndex, activeVisibleIndex);
  useEffect(() => {
    const focusChanged = previousFocusId.current !== focusId;
    previousFocusId.current = focusId;
    const selectedIndex = rows.findIndex((row) => row.occurrence?.id === props.selected?.occurrenceId && (
      row.layer?.id === props.selected?.layerId
      || (!props.selected?.layerId && row.kind === "component")
    ) && renderedOccurrenceMatches(props.selected, row));
    if (selectedIndex < 0) return;
    const open = new Set(ancestorBranchKeys(rows, selectedIndex));
    const selectedRow = rows[selectedIndex];
    if (focusChanged && selectedRow?.collapsible && selectedRow.occurrence?.id === focusId) open.add(selectedRow.key);
    setCollapsed((current) => {
      if (![...open].some((key) => current.has(key))) return current;
      const next = new Set(current);
      open.forEach((key) => next.delete(key));
      return next;
    });
  }, [
    focusId,
    props.selected?.layerId,
    props.selected?.occurrenceId,
    props.selected?.renderedLayerOccurrence,
    rows,
  ]);
  useEffect(() => {
    if (previousCollapseOutsideRequest.current === props.collapseOutsideRequest) return;
    previousCollapseOutsideRequest.current = props.collapseOutsideRequest;
    setCollapsed((current) => collapseSourceBranchesOutsideFocus(
      rows,
      focusId,
      current,
      (row) => sourceRowOutsideActiveFile(row, graph, nodes, device, focusId),
    ));
  }, [device, focusId, graph, nodes, props.collapseOutsideRequest, rows, setCollapsed]);
  const toggleBranch = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={virtual.scrollRef}
        className="h-full min-h-0 overflow-y-auto py-2"
        data-source-tree-virtualized={virtual.virtualized || undefined}
        onScroll={virtual.onScroll}
      >
        <div aria-label="Source tree" role="tree">
          {virtual.topSpacer > 0 ? <div aria-hidden="true" style={{ height: virtual.topSpacer }} /> : null}
          {visibleRows.slice(virtual.start, virtual.end).map((row) => {
            const displayRow = row.depth === 0 && row.kind === "component" && row.occurrence
              ? { ...row, label: props.rootLabels?.[row.occurrence.node.id] ?? row.label }
              : row;
            return (
              <FocusTreeRow
                key={`${row.key}:${row.depth}`}
                collapsed={collapsed.has(row.key)}
                device={device}
                graph={graph}
                nodes={nodes}
                row={displayRow}
                activeCanvasIds={activeCanvasIds}
                activeCanvasId={focusId}
                activePath={activePathKeys.has(row.key)}
                selected={props.selected}
                workspace={props.workspace}
                onApplySlot={props.onApplySlot}
                editingSourceOwnerId={props.editingSourceOwnerId}
                slotEditorReady={props.slotEditorReady}
                onPrepareSlotEdit={props.onPrepareSlotEdit}
                onFocus={props.onFocus}
                onHover={props.onHover}
                onSelect={props.onSelect}
                onToggleBranch={toggleBranch}
              />
            );
          })}
          {virtual.bottomSpacer > 0 ? <div aria-hidden="true" style={{ height: virtual.bottomSpacer }} /> : null}
          {props.trailingRows}
          {!rows.length && !props.trailingRows && <p className="px-4 py-4 text-[10px] text-zinc-600">{props.emptyMessage ?? "No configured entry component was found."}</p>}
        </div>
      </div>
      <SourceTreeAnchorControls
        activeDirection={virtual.anchorDirection}
        selectedDirection={virtual.selectedDirection}
        onScrollToActive={virtual.scrollToAnchor}
        onScrollToSelected={virtual.scrollToSelected}
      />
    </div>
  );
}

function SourceTreeAnchorControls(props: {
  activeDirection?: "above" | "below";
  selectedDirection?: "above" | "below";
  onScrollToActive: () => void;
  onScrollToSelected: () => void;
}) {
  return (["above", "below"] as const).map((direction) => {
    const showActive = props.activeDirection === direction;
    const showSelected = props.selectedDirection === direction;
    if (!showActive && !showSelected) return null;
    return (
      <div
        key={direction}
        className={`absolute right-3 z-30 flex gap-1 ${direction === "above" ? "top-3" : ""}`}
        style={direction === "below"
          ? { bottom: "calc(var(--source-code-overlay-height, 2.5rem) + 0.75rem)" }
          : undefined}
      >
        {showActive ? (
          <Button
            isIconOnly
            aria-label={`Scroll to active component ${direction}`}
            className="size-8 min-w-8 rounded-full border border-sky-400/30 bg-[#1b1d21]/95 text-sky-300 shadow-lg shadow-black/30 backdrop-blur"
            size="sm"
            variant="secondary"
            onClick={props.onScrollToActive}
          >
            {direction === "above"
              ? <ArrowUp aria-hidden="true" size={14} />
              : <ArrowDown aria-hidden="true" size={14} />}
          </Button>
        ) : null}
        {showSelected ? (
          <Button
            isIconOnly
            aria-label={`Scroll to selected layer ${direction}`}
            className="size-8 min-w-8 rounded-full border border-violet-400/30 bg-[#1b1d21]/95 text-violet-300 shadow-lg shadow-black/30 backdrop-blur"
            size="sm"
            variant="secondary"
            onClick={props.onScrollToSelected}
          >
            <LocateFixed aria-hidden="true" size={14} />
          </Button>
        ) : null}
      </div>
    );
  });
}

function sourceRowMatchesSelection(
  row: SourceFocusRow,
  selected: SourceWorkspaceSelection | undefined,
  activeCanvasId: string | undefined,
): boolean {
  const occurrenceRow = row.kind === "component" && !row.layer;
  if (!selected?.occurrenceId) {
    return occurrenceRow && row.occurrence?.id === activeCanvasId;
  }
  if (selected.occurrenceId !== row.occurrence?.id || !renderedOccurrenceMatches(selected, row)) {
    return false;
  }
  if (occurrenceRow) return selected.kind === "component";
  return selected.kind === row.kind && (
    selected.layerId === row.layer?.id
    || (row.kind === "slot" && selected.slotName === row.layer?.label)
  );
}

function FocusTreeRow(props: {
  device: DesignSpaceDevice;
  collapsed: boolean;
  graph: SourceFocusGraph;
  nodes: ReturnType<typeof sourceTreeNodes>;
  row: SourceFocusRow;
  activeCanvasIds: ReadonlySet<string>;
  activeCanvasId?: string;
  activePath: boolean;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onApplySlot: SourceWorkspaceSidebarProps["onApplySlot"];
  editingSourceOwnerId?: string;
  slotEditorReady?: boolean;
  onPrepareSlotEdit?: SourceWorkspaceSidebarProps["onPrepareSlotEdit"];
  onFocus: SourceWorkspaceSidebarProps["onFocus"];
  onHover: SourceWorkspaceSidebarProps["onHover"];
  onSelect: SourceWorkspaceSidebarProps["onSelect"];
  onToggleBranch: (key: string) => void;
}) {
  const { row } = props;
  const rowButton = useRef<HTMLButtonElement>(null);
  const occurrenceRow = row.kind === "component" && !row.layer;
  const focusTarget = row.targetOccurrence ?? (occurrenceRow ? row.occurrence : undefined);
  const active = (occurrenceRow
    ? props.selected?.occurrenceId === row.occurrence?.id
      && props.selected?.kind === "component"
      && renderedOccurrenceMatches(props.selected, row)
    : props.selected?.occurrenceId === row.occurrence?.id && props.selected?.kind === row.kind && (
      props.selected?.layerId === row.layer?.id
      || (row.kind === "slot" && props.selected?.slotName === row.layer?.label)
    ) && renderedOccurrenceMatches(props.selected, row))
    || (!props.selected?.occurrenceId && occurrenceRow && row.occurrence?.id === props.activeCanvasId);
  useLayoutEffect(() => {
    if (active) rowButton.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  const withinCanvas = Boolean(row.occurrence && props.activeCanvasIds.has(row.occurrence.id));
  const openedCanvas = occurrenceRow && row.occurrence?.id === props.activeCanvasId;
  const Icon = row.kind === "component"
    ? openedCanvas ? Component : Diamond
    : row.kind === "html" ? htmlLayerIcon(row.label) : PanelTop;
  const slot = row.kind === "slot" ? row.layer : undefined;
  const status = slot?.slot;
  const sourceOwnerId = row.sourceOwnerId ?? row.occurrence?.usageOwnerId;
  const sourceOwner = sourceOwnerId
    ? props.nodes.find((node) => node.id === sourceOwnerId)
    : row.occurrence?.node;
  const ownerPath = sourceOwner?.implementations[props.device].entry?.relativePath ?? row.occurrence?.entry?.relativePath ?? "";
  const outsideActiveFile = sourceRowOutsideActiveFile(
    row,
    props.graph,
    props.nodes,
    props.device,
    props.activeCanvasId,
  );
  const mutedOpacity = outsideActiveFile
    ? props.activePath ? "opacity-70" : "opacity-40"
    : "";
  const candidates = slot ? sourceSlotCandidates(props.workspace, props.nodes, slot, props.device, ownerPath) : [];
  const componentEntry = occurrenceRow ? row.occurrence?.entry : undefined;
  const selection = (): SourceWorkspaceSelection | undefined => {
    if (occurrenceRow && row.occurrence) {
      return {
        nodeId: row.occurrence.node.id,
        sourceNodeId: row.occurrence.usageOwnerId ?? row.occurrence.node.id,
        device: props.device,
        occurrenceId: row.occurrence.id,
        ...(row.occurrence.usageLayer ? { layerId: row.occurrence.usageLayer.id } : {}),
        ...(row.renderedLayerOccurrence !== undefined
          ? { renderedLayerOccurrence: row.renderedLayerOccurrence }
          : {}),
        kind: "component",
      };
    }
    if (row.layer && row.occurrence) {
      return {
        nodeId: row.occurrence.node.id,
        sourceNodeId: row.sourceOwnerId ?? (row.kind === "slot" ? row.occurrence.usageOwnerId : row.occurrence.node.id),
        device: props.device,
        occurrenceId: row.occurrence.id,
        layerId: row.layer.id,
        ...(row.kind === "slot" ? { slotName: row.layer.label } : {}),
        ...(row.renderedLayerOccurrence !== undefined
          ? { renderedLayerOccurrence: row.renderedLayerOccurrence }
          : {}),
        kind: row.kind,
      };
    }
    return undefined;
  };
  const select = () => {
    const next = selection();
    if (next) props.onSelect(next);
  };
  return (
    <div
      aria-label={row.label}
      aria-level={row.depth + 1}
      aria-selected={active}
      className={`relative flex min-h-10 items-center pr-2 transition-[padding,opacity,transform] duration-150 ease-out motion-reduce:transition-none ${mutedOpacity} ${props.activePath ? "bg-violet-500/[0.025]" : ""}`}
      data-source-active-path={props.activePath || undefined}
      data-source-file-scope={outsideActiveFile ? "external" : "current"}
      data-source-occurrence={row.occurrence?.id}
      data-source-row={row.key}
      data-source-runtime-occurrence={row.renderedLayerOccurrence}
      role="treeitem"
      style={{ paddingLeft: 8 + row.depth * 18 }}
      onMouseEnter={() => props.onHover?.(selection())}
      onMouseLeave={() => props.onHover?.(undefined)}
    >
      {row.collapsible ? (
        <Button
          isIconOnly
          aria-expanded={!props.collapsed}
          aria-label={`${props.collapsed ? "Expand" : "Collapse"} ${row.label}`}
          className={`relative z-10 size-6 min-w-6 shrink-0 rounded hover:bg-white/[0.06] hover:text-zinc-300 ${props.activePath ? "text-violet-400/60" : "text-zinc-700"}`}
          size="sm"
          variant="ghost"
          onPress={() => props.onToggleBranch(row.key)}
        >
          {props.collapsed ? <ChevronRight aria-hidden="true" size={11} /> : <ChevronDown aria-hidden="true" size={11} />}
        </Button>
      ) : <span aria-hidden="true" className="size-6 shrink-0" />}
      <Button
        ref={rowButton}
        aria-label={`${row.label}${row.role === "focus" ? ", focused" : ""}`}
        className={`min-h-9 min-w-0 flex-1 justify-start gap-2 rounded-md px-1.5 text-left ${active ? "bg-sky-500/15 text-sky-100" : props.activePath ? "text-zinc-400 hover:bg-violet-500/[0.055] hover:text-zinc-200" : withinCanvas && !outsideActiveFile ? "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100" : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400"}`}
        fullWidth
        size="sm"
        variant="ghost"
        onKeyDown={(event) => {
          if (event.key === "Enter" && focusTarget && occurrenceRow) {
            event.preventDefault();
            props.onFocus(focusTarget.id, {
              nodeId: focusTarget.node.id,
              sourceNodeId: focusTarget.node.id,
              device: props.device,
              occurrenceId: focusTarget.id,
              ...(row.renderedLayerOccurrence !== undefined
                ? { renderedLayerOccurrence: row.renderedLayerOccurrence }
                : {}),
              kind: "component",
            });
            return;
          }
        }}
        onDoubleClick={() => {
          if (!focusTarget || !occurrenceRow) return;
          props.onFocus(focusTarget.id, {
            nodeId: focusTarget.node.id,
            sourceNodeId: focusTarget.node.id,
            device: props.device,
            occurrenceId: focusTarget.id,
            ...(row.renderedLayerOccurrence !== undefined
              ? { renderedLayerOccurrence: row.renderedLayerOccurrence }
              : {}),
            kind: "component",
          });
        }}
        onPress={select}
      >
        <Icon aria-hidden="true" className={`shrink-0 ${row.kind === "component" ? withinCanvas && !outsideActiveFile ? "text-violet-400" : props.activePath ? "text-violet-400/65" : "text-violet-500/45" : ""}`} size={row.kind === "component" && !openedCanvas ? 12 : 13} />
        <span className={`min-w-0 flex-1 truncate text-xs ${row.kind === "html" ? "font-mono text-[10px]" : ""}`}>{row.label}</span>
        {row.kind === "component" && row.occurrence && <MissingDeviceCluster implementations={row.occurrence.node.implementations} />}
        {status && <SlotStatus layer={slot!} />}
      </Button>
      {componentEntry && !componentEntry.design ? (
        <SourceDesignStatus
          designPath={suggestedSourceDesignPath(componentEntry, props.workspace.entries)}
          label={componentEntry.label}
        />
      ) : null}
      {slot && row.occurrence && props.onApplySlot && (
        <SourceComponentPicker
          candidates={candidates}
          isBusy={props.editingSourceOwnerId === sourceOwnerId && props.slotEditorReady === false}
          slot={slot}
          onOpen={() => props.onPrepareSlotEdit?.(row.occurrence!)}
          onApply={(candidate, action) => props.onApplySlot?.(slot, row.occurrence!, candidate, action)}
        />
      )}
    </div>
  );
}

function renderedOccurrenceMatches(
  selected: SourceWorkspaceSelection | undefined,
  row: SourceFocusRow,
): boolean {
  return selected?.renderedLayerOccurrence === undefined
    || row.renderedLayerOccurrence === undefined
    || selected.renderedLayerOccurrence === row.renderedLayerOccurrence;
}

function sourceRowOutsideActiveFile(
  row: SourceFocusRow,
  graph: SourceFocusGraph,
  nodes: ReturnType<typeof sourceTreeNodes>,
  device: DesignSpaceDevice,
  activeCanvasId?: string,
): boolean {
  if (
    row.kind === "component"
    && !row.layer
    && row.occurrence?.id === activeCanvasId
  ) {
    return false;
  }
  const activeCanvasPath = activeCanvasId
    ? graph.occurrences.get(activeCanvasId)?.entry?.relativePath
    : undefined;
  const sourceOwnerId = row.sourceOwnerId ?? row.occurrence?.usageOwnerId;
  const sourceOwner = sourceOwnerId
    ? nodes.find((node) => node.id === sourceOwnerId)
    : row.occurrence?.node;
  const ownerPath = sourceOwner?.implementations[device].entry?.relativePath
    ?? row.occurrence?.entry?.relativePath
    ?? "";
  return Boolean(activeCanvasPath && ownerPath && ownerPath !== activeCanvasPath);
}

function ancestorBranchKeys(rows: readonly SourceFocusRow[], selectedIndex: number): ReadonlySet<string> {
  const ancestors = ancestorRowKeys(rows, selectedIndex);
  const keys = new Set<string>();
  for (const row of rows) {
    if (ancestors.has(row.key) && row.collapsible) keys.add(row.key);
  }
  return keys;
}

function ancestorRowKeys(rows: readonly SourceFocusRow[], selectedIndex: number): ReadonlySet<string> {
  const keys = new Set<string>();
  if (selectedIndex < 0) return keys;
  let parentDepth = (rows[selectedIndex]?.depth ?? 0) - 1;
  for (let index = selectedIndex - 1; index >= 0 && parentDepth >= 0; index -= 1) {
    const row = rows[index]!;
    if (row.depth !== parentDepth) continue;
    keys.add(row.key);
    parentDepth -= 1;
  }
  return keys;
}

function htmlLayerIcon(label: string) {
  if (["img", "picture", "svg", "canvas"].includes(label)) return Image;
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "strong", "small"].includes(label)) return Type;
  if (["button", "input", "select", "textarea", "a"].includes(label)) return Square;
  return Frame;
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
