
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { centerSourceTreeRow, SourceTreeAnchorControls } from "./SourceTreeAnchorControls";
import { sourceCompositionRows, sourceFocusGraph, sourceOccurrenceSubtree, sourceIsolatedDesignRows, visibleSourceCompositionRows } from "./source-focus-tree";
import { sourceTreeNodes } from "./source-workspace-tree";
import { collapseSourceBranchesOutsideFocus } from "./source-tree-collapse";
import { ancestorBranchKeys, ancestorRowKeys, sourceRowOutsideActiveFile } from "./source-tree-row-state";
import { useSourceTreeCollapsedState } from "./useSourceTreeCollapsedState";
import { useVirtualSourceTree } from "./useVirtualSourceTree";
import { SourceWorkspaceTreeProps, sourceRowIndexForSelection } from "./SourceWorkspaceSidebar";
import { FocusTreeRow } from "./FocusTreeRow";

export function SourceWorkspaceTree(props: SourceWorkspaceTreeProps) {
  const device = props.selected?.device ?? "desktop";
  const nodes = useMemo(
    () => props.treeNodes ?? sourceTreeNodes(props.workspace),
    [props.treeNodes, props.workspace],
  );
  const graph = useMemo(
    () => props.focusGraph ?? sourceFocusGraph(nodes, device, props.rootNodeIds),
    [device, nodes, props.focusGraph, props.rootNodeIds],
  );
  const definitionSelected = props.selected?.kind === "component" && !props.selected.occurrenceId;
  const requestedRootFocus = graph.roots.find((rootId) => graph.occurrences.get(rootId)?.node.id === props.focusNodeId);
  const focusId = definitionSelected
    ? undefined
    : graph.occurrences.has(props.focusId ?? "") ? props.focusId! : requestedRootFocus ?? graph.roots[0];
  const atAppRoot = Boolean(focusId && graph.roots.includes(focusId));
  const [rootSelection, setRootSelection] = useState<SourceWorkspaceTreeProps["selected"]>();
  const displayedSelection = atAppRoot ? rootSelection : props.selected;
  const rows = useMemo(
    () => {
      if (!focusId) return [];
      return atAppRoot
        ? sourceCompositionRows(graph, focusId)
        : sourceIsolatedDesignRows(graph, focusId);
    },
    [atAppRoot, focusId, graph],
  );
  const activeCanvasIds = useMemo(() => sourceOccurrenceSubtree(graph, focusId), [focusId, graph]);
  const [previewOccurrenceId, setPreviewOccurrenceId] = useState<string>();
  const previewCanvasIds = useMemo(
    () => sourceOccurrenceSubtree(graph, previewOccurrenceId),
    [graph, previewOccurrenceId],
  );
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
  const previousRevealSelectedRequest = useRef(props.revealSelectedRequest);
  const handledRevealSelectedRevision = useRef(0);
  const previousFocusId = useRef(focusId);
  const expandedFocusId = useRef<string | undefined>(undefined);
  const [revealSelectedRevision, setRevealSelectedRevision] = useState(0);
  const visibleRows = useMemo(() => visibleSourceCompositionRows(rows, collapsed), [collapsed, rows]);
  const selectedVisibleIndex = useMemo(
    () => sourceRowIndexForSelection(visibleRows, displayedSelection, atAppRoot ? undefined : focusId),
    [atAppRoot, displayedSelection, focusId, visibleRows],
  );
  const activeVisibleIndex = useMemo(
    () => atAppRoot ? -1 : visibleRows.findIndex((row) => row.kind === "component" && !row.layer && row.occurrence?.id === focusId),
    [atAppRoot, focusId, visibleRows],
  );
  const virtual = useVirtualSourceTree(visibleRows.length, selectedVisibleIndex, activeVisibleIndex);
  const revealSelected = useCallback(() => {
    const selectedIndex = sourceRowIndexForSelection(rows, displayedSelection, atAppRoot ? undefined : focusId);
    if (selectedIndex < 0) return;
    const open = ancestorBranchKeys(rows, selectedIndex);
    setCollapsed((current) => {
      if (![...open].some((key) => current.has(key))) return current;
      const next = new Set(current);
      open.forEach((key) => next.delete(key));
      return next;
    });
    setRevealSelectedRevision((current) => current + 1);
  }, [atAppRoot, displayedSelection, focusId, rows, setCollapsed]);
  useEffect(() => {
    const focusChanged = previousFocusId.current !== focusId;
    previousFocusId.current = focusId;
    const selectedIndex = sourceRowIndexForSelection(rows, displayedSelection, atAppRoot ? undefined : focusId);
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
    atAppRoot,
    displayedSelection?.kind,
    displayedSelection?.layerId,
    displayedSelection?.nodeId,
    displayedSelection?.occurrenceId,
    displayedSelection?.renderedLayerOccurrence,
    displayedSelection?.sourceNodeId,
    focusId,
    rows,
  ]);
  useEffect(() => {
    if (previousRevealSelectedRequest.current === props.revealSelectedRequest) return;
    previousRevealSelectedRequest.current = props.revealSelectedRequest;
    revealSelected();
  }, [props.revealSelectedRequest, revealSelected]);
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
  useEffect(() => {
    if ((!props.expandFocus && !props.designNavigation) || !focusId || expandedFocusId.current === focusId) return;
    expandedFocusId.current = focusId;
    const focusRow = rows.find((row) => (
      row.kind === "component"
      && !row.layer
      && row.occurrence?.id === focusId
    ));
    if (!focusRow?.collapsible) return;
    setCollapsed((current) => {
      if (!current.has(focusRow.key)) return current;
      const next = new Set(current);
      next.delete(focusRow.key);
      return next;
    });
  }, [focusId, props.expandFocus, rows, setCollapsed]);
  useLayoutEffect(() => {
    if (
      revealSelectedRevision === 0
      || handledRevealSelectedRevision.current === revealSelectedRevision
      || selectedVisibleIndex < 0
    ) return;
    handledRevealSelectedRevision.current = revealSelectedRevision;
    virtual.scrollToSelected();
    const frame = requestAnimationFrame(() => {
      const scroll = virtual.scrollRef.current;
      const selectedRow = scroll?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]');
      if (!scroll || !selectedRow) return;
      centerSourceTreeRow(scroll, selectedRow);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    revealSelectedRevision,
    selectedVisibleIndex,
    virtual.scrollRef,
    virtual.scrollToSelected,
  ]);
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={virtual.scrollRef}
        className="h-full min-h-0 overflow-auto py-2"
        data-source-tree-scroll=""
        data-source-tree-virtualized={virtual.virtualized || undefined}
        onScroll={virtual.onScroll}
      >
        <div aria-label="Source tree" className="min-w-max" role="tree">
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
                activeCanvasId={atAppRoot ? undefined : focusId}
                previewCanvasIds={previewCanvasIds}
                previewOccurrenceId={previewOccurrenceId}
                rootMode={atAppRoot}
                activePath={!atAppRoot && activePathKeys.has(row.key)}
                approvalReview={props.approvalReview}
                selected={displayedSelection}
                workspace={props.workspace}
                onApplySlot={props.onApplySlot}
                editingSourceOwnerId={props.editingSourceOwnerId}
                slotEditorReady={props.slotEditorReady}
                onPrepareSlotEdit={props.onPrepareSlotEdit}
                onFocus={props.onFocus}
                onOpenComponent={props.onOpenComponent}
                onHover={props.onHover}
                onPreviewOccurrence={setPreviewOccurrenceId}
                onDeviceChange={props.onDeviceChange}
                onSelect={(next) => {
                  if (atAppRoot) setRootSelection(next);
                  props.onSelect(next);
                }}
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
        onScrollToSelected={revealSelected}
      />
    </div>
  );
}
