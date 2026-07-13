import { Button } from "@heroui/react";
import { ChevronDown, Code2, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";

type TopBarProps = {
  targetLabel: string;
  canUndo: boolean;
  canSave: boolean;
  canDiff: boolean;
  runtimeLabel: string;
  connected: boolean;
  saveLabel: string;
  onUndo: () => void;
  onReset: () => void;
  onDiff: () => void;
  onSave: () => void;
};

export function TopBar(props: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#101113] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-8 place-items-center rounded-lg bg-indigo-500 text-white">
          <Code2 size={17} strokeWidth={2.2} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Design Space</span>
        <span className="h-4 w-px bg-white/10" />
        <button className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200" type="button">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {props.targetLabel}
          <ChevronDown size={13} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-2 hidden items-center gap-1.5 text-[11px] text-zinc-500 md:flex">
          <span className={`size-1.5 rounded-full ${props.connected ? "bg-emerald-400" : "bg-amber-400"}`} /> {props.runtimeLabel}
        </span>
        <Button isIconOnly aria-label="Undo draft" size="sm" variant="ghost" isDisabled={!props.canUndo} onPress={props.onUndo}>
          <Undo2 size={15} />
        </Button>
        <Button isIconOnly aria-label="Redo" size="sm" variant="ghost" isDisabled>
          <Redo2 size={15} />
        </Button>
        <Button size="sm" variant="ghost" onPress={props.onReset}>
          <RotateCcw size={14} /> Reset
        </Button>
        <Button size="sm" variant="ghost" isDisabled={!props.canDiff} onPress={props.onDiff}>
          Diff
        </Button>
        <Button className="bg-indigo-500 text-white hover:bg-indigo-400" size="sm" isDisabled={!props.canSave} onPress={props.onSave}>
          <Save size={14} /> {props.saveLabel}
        </Button>
      </div>
    </header>
  );
}
