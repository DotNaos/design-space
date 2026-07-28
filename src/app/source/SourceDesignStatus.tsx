import { Tooltip } from "@heroui/react";
import { SlidersHorizontal } from "lucide-react";

export function SourceDesignStatus(props: { designPath: string; label: string }) {
  return (
    <Tooltip closeDelay={0} delay={150}>
      <span
        aria-label={`${props.label} design missing`}
        className="relative inline-flex size-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        role="img"
        tabIndex={0}
        title={`Design file missing · ${props.designPath}`}
      >
        <SlidersHorizontal aria-hidden="true" className="text-red-400/80" size={13} strokeWidth={1.8} />
        <span aria-hidden="true" className="absolute h-px w-4 -rotate-45 bg-red-300 shadow-[0_0_0_1px_rgba(20,21,24,0.8)]" />
      </span>
      <Tooltip.Content className="max-w-64 border border-white/10 bg-[#1a1b1f] px-2.5 py-2 text-[10px] leading-4 text-zinc-300 shadow-xl" placement="right">
        <p className="font-medium text-zinc-100">Design file missing</p>
        <p className="mt-0.5 break-all font-mono text-[9px] text-zinc-500">{props.designPath}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
