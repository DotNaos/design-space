
import { CircleDot, Layers3, Plug, Type } from "lucide-react";
import type { ComponentTreeRow, SelectionTarget } from "../../../model";
import { StrictUiIndicator } from "../../strict-ui/StrictUiIndicator";
import { type StrictUiMarker } from "../../strict-ui/strict-ui-markers";
import { type HtmlScopeAnnotation } from "./component-tree-structure";
import { ComponentRow } from "./ComponentRow";
import { HtmlLayerIcon } from "./HtmlLayerIcon";
import { BranchChevron } from "./BranchChevron";

export function TreeRow(props: {
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
