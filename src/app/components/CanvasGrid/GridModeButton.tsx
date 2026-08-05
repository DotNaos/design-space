import { ToggleButton } from "@heroui/react";
import type { CanvasGridMode } from "./canvas-grid-types";

export function GridModeButton(props: { icon: React.ReactNode; id: CanvasGridMode; label: string }) {
  return (
    <ToggleButton
      isIconOnly
      aria-label={props.label}
      className="size-9 min-w-9 rounded-md bg-transparent text-zinc-500 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-400/70 data-[selected]:bg-white/10 data-[selected]:text-zinc-100 lg:size-7 lg:min-w-7"
      id={props.id}
      variant="ghost"
    >
      {props.icon}
    </ToggleButton>
  );
}
