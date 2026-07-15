import { Button, Switch, ToggleButton, Tooltip } from "@heroui/react";
import { Box, ChevronDown, ChevronRight, CircleDot, Code2, Component, Eye, EyeOff, FileBox, Image, Layers3, List, ListCollapse, MousePointerClick, Plug, Plus, Type, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { ComponentTreeRow, SelectionTarget } from "../../model";
import type { StrictUiViolation } from "../../shared/strict-ui";
import { StrictUiIndicator } from "../strict-ui/StrictUiIndicator";
import {
  buildStrictUiSelectionMarkers,
  strictUiMarkerForTreeRow,
  type StrictUiMarker,
} from "../strict-ui/strict-ui-markers";
import {
  annotateTreeRows,
  treeSelectionPath,
  visibleTreeRows,
  type HtmlScopeAnnotation,
} from "./component-tree-structure";

type ComponentTreeProps = {
  className?: string;
  embedded?: boolean;
  pageLabel: string;
  rows: readonly ComponentTreeRow[];
  selectedId: string;
  showInternals: boolean;
  insertMode?: boolean;
  prompt?: string;
  emptyMessage?: string;
  toggleLabel?: string;
  toggleHint?: string;
  strictUiViolations?: readonly StrictUiViolation[];
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onInsert?: () => void;
  onSelect: (selection: SelectionTarget) => void;
  onCollapseAll?: () => void;
  onToggleInternals: (componentInstanceId?: string) => void;
};

export function ComponentTree(props: ComponentTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<ReadonlySet<string>>(() => new Set());
  const markers = buildStrictUiSelectionMarkers(props.strictUiViolations ?? []);
  const levelOffset = props.embedded ? 1 : 2;
  const annotatedRows = useMemo(() => annotateTreeRows(props.rows, props.selectedId), [props.rows, props.selectedId]);
  const selectedPath = useMemo(() => treeSelectionPath(annotatedRows, props.selectedId), [annotatedRows, props.selectedId]);
  const visibleRows = useMemo(() => visibleTreeRows(annotatedRows, collapsedBranches), [annotatedRows, collapsedBranches]);

  useEffect(() => {
    setCollapsedBranches((current) => {
      const next = new Set(current);
      for (const id of selectedPath) next.delete(id);
      return next.size === current.size ? current : next;
    });
  }, [selectedPath]);

  useLayoutEffect(() => {
    const selected = [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-design-space-selection-id]") ?? [])]
      .find((element) => element.dataset.designSpaceSelectionId === props.selectedId);
    selected?.scrollIntoView?.({ block: "nearest" });
  }, [props.selectedId, visibleRows]);

  const collapseAll = () => {
    const preserved = new Set(selectedPath);
    setCollapsedBranches(new Set(annotatedRows.flatMap((item) => (
      item.branchKey && !preserved.has(item.branchKey) ? [item.branchKey] : []
    ))));
    props.onCollapseAll?.();
  };
  const toggleBranch = (branchKey: string) => setCollapsedBranches((current) => {
    const next = new Set(current);
    if (next.has(branchKey)) next.delete(branchKey);
    else next.add(branchKey);
    return next;
  });
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col ${props.embedded ? "" : "border-r border-white/10 bg-[#141518]"}`}>
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">{props.embedded ? "Layers" : "Component tree"}</h2>
        {!props.embedded && <span className="max-w-20 truncate text-[10px] text-zinc-600">{props.pageLabel}</span>}
        {!props.emptyMessage && <Tooltip delay={350}>
          <Button
            isIconOnly
            aria-label="Collapse all tree branches"
            className="size-8 min-w-8 shrink-0 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
            size="sm"
            variant="ghost"
            onPress={collapseAll}
          >
            <ListCollapse aria-hidden="true" size={14} />
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">Collapse all · keeps selection visible</Tooltip.Content>
        </Tooltip>}
        {props.onInsert && (
          <ToggleButton
            className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-medium transition-colors ${props.insertMode ? "bg-sky-500/20 text-sky-200" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"}`}
            isSelected={props.insertMode}
            size="sm"
            variant="ghost"
            onChange={props.onInsert}
          >
            {props.insertMode ? <X aria-hidden="true" size={12} /> : <Plus aria-hidden="true" size={12} />}
            {props.insertMode ? "Cancel" : "Insert"}
          </ToggleButton>
        )}
      </div>

      {props.prompt && <p className="border-b border-sky-400/20 bg-sky-500/10 px-3 py-2 text-[10px] leading-4 text-sky-200">{props.prompt}</p>}

      <div
        ref={treeRef}
        aria-label="Component tree"
        className="min-h-0 flex-1 overflow-y-auto py-2 text-xs outline-none"
        role="tree"
        tabIndex={0}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          const selected = event.currentTarget.querySelector<HTMLButtonElement>('button[role="treeitem"][aria-selected="true"]');
          (selected ?? event.currentTarget.querySelector<HTMLButtonElement>('button[role="treeitem"]'))?.focus();
        }}
        onKeyDown={navigateTree}
      >
        {!props.embedded && (
          <div aria-expanded="true" aria-level={1} className="flex h-11 items-center gap-2 px-3 text-zinc-400 lg:h-8" role="treeitem">
            <ChevronDown size={13} className="text-zinc-600" />
            <FileBox size={14} />
            <span className="truncate">{props.pageLabel}</span>
          </div>
        )}
        {visibleRows.map((item) => (
          <TreeRow
            key={item.key}
            row={item.row}
            branchKey={item.branchKey}
            branchCollapsed={Boolean(item.branchKey && collapsedBranches.has(item.branchKey))}
            hasDescendants={item.hasDescendants}
            htmlScope={item.htmlScope}
            selectedId={props.selectedId}
            marker={strictUiMarkerForTreeRow(item.row, markers)}
            levelOffset={levelOffset}
            onHover={props.onHover}
            onHoverInternals={props.onHoverInternals}
            onContextMenuRequest={props.onContextMenuRequest}
            onSelect={props.onSelect}
            onToggleBranch={toggleBranch}
            onToggleInternals={props.onToggleInternals}
          />
        ))}
        {props.emptyMessage && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Layers3 aria-hidden="true" className="mb-3 text-zinc-700" size={24} />
            <p className="text-xs font-medium text-zinc-300">No layers yet</p>
            <p className="mt-1 max-w-48 text-[10px] leading-4 text-zinc-600">{props.emptyMessage}</p>
          </div>
        )}
      </div>

      {!props.emptyMessage && <Switch isSelected={props.showInternals} onChange={() => props.onToggleInternals()}>
        <Switch.Content className="flex h-12 w-full items-center gap-2 border-t border-white/10 px-3 text-left text-xs text-zinc-400 hover:bg-white/[0.03]">
          {props.showInternals ? <Eye size={14} /> : <EyeOff size={14} />}
          <span className="flex-1">
            <span className="block">{props.toggleLabel ?? "Show internal HTML"}</span>
            <span className="block text-[9px] text-zinc-600">{props.toggleHint ?? "Collapsed inside components by default"}</span>
          </span>
          <Switch.Control className="shrink-0"><Switch.Thumb /></Switch.Control>
        </Switch.Content>
      </Switch>}
    </aside>
  );
}

