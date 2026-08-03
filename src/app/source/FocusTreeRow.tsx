import { Button } from "@heroui/react";
import { ChevronDown, ChevronRight, Component, Diamond, PanelTop } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { type DesignSpaceDevice, type RuntimeSourceWorkspace } from "../../shared/source-workspace";
import { suggestedSourceDesignPath } from "../../shared/source-design";
import { SourceComponentPicker } from "./SourceComponentPicker";
import { SourceApprovalStatus, sourceApprovalRowClassName } from "./SourceApprovalStatus";
import { SourceDesignStatus } from "./SourceDesignStatus";
import { SourceDeviceTabs } from "./SourceDeviceTabs";
import { type SourceFocusGraph, type SourceFocusRow } from "./source-focus-tree";
import { sourceSlotCandidates } from "./source-slot-composition";
import { sourceTreeNodes } from "./source-workspace-tree";
import { renderedOccurrenceMatches, sourceRowOutsideActiveFile } from "./source-tree-row-state";
import { SourceComponentOpenRequest, SourceWorkspaceSelection, SourceWorkspaceSidebarProps, htmlLayerIcon } from "./SourceWorkspaceSidebar";
import { SlotStatus } from "./SlotStatus";
import { MissingDeviceCluster } from "./MissingDeviceCluster";

export function FocusTreeRow(props: {
  device: DesignSpaceDevice;
  collapsed: boolean;
  graph: SourceFocusGraph;
  nodes: ReturnType<typeof sourceTreeNodes>;
  row: SourceFocusRow;
  activeCanvasIds: ReadonlySet<string>;
  activeCanvasId?: string;
  activePath: boolean;
  approvalReview?: boolean;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  onApplySlot: SourceWorkspaceSidebarProps["onApplySlot"];
  editingSourceOwnerId?: string;
  slotEditorReady?: boolean;
  onPrepareSlotEdit?: SourceWorkspaceSidebarProps["onPrepareSlotEdit"];
  onFocus: SourceWorkspaceSidebarProps["onFocus"];
  onOpenComponent: SourceWorkspaceSidebarProps["onOpenComponent"];
  onHover: SourceWorkspaceSidebarProps["onHover"];
  onDeviceChange?: SourceWorkspaceSidebarProps["onDeviceChange"];
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
  const rawSlot = row.kind === "slot" ? row.layer : undefined;
  const definitionContract = rawSlot && !rawSlot.slot
    ? row.occurrence?.entry?.slots.find((contract) => contract.name === rawSlot.label)
    : undefined;
  const slot = rawSlot && definitionContract
    ? { ...rawSlot, slotContract: definitionContract }
    : rawSlot;
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
  const componentOpenRequest = (): SourceComponentOpenRequest | undefined => {
    if (row.kind !== "component") return undefined;
    if (occurrenceRow && focusTarget?.entry) {
      return {
        selection: {
          nodeId: focusTarget.node.id,
          sourceNodeId: focusTarget.node.id,
          device: props.device,
          occurrenceId: focusTarget.id,
          ...(row.renderedLayerOccurrence !== undefined
            ? { renderedLayerOccurrence: row.renderedLayerOccurrence }
            : {}),
          kind: "component",
        },
        source: focusTarget.entry.source,
        ...(focusTarget.entry.design ? { designOccurrenceId: focusTarget.id } : {}),
      };
    }
    const next = selection();
    if (!next || !row.layer) return undefined;
    return {
      selection: next,
      source: row.layer.definition ?? row.layer.source,
    };
  };
  const openComponent = () => {
    const request = componentOpenRequest();
    if (!request) return;
    if (props.onOpenComponent) {
      props.onOpenComponent(request);
      return;
    }
    if (occurrenceRow && focusTarget) {
      props.onFocus(focusTarget.id, request.selection);
    }
  };
  const approvalRowClassName = componentEntry && props.approvalReview
    ? sourceApprovalRowClassName(props.workspace.approvals, componentEntry)
    : "";
  return (
    <div
      aria-label={row.label}
      aria-level={row.depth + 1}
      aria-selected={active}
      className={`relative flex min-h-10 w-full min-w-max items-center pr-2 transition-[padding,opacity,transform,background-color] duration-150 ease-out motion-reduce:transition-none ${mutedOpacity} ${approvalRowClassName || (props.activePath ? "bg-violet-500/[0.025]" : "")}`}
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
        fullWidth={!(openedCanvas && props.onDeviceChange)}
        size="sm"
        variant="ghost"
        onKeyDown={(event) => {
          if (event.key === "Enter" && row.kind === "component") {
            event.preventDefault();
            openComponent();
            return;
          }
        }}
        onDoubleClick={openComponent}
        onPress={select}
      >
        {componentEntry && props.approvalReview ? (
          <SourceApprovalStatus approvals={props.workspace.approvals} entry={componentEntry} />
        ) : null}
        <Icon aria-hidden="true" className={`shrink-0 ${row.kind === "component" ? withinCanvas && !outsideActiveFile ? "text-violet-400" : props.activePath ? "text-violet-400/65" : "text-violet-500/45" : ""}`} size={row.kind === "component" && !openedCanvas ? 12 : 13} />
        <span className={`flex-1 whitespace-nowrap text-xs ${row.kind === "html" ? "font-mono text-[10px]" : ""}`}>{row.label}</span>
        {row.kind === "component" && row.occurrence && <MissingDeviceCluster implementations={row.occurrence.node.implementations} />}
        {status && <SlotStatus layer={slot!} />}
      </Button>
      {componentEntry && !componentEntry.design ? (
        <SourceDesignStatus
          designPath={suggestedSourceDesignPath(componentEntry, props.workspace.entries)}
          label={componentEntry.label}
        />
      ) : null}
      {openedCanvas && props.onDeviceChange ? (
        <SourceDeviceTabs
          compact
          device={props.device}
          node={row.occurrence?.node}
          onChange={props.onDeviceChange}
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
