import { Tooltip } from "@heroui/react";
import { ChevronDown, ChevronRight, CircleDot, Code2, Component, Eye, EyeOff, FileBox, ListCollapse, Plug, Plus, Tag, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { ComponentTreeRow, SelectionTarget } from "../../model";
import type { StrictUiViolation } from "../../shared/strict-ui";
import { StrictUiIndicator } from "../strict-ui/StrictUiIndicator";
import {
  buildStrictUiSelectionMarkers,
  strictUiMarkerForTreeRow,
  type StrictUiMarker,
} from "../strict-ui/strict-ui-markers";

type ComponentTreeProps = {
  className?: string;
  embedded?: boolean;
  pageLabel: string;
  rows: readonly ComponentTreeRow[];
  selectedId: string;
  showInternals: boolean;
  insertMode?: boolean;
  prompt?: string;
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
  const selectedPath = useMemo(() => treeSelectionPath(props.rows, props.selectedId), [props.rows, props.selectedId]);
  const visibleRows = useMemo(() => visibleTreeRows(props.rows, collapsedBranches), [collapsedBranches, props.rows]);

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
    setCollapsedBranches(new Set(props.rows.flatMap((row, index) => {
      if (!("selection" in row) || preserved.has(row.selection.id)) return [];
      return props.rows[index + 1]?.depth > row.depth ? [row.selection.id] : [];
    })));
    props.onCollapseAll?.();
  };
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col ${props.embedded ? "" : "border-r border-white/10 bg-[#141518]"}`}>
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">{props.embedded ? "Layers" : "Component tree"}</h2>
        {!props.embedded && <span className="max-w-20 truncate text-[10px] text-zinc-600">{props.pageLabel}</span>}
        <Tooltip delay={350}>
          <button
            aria-label="Collapse all tree branches"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
            type="button"
            onClick={collapseAll}
          >
            <ListCollapse aria-hidden="true" size={14} />
          </button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">Collapse all · keeps selection visible</Tooltip.Content>
        </Tooltip>
        {props.onInsert && (
          <button
            aria-pressed={props.insertMode}
            className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-medium transition-colors ${props.insertMode ? "bg-sky-500/20 text-sky-200" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"}`}
            type="button"
            onClick={props.onInsert}
          >
            {props.insertMode ? <X aria-hidden="true" size={12} /> : <Plus aria-hidden="true" size={12} />}
            {props.insertMode ? "Cancel" : "Insert"}
          </button>
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
        {visibleRows.map((row, index) => (
          <TreeRow
            key={`${row.kind}-${"selection" in row ? row.selection.id : index}`}
            row={row}
            selectedId={props.selectedId}
            marker={strictUiMarkerForTreeRow(row, markers)}
            levelOffset={levelOffset}
            onHover={props.onHover}
            onHoverInternals={props.onHoverInternals}
            onContextMenuRequest={props.onContextMenuRequest}
            onSelect={props.onSelect}
            onToggleInternals={props.onToggleInternals}
          />
        ))}
      </div>

      <button
        aria-pressed={props.showInternals}
        className="flex h-12 items-center gap-2 border-t border-white/10 px-3 text-left text-xs text-zinc-400 hover:bg-white/[0.03]"
        type="button"
        onClick={() => props.onToggleInternals()}
      >
        {props.showInternals ? <Eye size={14} /> : <EyeOff size={14} />}
        <span className="flex-1">
          <span className="block">{props.toggleLabel ?? "Show internal HTML"}</span>
          <span className="block text-[9px] text-zinc-600">{props.toggleHint ?? "Collapsed inside components by default"}</span>
        </span>
        <span className={`h-4 w-7 rounded-full p-0.5 ${props.showInternals ? "bg-sky-500" : "bg-zinc-700"}`}>
          <span className={`block size-3 rounded-full bg-white transition-transform ${props.showInternals ? "translate-x-3" : ""}`} />
        </span>
      </button>
    </aside>
  );
}

