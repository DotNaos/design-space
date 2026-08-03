import { Tooltip } from "@heroui/react";
import { SlidersHorizontal } from "lucide-react";

export function SourceDesignStatus(props: { designPath: string; label: string }) {
  return (
    <Tooltip closeDelay={0} delay={150}>
      <span
        aria-label={`${props.label} design missing`}
        className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white outline-none transition-colors hover:bg-rose-400 focus-visible:ring-2 focus-visible:ring-rose-300/70"
        role="img"
        tabIndex={0}
        title={`Design file missing · ${props.designPath}`}
      >
        <SlidersHorizontal aria-hidden="true" className="text-white" size={12} strokeWidth={1.8} />
        <span aria-hidden="true" className="absolute h-px w-3.5 -rotate-45 bg-white" />
      </span>
      <Tooltip.Content className="max-w-64 bg-[#1a1b1f] px-2.5 py-2 text-[10px] leading-4 text-zinc-300 shadow-xl" placement="right">
        <p className="font-medium text-zinc-100">Design file missing</p>
        <p className="mt-0.5 break-all font-mono text-[9px] text-zinc-500">{props.designPath}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
