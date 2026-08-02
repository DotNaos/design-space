import { Button, Tooltip } from "@heroui/react";
import { MousePointer2, Play } from "lucide-react";

import type { SourcePreviewMode } from "./source-layer-design";

export interface SourcePreviewModeToggleProps {
  mode: SourcePreviewMode;
  onChange: (mode: SourcePreviewMode) => void;
}

export function SourcePreviewModeToggle(props: SourcePreviewModeToggleProps) {
  return (
    <div aria-label="Canvas mode" className="flex h-9 items-center gap-0.5 rounded-xl bg-black/20 p-0.5" role="group">
      <ModeButton active={props.mode === "design"} label="Design mode" onPress={() => props.onChange("design")}><MousePointer2 size={13} /></ModeButton>
      <ModeButton active={props.mode === "play"} label="Play mode" onPress={() => props.onChange("play")}><Play size={13} /></ModeButton>
    </div>
  );
}

function ModeButton(props: { active: boolean; children: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Tooltip delay={350} closeDelay={80}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`size-7 min-w-7 rounded-md ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">{props.label}</Tooltip.Content>
    </Tooltip>
  );
}