function TreeRow(props: {
  row: ComponentTreeRow;
  branchKey?: string;
  branchCollapsed: boolean;
  hasDescendants: boolean;
  htmlScope?: HtmlScopeAnnotation;
  selectedId: string;
  marker?: StrictUiMarker;
  levelOffset: number;
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onSelect: (selection: SelectionTarget) => void;
  onToggleBranch: (branchKey: string) => void;
  onToggleInternals: (componentInstanceId?: string) => void;
}) {
  const { row } = props;
  if (row.kind === "internals-summary") {
    return (
      <div
        className={`relative mx-1 flex h-11 w-[calc(100%-0.5rem)] items-center rounded-md pr-2 text-zinc-500 lg:h-8 ${props.htmlScope ? "bg-sky-500/[0.045]" : "hover:bg-white/[0.04]"}`}
        data-html-pair-id={props.htmlScope?.pairId}
        data-html-scope-selected={props.htmlScope ? "true" : undefined}
        style={{ paddingLeft: 4 + row.depth * 18 }}
      >
        <BranchChevron {...props} label={row.label} />
        <button
          aria-expanded={!row.collapsed}
          aria-level={row.depth + props.levelOffset}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
          data-tree-disclosure="true"
          role="treeitem"
          tabIndex={-1}
          type="button"
          onClick={() => props.onToggleInternals(row.disclosureId)}
        >
          <Layers3 aria-hidden="true" className="shrink-0 text-zinc-600" data-layer-icon="internals" size={13} />
          <span>{row.label}</span>
          <span className="ml-auto text-[10px]">{row.nodeCount} {row.label === "Implementation" ? "nodes" : "HTML nodes"}</span>
        </button>
      </div>
    );
  }
  if (row.kind === "text") {
    return (
      <div
        className={`relative mx-1 flex h-8 w-[calc(100%-0.5rem)] items-center gap-2 truncate rounded-md pr-2 text-[11px] text-zinc-500 ${props.htmlScope ? "bg-sky-500/[0.045]" : "hover:bg-white/[0.04]"}`}
        data-html-pair-id={props.htmlScope?.pairId}
        data-html-scope-selected={props.htmlScope ? "true" : undefined}
        style={{ paddingLeft: 12 + row.depth * 18 }}
      >
        <Type aria-hidden="true" className="shrink-0 text-zinc-600" data-layer-icon="text" size={13} />
        <span className="truncate">{row.label}</span>
      </div>
    );
  }

  if (row.kind === "html-close") return null;

  if (row.kind === "component") {
    return <ComponentRow {...props} row={row} />;
  }

  const selection = row.selection;
  const selected = props.selectedId === selection.id;
  const isSlot = row.kind === "slot";
  const marker = props.marker;
  return (
    <div
      className={`relative mx-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center rounded-md pr-2 lg:min-h-8 ${selected ? "bg-sky-500/15 text-zinc-100" : props.htmlScope ? "bg-sky-500/[0.045] text-zinc-400" : "text-zinc-400 hover:bg-white/[0.04]"}`}
      data-html-pair-id={props.htmlScope?.pairId}
      data-html-pair-selected={props.htmlScope?.boundary === "open" ? "true" : undefined}
      data-html-scope-selected={props.htmlScope ? "true" : undefined}
      data-layer-row={row.kind}
      data-layer-selected={selected ? "true" : undefined}
      style={{ paddingLeft: 6 + row.depth * 18 }}
      onPointerEnter={() => props.onHover?.(selection)}
      onPointerLeave={() => props.onHover?.(undefined)}
    >
      <BranchChevron {...props} label={row.label} />
      <button
        aria-expanded={props.hasDescendants ? !props.branchCollapsed : undefined}
        aria-level={row.depth + props.levelOffset}
        aria-selected={selected}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left outline-none lg:min-h-8"
        data-design-space-selection-id={selection.id}
        data-html-boundary={row.kind === "html" ? "open" : undefined}
        data-strict-ui-count={marker?.violations.length}
        data-strict-ui-severity={marker?.severity}
        role="treeitem"
        tabIndex={selected ? 0 : -1}
        type="button"
        onBlur={() => props.onHover?.(undefined)}
        onClick={() => props.onSelect(selection)}
        onContextMenu={(event) => {
          if (!props.onContextMenuRequest) return;
          event.preventDefault();
          props.onContextMenuRequest(selection, { x: event.clientX, y: event.clientY });
        }}
        onFocus={() => props.onHover?.(selection)}
        onKeyDown={(event) => {
          if (!(event.shiftKey && event.key === "F10") || !props.onContextMenuRequest) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          props.onContextMenuRequest(selection, { x: rect.left + 20, y: rect.top + 20 });
        }}
      >
        {row.kind === "slot-outlet" && <Plug aria-hidden="true" className="shrink-0 text-emerald-400" data-layer-icon="slot-outlet" size={12} />}
        {isSlot && <CircleDot aria-hidden="true" className={`shrink-0 ${row.occupied ? "text-emerald-400" : "text-zinc-600"}`} data-layer-icon="slot" size={12} />}
        {row.kind === "html" && <HtmlLayerIcon tagName={row.label} />}
        <span className="min-w-0 flex-1 truncate">
          {row.kind === "html" ? row.label : isSlot ? `${row.label} slot` : row.label}
        </span>
        {isSlot && <span className={`text-[10px] ${row.occupied ? "text-emerald-400" : "text-zinc-600"}`}>{row.occupied ? `${row.childCount} used` : "Empty"}</span>}
        {marker && <StrictUiIndicator marker={marker} />}
      </button>
    </div>
  );
}

