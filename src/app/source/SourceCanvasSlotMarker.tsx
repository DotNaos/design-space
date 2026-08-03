
import type { SourceSlotScope } from "./source-slot-navigation";
import { sourceCanvasSharedPattern, sourceCanvasSlotPattern } from "./source-static-preview";

export function SourceCanvasSlotMarker(props: { fill?: boolean; label: string; layerId: string; scope?: SourceSlotScope }) {
  const shared = props.scope === "shared";
  return (
    <span
      aria-label={`${props.label} slot`}
      data-design-space-source-layer-id={props.layerId}
      data-design-space-source-slot-name={props.label}
      role="region"
      style={{
        alignItems: "center",
        backgroundColor: shared ? "rgba(14, 116, 144, .12)" : "rgba(88, 28, 135, .16)",
        backgroundImage: shared ? sourceCanvasSharedPattern : sourceCanvasSlotPattern,
        backgroundPosition: "0 0",
        backgroundSize: "28px 28px",
        border: shared ? "1px solid rgba(125, 211, 252, .38)" : "1px solid rgba(192, 132, 252, .38)",
        borderRadius: 10,
        boxSizing: "border-box",
        color: shared ? "#7dd3fc" : "#c4b5fd",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        height: props.fill ? "100%" : undefined,
        justifyContent: "center",
        minHeight: props.fill ? "100%" : "clamp(64px, 18vh, 144px)",
        minWidth: 96,
        padding: 12,
        width: "100%",
      }}
    >
      <strong style={{ font: "600 12px/1.4 ui-monospace, SFMono-Regular, monospace" }}>{props.label}</strong>
      <span style={{ color: "#71717a", font: "10px/1.4 ui-sans-serif, system-ui, sans-serif" }}>Empty slot</span>
    </span>
  );
}