function TreeRow(props: {
  row: ComponentTreeRow;
  selectedId: string;
  marker?: StrictUiMarker;
  levelOffset: number;
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onSelect: (selection: SelectionTarget) => void;
  onToggleInternals: (componentInstanceId?: string) => void;
}) {
  const { row } = props;
  if (row.kind === "internals-summary") {
    return (
      <button
        aria-expanded={!row.collapsed}
        aria-level={row.depth + props.levelOffset}
        className="flex h-11 w-full items-center gap-2 pr-2 text-left text-zinc-500 hover:bg-white/[0.03] lg:h-8"
        data-tree-disclosure="true"
        role="treeitem"
        style={{ paddingLeft: 12 + row.depth * 18 }}
        tabIndex={-1}
        type="button"
        onClick={() => props.onToggleInternals(row.disclosureId)}
      >
        {row.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        <span>{row.label}</span>
        <span className="ml-auto text-[10px]">{row.nodeCount} {row.label === "Implementation" ? "nodes" : "HTML nodes"}</span>
      </button>
    );
  }
  if (row.kind === "text") {
    return <div className="h-7 truncate pr-2 text-[10px] text-zinc-600" style={{ paddingLeft: 12 + row.depth * 18 }}>“{row.label}”</div>;
  }

  if (row.kind === "html-close") {
    return (
      <div
        className="flex min-h-11 items-center gap-2 pr-3 font-mono text-[10px] text-zinc-600 lg:min-h-8"
        data-html-boundary="close"
        style={{ paddingLeft: 12 + row.depth * 18 }}
      >
        <span aria-hidden="true" className="w-3 shrink-0" />
        <span>{`</${row.label}>`}</span>
      </div>
    );
  }

  if (row.kind === "component") {
    return <ComponentRow {...props} row={row} />;
  }

  const selection = row.selection;
  const selected = props.selectedId === selection.id;
  const isSlot = row.kind === "slot";
  const marker = props.marker;
  return (
    <button
      aria-level={row.depth + props.levelOffset}
      aria-selected={selected}
      className={`flex min-h-11 w-full items-center gap-2 border-l-2 pr-3 text-left lg:min-h-8 ${selected ? "border-sky-400 bg-sky-500/10 text-zinc-100" : "border-transparent text-zinc-400 hover:bg-white/[0.03]"}`}
      data-design-space-selection-id={selection.id}
      data-html-boundary={row.kind === "html" ? "open" : undefined}
      data-strict-ui-count={marker?.violations.length}
      data-strict-ui-severity={marker?.severity}
      role="treeitem"
      style={{ paddingLeft: 10 + row.depth * 18 }}
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
      onPointerEnter={() => props.onHover?.(selection)}
      onPointerLeave={() => props.onHover?.(undefined)}
    >
      {row.kind === "html" && <Tag size={12} className="text-zinc-600" />}
      {row.kind === "slot-outlet" && <Plug size={12} className="text-emerald-400" />}
      {isSlot && <CircleDot size={12} className={row.occupied ? "text-emerald-400" : "text-zinc-600"} />}
      <span className={`min-w-0 flex-1 truncate ${row.kind === "html" ? "font-mono text-[10px]" : ""}`}>
        {row.kind === "html" ? `<${row.label}${row.selfClosing ? " /" : ""}>` : isSlot ? `${row.label} slot` : row.label}
      </span>
      {isSlot && <span className={`text-[10px] ${row.occupied ? "text-emerald-400" : "text-zinc-600"}`}>{row.occupied ? `${row.childCount} used` : "Empty"}</span>}
      {marker && <StrictUiIndicator marker={marker} />}
    </button>
  );
}

function ComponentRow(props: {
  row: Extract<ComponentTreeRow, { kind: "component" }>;
  selectedId: string;
  marker?: StrictUiMarker;
  levelOffset: number;
  onHover?: (selection: SelectionTarget | undefined) => void;
  onHoverInternals?: (componentInstanceId: string | undefined) => void;
  onContextMenuRequest?: (selection: SelectionTarget, position: { x: number; y: number }) => void;
  onSelect: (selection: SelectionTarget) => void;
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
      className={`flex min-h-11 w-full items-center border-l-2 lg:min-h-8 ${selected ? "border-sky-400 bg-sky-500/10 text-zinc-100" : "border-transparent text-zinc-400 hover:bg-white/[0.03]"}`}
      onPointerEnter={() => props.onHover?.(selection)}
      onPointerLeave={() => props.onHover?.(undefined)}
    >
      <button
        aria-expanded={internals ? !internals.collapsed : undefined}
        aria-level={row.depth + props.levelOffset}
        aria-selected={selected}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 pr-2 text-left lg:min-h-8"
        data-design-space-selection-id={selection.id}
        data-strict-ui-count={props.marker?.violations.length}
        data-strict-ui-severity={props.marker?.severity}
        role="treeitem"
        style={{ paddingLeft: 10 + row.depth * 18 }}
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
        <Component aria-hidden="true" className="shrink-0 text-sky-400" size={13} />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {props.marker && <StrictUiIndicator marker={props.marker} />}
      </button>

      {internals && (
        <Tooltip delay={350}>
          <button
            aria-expanded={!internals.collapsed}
            aria-label={toggleLabel}
            className="mr-2 inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-transparent px-1.5 text-[10px] tabular-nums text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400"
            data-internal-html-toggle-for={selection.id}
            type="button"
            onBlur={() => props.onHoverInternals?.(undefined)}
            onClick={() => props.onToggleInternals(selection.id)}
            onFocus={() => props.onHoverInternals?.(selection.id)}
            onPointerEnter={() => props.onHoverInternals?.(selection.id)}
            onPointerLeave={() => props.onHoverInternals?.(undefined)}
          >
            <Code2 aria-hidden="true" size={12} />
            <span>{internals.nodeCount}</span>
          </button>
          <Tooltip.Content className="rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{toggleLabel}</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}

function visibleTreeRows(rows: readonly ComponentTreeRow[], collapsed: ReadonlySet<string>): readonly ComponentTreeRow[] {
  const visible: ComponentTreeRow[] = [];
  let hiddenBelowDepth: number | undefined;
  for (const row of rows) {
    if (hiddenBelowDepth !== undefined && row.depth > hiddenBelowDepth) continue;
    hiddenBelowDepth = undefined;
    visible.push(row);
    if ("selection" in row && collapsed.has(row.selection.id)) hiddenBelowDepth = row.depth;
  }
  return visible;
}

function treeSelectionPath(rows: readonly ComponentTreeRow[], selectedId: string): readonly string[] {
  const stack: Array<{ id: string; depth: number }> = [];
  for (const row of rows) {
    if (!("selection" in row)) continue;
    while (stack.at(-1) && stack.at(-1)!.depth >= row.depth) stack.pop();
    if (row.selection.id === selectedId) return [...stack.map((item) => item.id), selectedId];
    stack.push({ id: row.selection.id, depth: row.depth });
  }
  return [selectedId];
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