function ComponentRow(props: {
  row: Extract<ComponentTreeRow, { kind: "component" }>;
  branchKey?: string;
  branchCollapsed: boolean;
  hasDescendants: boolean;
  htmlScope?: HtmlScopeAnnotation;
  selectedId: string;
  marker?: StrictUiMarker;
  levelOffset: number;
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onSelect: (selection: SelectionTarget) => void;
  onToggleBranch: (branchKey: string) => void;
  onToggleInternals: (componentInstanceId?: string) => void;
}) {
  const { row } = props;
  const selection = row.selection;
  const selected = props.selectedId === selection.id;
  const internals = row.internalHtml;
  const toggleLabel = internals
    ? `${internals.collapsed ? "Expand" : "Collapse"} ${row.label} internal HTML (${internals.nodeCount} ${internals.nodeCount === 1 ? "node" : "nodes"})`
    : undefined;

  return (
    <div
      className={`relative mx-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center rounded-md pr-2 lg:min-h-8 ${selected ? "bg-sky-500/15 text-zinc-100" : props.htmlScope ? "bg-sky-500/[0.045] text-zinc-400" : "text-zinc-400 hover:bg-white/[0.04]"}`}
      data-html-pair-id={props.htmlScope?.pairId}
      data-html-scope-selected={props.htmlScope ? "true" : undefined}
      data-layer-row="component"
      data-layer-selected={selected ? "true" : undefined}
      style={{ paddingLeft: 6 + row.depth * 18 }}
      onPointerEnter={() => props.onHover?.(selection)}
      onPointerLeave={() => props.onHover?.(undefined)}
    >
      <BranchChevron {...props} label={row.label} />
      <button
        aria-expanded={props.hasDescendants ? !props.branchCollapsed : undefined}
        aria-level={row.depth + props.levelOffset}
        aria-selected={selected}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left outline-none lg:min-h-8"
        data-design-space-selection-id={selection.id}
        data-strict-ui-count={props.marker?.violations.length}
        data-strict-ui-severity={props.marker?.severity}
        role="treeitem"
        tabIndex={selected ? 0 : -1}
        type="button"
        onBlur={() => props.onHover?.(undefined)}
        onClick={() => props.onSelect(selection)}
        onContextMenu={(event) => {
          if (!props.onContextMenuRequest) return;
          event.preventDefault();
          props.onContextMenuRequest(selection, { x: event.clientX, y: event.clientY });
        }}
        onFocus={() => props.onHover?.(selection)}
        onKeyDown={(event) => {
          if (!(event.shiftKey && event.key === "F10") || !props.onContextMenuRequest) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          props.onContextMenuRequest(selection, { x: rect.left + 20, y: rect.top + 20 });
        }}
      >
        <Component aria-hidden="true" className="shrink-0 text-sky-400" data-layer-icon="component" size={13} />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {props.marker && <StrictUiIndicator marker={props.marker} />}
      </button>

      {internals && (
        <span
          className="contents"
          onBlurCapture={() => props.onHoverInternals?.(undefined)}
          onFocusCapture={() => props.onHoverInternals?.(selection.id)}
        >
        <Tooltip delay={350}>
          <Button
            isIconOnly={false}
            aria-expanded={!internals.collapsed}
            aria-label={toggleLabel}
            className="mr-2 inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-transparent px-1.5 text-[10px] tabular-nums text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
            data-internal-html-toggle-for={selection.id}
            onPress={() => props.onToggleInternals(selection.id)}
            onPointerEnter={() => props.onHoverInternals?.(selection.id)}
            onPointerLeave={() => props.onHoverInternals?.(undefined)}
          >
            <Code2 aria-hidden="true" size={12} />
            <span>{internals.nodeCount}</span>
          </Button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{toggleLabel}</Tooltip.Content>
        </Tooltip>
        </span>
      )}
    </div>
  );
}

