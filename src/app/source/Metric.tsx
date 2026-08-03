
import { formatMetric } from "./SourceLayerDesignInspector";

export function Metric(props: { label: string; value?: number }) {
  return (
    <div className="flex h-8 items-center gap-1 rounded-lg bg-black/20 px-2">
      <span className="text-[9px] text-zinc-600">{props.label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-zinc-400">{formatMetric(props.value)}</span>
    </div>
  );
}
