
import { Route } from "lucide-react";

export function CaseLabel(props: { count: number; index: number; selected?: string }) {
  return (
    <div className="flex max-w-72 min-w-0 items-center gap-2 px-2">
      <Route aria-hidden="true" className="shrink-0 text-violet-300" size={12} />
      <span className="min-w-0 truncate text-[10px] font-medium text-zinc-100">{props.selected ?? "Structure"}</span>
      <span className="shrink-0 text-[8px] tabular-nums text-zinc-600">{props.count ? `${props.index + 1}/${props.count}` : "Static"}</span>
    </div>
  );
}