function HtmlLayerIcon({ tagName }: { tagName: string }) {
  const normalized = tagName.toLowerCase();
  const iconProps = { "aria-hidden": true, className: "shrink-0 text-zinc-500", "data-layer-icon": `html-${normalized}`, size: 13 } as const;
  if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "strong", "small"].includes(normalized)) return <Type {...iconProps} />;
  if (["img", "picture", "svg", "canvas"].includes(normalized)) return <Image {...iconProps} />;
  if (["button", "a"].includes(normalized)) return <MousePointerClick {...iconProps} />;
  if (["ul", "ol", "li"].includes(normalized)) return <List {...iconProps} />;
  return <Box {...iconProps} />;
}

function BranchChevron(props: {
  branchKey?: string;
  branchCollapsed: boolean;
  hasDescendants: boolean;
  label: string;
  onToggleBranch: (branchKey: string) => void;
}) {
  if (!props.hasDescendants || !props.branchKey) return <span aria-hidden="true" className="w-6 shrink-0" />;
  return (
    <button
      aria-expanded={!props.branchCollapsed}
      aria-label={`${props.branchCollapsed ? "Expand" : "Collapse"} ${props.label}`}
      className="relative z-10 grid size-6 shrink-0 place-items-center rounded text-zinc-600 hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
      data-tree-branch-for={props.branchKey}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        props.onToggleBranch(props.branchKey!);
      }}
    >
      {props.branchCollapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
    </button>
  );
}

