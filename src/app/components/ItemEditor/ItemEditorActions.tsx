
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { EditorAction } from "./EditorAction";

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
