import { AlertTriangle, Info } from "lucide-react";

import { describeStrictUiMarker, type StrictUiMarker } from "./strict-ui-markers";

export function StrictUiIndicator(props: {
  marker: StrictUiMarker;
  decorative?: boolean;
}) {
  const Icon = props.marker.severity === "info" ? Info : AlertTriangle;
  return (
    <span
      aria-hidden={props.decorative || undefined}
      aria-label={props.decorative ? undefined : describeStrictUiMarker(props.marker)}
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold ${tone(props.marker.severity)}`}
      data-strict-ui-count={props.marker.violations.length}
      data-strict-ui-severity={props.marker.severity}
      role={props.decorative ? undefined : "img"}
    >
      <Icon size={10} strokeWidth={2.5} />
      {props.marker.violations.length > 1 && <span>{props.marker.violations.length}</span>}
    </span>
  );
}

export function strictUiOutlineTone(severity: StrictUiMarker["severity"]): string {
  if (severity === "error") return "border-rose-400/80";
  if (severity === "warning") return "border-amber-400/80";
  return "border-sky-400/80";
}

function tone(severity: StrictUiMarker["severity"]): string {
  if (severity === "error") return "bg-rose-500 text-white";
  if (severity === "warning") return "bg-amber-400 text-amber-950";
  return "bg-sky-400 text-sky-950";
}