function navigateTree(event: ReactKeyboardEvent<HTMLDivElement>) {
  const target = event.target instanceof HTMLButtonElement
    ? event.target.closest<HTMLButtonElement>('button[role="treeitem"]')
    : null;
  if (!target) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="treeitem"]:not(:disabled)')];
  const current = items.indexOf(target);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? Math.min(items.length - 1, current + 1)
          : Math.max(0, current - 1);
    items[next]?.focus({ preventScroll: true });
    return;
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const branchDisclosure = target.parentElement?.querySelector<HTMLButtonElement>("[data-tree-branch-for]");
  if (branchDisclosure) {
    const expanded = branchDisclosure.getAttribute("aria-expanded") === "true";
    if ((event.key === "ArrowRight" && !expanded) || (event.key === "ArrowLeft" && expanded)) {
      event.preventDefault();
      branchDisclosure.click();
      return;
    }
  }
  const disclosure = target.dataset.treeDisclosure === "true"
    ? target
    : target.parentElement?.querySelector<HTMLButtonElement>("[data-internal-html-toggle-for]");
  if (!disclosure) return;
  const expanded = disclosure.getAttribute("aria-expanded") === "true";
  if ((event.key === "ArrowRight" && !expanded) || (event.key === "ArrowLeft" && expanded)) {
    event.preventDefault();
    disclosure.click();
  }
}
