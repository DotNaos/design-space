
import { TriangleAlert } from "lucide-react";
import { type SourceWorkspaceLayer } from "../../shared/source-workspace";

export function SlotStatus({ layer }: { layer: SourceWorkspaceLayer }) {
  const usage = layer.slot!;
  const max = usage.contract.max ?? "∞";
  const warning = usage.validity === "missing" || usage.validity === "incompatible";
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[9px] tabular-nums ${warning ? "text-amber-300" : "text-zinc-600"}`}>
      {warning && <TriangleAlert aria-hidden="true" size={10} />}
      {usage.received.length}/{max}
      <span className="sr-only">{usage.validity}</span>
    </span>
  );
}
