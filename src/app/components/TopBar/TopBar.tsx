import { Button } from "@heroui/react";
import { ChevronDown, Code2, FileDiff, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { DesignSpaceThemeToggle } from "../../shell/DesignSpaceThemeToggle";

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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#101113] px-2 lg:h-14 lg:gap-3 lg:px-3">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        <div className="grid size-8 place-items-center rounded-lg bg-sky-500 text-white">
          <Code2 size={17} strokeWidth={2.2} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Design Space</span>
        <span className="hidden h-4 w-px bg-white/10 lg:block" />
        <div className="hidden min-w-0 items-center gap-2 text-xs text-zinc-400 lg:flex">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="max-w-40 truncate">{props.targetLabel}</span>
          <ChevronDown aria-hidden="true" size={13} />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5 lg:gap-1.5">
        <DesignSpaceThemeToggle />
        <span className="mr-2 hidden items-center gap-1.5 text-[11px] text-zinc-500 lg:flex">
          <span className={`size-1.5 rounded-full ${props.connected ? "bg-emerald-400" : "bg-amber-400"}`} /> {props.runtimeLabel}
        </span>
        <Button isIconOnly aria-label="Undo draft" className="size-11 lg:size-8" size="sm" variant="ghost" isDisabled={!props.canUndo} onPress={props.onUndo}>
          <Undo2 size={15} />
        </Button>
        <Button isIconOnly aria-label="Redo" className="hidden lg:flex" size="sm" variant="ghost" isDisabled>
          <Redo2 size={15} />
        </Button>
        <Button aria-label="Reset" className="min-h-11 min-w-11 px-0 lg:min-h-8 lg:min-w-fit lg:px-3" size="sm" variant="ghost" onPress={props.onReset}>
          <RotateCcw size={14} /> <span className="hidden lg:inline">Reset</span>
        </Button>
        <Button aria-label="Show exact diff" className="min-h-11 min-w-11 px-0 lg:min-h-8 lg:min-w-fit lg:px-3" size="sm" variant="ghost" isDisabled={!props.canDiff} onPress={props.onDiff}>
          <FileDiff size={14} /> <span className="hidden lg:inline">Diff</span>
        </Button>
        <Button aria-label={props.saveLabel} className="min-h-11 min-w-11 bg-sky-500 px-0 text-white hover:bg-sky-400 lg:min-h-8 lg:min-w-fit lg:px-3" size="sm" isDisabled={!props.canSave} onPress={props.onSave}>
          <Save size={14} /> <span className="hidden lg:inline">{props.saveLabel}</span>
        </Button>
      </div>
    </header>
  );
}
