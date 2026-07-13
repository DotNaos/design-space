import { ChevronDown, ChevronRight, CircleDot, Component, Eye, EyeOff, FileBox, Tag } from "lucide-react";

import type { ComponentTreeRow, SelectionTarget } from "../../model";

type ComponentTreeProps = {
  className?: string;
  pageLabel: string;
  rows: readonly ComponentTreeRow[];
  selectedId: string;
  showInternals: boolean;
  onSelect: (selection: SelectionTarget) => void;
  onToggleInternals: () => void;
};

export function ComponentTree(props: ComponentTreeProps) {
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <h2 className="text-xs font-medium text-zinc-300">Component tree</h2>
        <span className="max-w-24 truncate text-[10px] text-zinc-600">{props.pageLabel}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2 text-xs">
        <div className="flex h-11 items-center gap-2 px-3 text-zinc-400 lg:h-8">
          <ChevronDown size={13} className="text-zinc-600" />
          <FileBox size={14} />
          <span className="truncate">{props.pageLabel}</span>
        </div>
        {props.rows.map((row, index) => (
          <TreeRow
            key={`${row.kind}-${"selection" in row ? row.selection.id : index}`}
            row={row}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            onToggleInternals={props.onToggleInternals}
          />
        ))}
      </div>

      <button
        aria-pressed={props.showInternals}
        className="flex h-12 items-center gap-2 border-t border-white/10 px-3 text-left text-xs text-zinc-400 hover:bg-white/[0.03]"
        type="button"
        onClick={props.onToggleInternals}
      >
        {props.showInternals ? <Eye size={14} /> : <EyeOff size={14} />}
        <span className="flex-1">
          <span className="block">Show internal HTML</span>
          <span className="block text-[9px] text-zinc-600">Collapsed inside components by default</span>
        </span>
        <span className={`h-4 w-7 rounded-full p-0.5 ${props.showInternals ? "bg-indigo-500" : "bg-zinc-700"}`}>
          <span className={`block size-3 rounded-full bg-white transition-transform ${props.showInternals ? "translate-x-3" : ""}`} />
        </span>
      </button>
    </aside>
  );
}

function TreeRow(props: {
  row: ComponentTreeRow;
  selectedId: string;
  onSelect: (selection: SelectionTarget) => void;
  onToggleInternals: () => void;
}) {
  const { row } = props;
  if (row.kind === "internals-summary") {
    return (
      <button
        className="flex h-11 w-full items-center gap-2 pr-2 text-left text-zinc-500 hover:bg-white/[0.03] lg:h-8"
        style={{ paddingLeft: 12 + row.depth * 18 }}
        type="button"
        onClick={props.onToggleInternals}
      >
        {row.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        <span>{row.label}</span>
        <span className="ml-auto text-[10px]">{row.nodeCount} HTML nodes</span>
      </button>
    );
  }
  if (row.kind === "text") {
    return <div className="h-7 truncate pr-2 text-[10px] text-zinc-600" style={{ paddingLeft: 12 + row.depth * 18 }}>“{row.label}”</div>;
  }

  const selection = row.selection;
  const selected = props.selectedId === selection.id;
  const isSlot = row.kind === "slot";
  return (
    <button
      aria-selected={selected}
      className={`flex min-h-11 w-full items-center gap-2 border-l-2 pr-3 text-left lg:min-h-8 ${selected ? "border-indigo-400 bg-indigo-500/10 text-zinc-100" : "border-transparent text-zinc-400 hover:bg-white/[0.03]"}`}
      style={{ paddingLeft: 10 + row.depth * 18 }}
      type="button"
      onClick={() => props.onSelect(selection)}
    >
      {row.kind === "component" && <Component size={13} className="text-indigo-400" />}
      {row.kind === "html" && <Tag size={12} className="text-zinc-600" />}
      {isSlot && <CircleDot size={12} className={row.occupied ? "text-emerald-400" : "text-zinc-600"} />}
      <span className={`min-w-0 flex-1 truncate ${row.kind === "html" ? "font-mono text-[10px]" : ""}`}>
        {row.kind === "html" ? `<${row.label}>` : isSlot ? `${row.label} slot` : row.label}
      </span>
      {isSlot && <span className={`text-[10px] ${row.occupied ? "text-emerald-400" : "text-zinc-600"}`}>{row.occupied ? `${row.childCount} used` : "Empty"}</span>}
    </button>
  );
}
