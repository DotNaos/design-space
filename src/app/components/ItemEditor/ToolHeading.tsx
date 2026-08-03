import { Tooltip } from "@heroui/react";
import { ShieldCheck } from "lucide-react";

export function ToolHeading(props: { title: string; description: string; strictUi?: boolean }) {
  return (
    <div className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-white/10 bg-[#141518] px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-zinc-200">{props.title}</span>
        <span className="mt-0.5 block truncate text-[9px] text-zinc-600">{props.description}</span>
      </span>
      {props.strictUi && (
        <Tooltip delay={350}>
          <span className="flex shrink-0 items-center gap-1 text-[9px] text-emerald-400/80">
            <ShieldCheck size={12} /> Strict UI
          </span>
          <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[9px] text-zinc-200 shadow-xl">Only controls that map deterministically to Tailwind CSS</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
