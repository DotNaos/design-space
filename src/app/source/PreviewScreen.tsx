
import { sourcePreviewId } from "./SourceCanvasViewport";

export function PreviewScreen(props: {
  attachedHeader: boolean;
  children: React.ReactNode;
  clipToScreen: boolean;
  frame: { height: number; width: number };
}) {
  return (
    <div
      data-design-space-instance-id={sourcePreviewId}
      data-preview-frame-mode={props.clipToScreen ? "screen" : "content"}
      className={`${props.clipToScreen ? "overflow-hidden" : "overflow-visible"} size-full ${props.attachedHeader ? "rounded-b-md" : "rounded-md shadow-2xl"} border border-white/15 bg-[#111216]`}
      style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)",
        backgroundPosition: "-1px -1px",
        backgroundSize: "32px 32px",
        height: props.frame.height,
        width: props.frame.width,
      }}
    >
      {props.children}
    </div>
  );
}
