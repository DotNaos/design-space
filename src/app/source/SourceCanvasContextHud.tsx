import { Button, Tooltip } from "@heroui/react";
import { MonitorPlay, Play, Square } from "lucide-react";

import type { SourceWorkspaceMode } from "./source-layer-design";

export function SourceCanvasContextHud(props: {
  children?: React.ReactNode;
  contextLabel: string;
  mode: SourceWorkspaceMode;
  playing: boolean;
  onPlayChange: (playing: boolean) => void;
  onReturnToPreview?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div
        aria-label="Canvas context"
        className="flex h-6 min-w-0 shrink items-center gap-0.5 pl-1 text-[9px] text-zinc-500"
      >
        {props.mode === "design" ? <span className="sr-only">Design · {props.contextLabel}</span> : null}
        <span aria-hidden={props.mode === "design" ? "true" : undefined} className="max-w-16 truncate" title={props.mode === "preview" ? "Preview" : `Design · ${props.contextLabel}`}>
          {props.mode === "preview" ? "Preview" : "Design"}
        </span>
        {props.mode === "preview" ? (
          <HudButton
            active={props.playing}
            label={props.playing ? "Stop interactive preview" : "Play interactive preview"}
            onPress={() => props.onPlayChange(!props.playing)}
          >
            {props.playing ? <Square aria-hidden="true" size={11} /> : <Play aria-hidden="true" size={11} />}
          </HudButton>
        ) : (
          <HudButton label="Open Preview page" onPress={() => props.onReturnToPreview?.()}>
            <MonitorPlay aria-hidden="true" size={12} />
          </HudButton>
        )}
      </div>
      {props.children}
    </div>
  );
}

function HudButton(props: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip closeDelay={80} delay={350}>
      <Button
        isIconOnly
        aria-label={props.label}
        aria-pressed={props.active}
        className={`size-5 min-w-5 rounded ${props.active ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/5 hover:text-zinc-200"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
