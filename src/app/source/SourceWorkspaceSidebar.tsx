import { Button } from "@heroui/react";
import { ArrowUpToLine, FilePlus2, Frame, House, Image, ListCollapse, Square, Type, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { type DesignSpaceDevice, type RuntimeSourceWorkspace, type SourceLayerBinding, type SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceApprovalReviewSummary, sourceApprovalModeLabel } from "./SourceApprovalStatus";
import { SourceTreeHeaderAction } from "./SourceTreeHeaderAction";
import { type SourceFocusRow, type SourceOccurrence } from "./source-focus-tree";
import { type SourceComponentCandidate } from "./source-slot-composition";
import { type SourceImplementation, type SourceTreeSelection } from "./source-workspace-tree";
import { renderedOccurrenceMatches } from "./source-tree-row-state";
import { SourceWorkspaceTree } from "./SourceWorkspaceTree";

export interface SourceWorkspaceSelection extends SourceTreeSelection {
  occurrenceId?: string;
  renderedLayerOccurrence?: number;
  sourceNodeId?: string;
  slotName?: string;
  kind?: "component" | "html" | "slot";
}

export interface SourceComponentOpenRequest {
  selection: SourceWorkspaceSelection;
  source: SourceLayerBinding;
  designOccurrenceId?: string;
}

export interface SourceWorkspaceSidebarProps {
  approvalReview?: boolean;
  className?: string;
  selected?: SourceWorkspaceSelection;
  workspace: RuntimeSourceWorkspace;
  focusId?: string;
  onHover?: (selection: SourceWorkspaceSelection | undefined) => void;
  onDeviceChange?: (device: DesignSpaceDevice) => void;
  onSelect: (selection: SourceWorkspaceSelection) => void;
  onFocus: (occurrenceId: string, selection: SourceWorkspaceSelection) => void;
  onOpenComponent?: (request: SourceComponentOpenRequest) => void;
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
  onApprovalReviewChange?: (active: boolean) => void;
  treeStateKey?: string;
  designNavigation?: {
    parentLabel?: string;
    onExit: () => void;
    onOpenParent?: () => void;
  };
  headerLeading?: ReactNode;
}

export function SourceWorkspaceSidebar(props: SourceWorkspaceSidebarProps) {
  const [collapseOutsideRequest, setCollapseOutsideRequest] = useState(0);
  const [internalApprovalReview, setInternalApprovalReview] = useState(false);
  const approvalReview = props.approvalReview ?? internalApprovalReview;
  const toggleApprovalReview = () => {
    const next = !approvalReview;
    if (props.approvalReview === undefined) setInternalApprovalReview(next);
    props.onApprovalReviewChange?.(next);
  };
  return (
    <aside aria-label="Source workspace" className={`${props.className ?? "flex w-80"} min-h-0 min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <header className="flex min-h-12 shrink-0 items-center gap-1 border-b border-white/10 px-1.5">
        {props.headerLeading}
        <h2 className="sr-only">Source tree</h2>
        {props.workspace.entries.length > 0 && (
          <SourceTreeHeaderAction
            label="Collapse outside active component"
            onPress={() => setCollapseOutsideRequest((current) => current + 1)}
          >
            <ListCollapse aria-hidden="true" size={14} />
          </SourceTreeHeaderAction>
        )}
        {props.workspace.entries.length > 0 && (
          <SourceTreeHeaderAction
            active={approvalReview}
            label={sourceApprovalModeLabel(props.workspace.approvals, props.workspace.entries)}
            onPress={toggleApprovalReview}
          >
            <ShieldCheck aria-hidden="true" size={14} />
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
          <SourceTreeHeaderAction label="Open app design" onPress={props.designNavigation.onExit}>
            <House aria-hidden="true" size={14} />
          </SourceTreeHeaderAction>
        )}
        {props.workspace.capabilities?.createComponents && props.onCreateComponent && (
          <Button aria-label="Create component" className="grid size-7 min-w-7 place-items-center rounded-lg text-zinc-500" isIconOnly size="sm" variant="ghost" onPress={props.onCreateComponent}>
            <FilePlus2 aria-hidden="true" size={14} />
          </Button>
        )}
      </header>
      {approvalReview && (
        <SourceApprovalReviewSummary
          approvals={props.workspace.approvals}
          entries={props.workspace.entries}
        />
      )}
      <SourceWorkspaceTree
        {...props}
        approvalReview={approvalReview}
        collapseOutsideRequest={collapseOutsideRequest}
      />
    </aside>
  );
}

export interface SourceWorkspaceTreeProps extends Omit<SourceWorkspaceSidebarProps, "approvalReview" | "className" | "onApprovalReviewChange" | "onCreateComponent"> {
  approvalReview?: boolean;
  collapseOutsideRequest?: number;
  emptyMessage?: string;
  expandFocus?: boolean;
  focusNodeId?: string;
  revealSelectedRequest?: number;
  rootLabels?: Readonly<Record<string, string>>;
  rootNodeIds?: readonly string[];
  trailingRows?: ReactNode;
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
  if (occurrenceRow) return selected.kind === "component" && !selected.layerId;
  return selected.kind === row.kind && (
    selected.layerId === row.layer?.id
    || (row.kind === "slot" && selected.slotName === row.layer?.label)
  );
}

export function sourceRowIndexForSelection(
  rows: readonly SourceFocusRow[],
  selected: SourceWorkspaceSelection | undefined,
  activeCanvasId: string | undefined,
): number {
  const exactIndex = rows.findIndex((row) => sourceRowMatchesSelection(row, selected, activeCanvasId));
  if (exactIndex >= 0 || !selected) return exactIndex;
  return rows.findIndex((row) => {
    if (!renderedOccurrenceMatches(selected, row)) return false;
    if (selected.kind === "component" && row.kind === "component") {
      return row.occurrence?.node.id === selected.nodeId
        || row.occurrence?.node.id === selected.sourceNodeId;
    }
    return row.kind === selected.kind
      && row.layer?.id === selected.layerId
      && (
        row.occurrence?.node.id === selected.sourceNodeId
        || row.sourceOwnerId === selected.sourceNodeId
      );
  });
}

export function htmlLayerIcon(label: string) {
  if (["img", "picture", "svg", "canvas"].includes(label)) return Image;
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "strong", "small"].includes(label)) return Type;
  if (["button", "input", "select", "textarea", "a"].includes(label)) return Square;
  return Frame;
}

export function implementationLabel(implementation: SourceImplementation): string {
  const labels: Record<DesignSpaceDevice, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
  return implementation.state === "fallback"
    ? `${labels[implementation.requestedDevice]} uses ${implementation.sourceDevice ? labels[implementation.sourceDevice] : "a fallback"}`
    : `${labels[implementation.requestedDevice]} implementation missing`;
}

export { SourceWorkspaceTree } from "./SourceWorkspaceTree";
