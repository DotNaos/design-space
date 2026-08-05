
import { MousePointer2, Play } from "lucide-react";

import type { SourcePreviewMode } from "./source-layer-design";
import { ModeButton } from "./ModeButton";

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
