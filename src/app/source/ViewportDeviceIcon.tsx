
import { Monitor, Scaling, Smartphone, Tablet } from "lucide-react";
import { type SourceViewportPreset } from "./source-viewports";

export function ViewportDeviceIcon(props: { device: SourceViewportPreset["device"]; className?: string }) {
  const iconProps = { "aria-hidden": true as const, className: props.className, size: 12, strokeWidth: 1.8 };
  if (props.device === "desktop") return <Monitor {...iconProps} />;
  if (props.device === "tablet") return <Tablet {...iconProps} />;
  if (props.device === "mobile") return <Smartphone {...iconProps} />;
  return <Scaling {...iconProps} />;
}
