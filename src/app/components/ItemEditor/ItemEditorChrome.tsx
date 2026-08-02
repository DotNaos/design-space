import { Button } from "@heroui/react";
import { ArrowDown, ArrowLeft, ArrowUp, Code2, Component, Copy, Focus, PencilRuler, Trash2 } from "lucide-react";

export function ItemEditorIdentity(props: {
  componentLabel: string;
  sourceLabel?: string;
  sourceBacked?: boolean;
  mobile?: boolean;
  htmlElement?: boolean;
  onBack?: () => void;
  onEditDefinition?: () => void;
  onOpenIsolated?: () => void;
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-2.5 py-2">
      {props.mobile && props.onBack ? (
        <Button aria-label="Back to canvas" isIconOnly size="sm" variant="ghost" onPress={props.onBack}>
          <ArrowLeft size={17} />
        </Button>
      ) : (
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-300">
          {props.htmlElement ? <Code2 size={16} strokeWidth={1.8} /> : <Component size={16} strokeWidth={1.8} />}
        </span>
      )}

      <div className={`min-w-0 flex-1 ${props.mobile ? "text-center" : ""}`}>
        <h2 className="truncate text-[13px] font-semibold text-zinc-100">{props.componentLabel}</h2>
        <p className="mt-0.5 truncate text-[9px] text-zinc-600">
          {props.sourceLabel ?? (props.sourceBacked ? "Source-backed component" : "Composition draft")}
        </p>
      </div>

      {props.onOpenIsolated && (
        <Button aria-label="Open component in isolation" className="shrink-0" isIconOnly size="sm" variant="ghost" onPress={props.onOpenIsolated}>
          <Focus size={15} />
        </Button>
      )}
      {props.onEditDefinition ? (
        <Button className="shrink-0 gap-1.5 text-[10px]" size="sm" variant="ghost" onPress={props.onEditDefinition}>
          <PencilRuler size={14} />
          <span className={props.mobile ? "sr-only min-[430px]:not-sr-only" : ""}>Definition</span>
        </Button>
      ) : (
        <span className="w-9 shrink-0 text-center text-[9px] text-zinc-600">{props.sourceBacked ? "Source" : "Draft"}</span>
      )}
    </header>
  );
}

export function ItemEditorActions(props: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div aria-label="Item actions" className="flex h-11 shrink-0 items-center border-b border-white/10 bg-black/10 px-2">
      <span className="px-2 text-[9px] font-medium text-zinc-700">Instance</span>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-white/10" />
      <EditorAction ariaLabel="Move up" disabled={!props.canMoveUp} icon={<ArrowUp size={15} />} onPress={() => props.onMove(-1)} />
      <EditorAction ariaLabel="Move down" disabled={!props.canMoveDown} icon={<ArrowDown size={15} />} onPress={() => props.onMove(1)} />
      <EditorAction ariaLabel="Duplicate" disabled={!props.canDuplicate} icon={<Copy size={14} />} onPress={props.onDuplicate} />
      <EditorAction danger ariaLabel="Delete" disabled={!props.canDelete} icon={<Trash2 size={14} />} onPress={props.onDelete} />
    </div>
  );
}

function EditorAction(props: {
  ariaLabel: string;
  icon: React.ReactNode;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      aria-label={props.ariaLabel}
      className={`group relative size-9 min-w-9 overflow-visible rounded-lg ${props.danger ? "ml-auto text-rose-400 hover:bg-rose-400/10" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"}`}
      isDisabled={props.disabled}
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.375rem)] z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#202126] px-2 py-1 text-[9px] font-medium text-zinc-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {props.ariaLabel}
      </span>
    </Button>
  );
}
