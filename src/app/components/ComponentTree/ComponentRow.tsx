import { Button, Tooltip } from "@heroui/react";
import { Code2, Component } from "lucide-react";
import type { ComponentTreeRow, SelectionTarget } from "../../../model";
import { StrictUiIndicator } from "../../strict-ui/StrictUiIndicator";
import { type StrictUiMarker } from "../../strict-ui/strict-ui-markers";
import { type HtmlScopeAnnotation } from "./component-tree-structure";
import { BranchChevron } from "./BranchChevron";

export function ComponentRow(props: {
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
          <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{toggleLabel}</Tooltip.Content>
        </Tooltip>
        </span>
      )}
    </div>
  );
}
