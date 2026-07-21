import { Tooltip } from "@heroui/react";

export function SourceDesignStatus(props: { designPath: string; label: string }) {
  return (
    <Tooltip closeDelay={0} delay={150}>
      <span
        aria-label={`${props.label} design missing`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        role="img"
        tabIndex={0}
        title={`Design file missing · ${props.designPath}`}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-300/80 ring-2 ring-amber-300/10" />
      </span>
      <Tooltip.Content className="max-w-64 border border-white/10 bg-[#1a1b1f] px-2.5 py-2 text-[10px] leading-4 text-zinc-300 shadow-xl" placement="right">
        <p className="font-medium text-zinc-100">Design file missing</p>
        <p className="mt-0.5 break-all font-mono text-[9px] text-zinc-500">{props.designPath}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
