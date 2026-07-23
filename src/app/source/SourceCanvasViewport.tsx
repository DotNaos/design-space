import { useEffect, useRef, useState } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import { PreviewCanvas } from "../components/PreviewCanvas/PreviewCanvas";
import { SourceViewportPicker } from "./SourceViewportPicker";
import { SourcePreviewModeToggle } from "./SourcePreviewModeToggle";
import type { SourcePreviewMode } from "./source-layer-design";
import type { SourceTreeNode } from "./source-workspace-tree";
import { defaultSourceViewport, sourceViewportPresets } from "./source-viewports";

const sourcePreviewId = "source-preview";

export function SourceCanvasViewport(props: {
  children: (frame: { width: number; height: number }) => React.ReactNode;
  compact?: boolean;
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  mode?: SourcePreviewMode;
  selectedLayer?: boolean;
  selectionKey?: string;
  selectionLabel?: string;
  toolbarEnd?: React.ReactNode;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onModeChange?: (mode: SourcePreviewMode) => void;
}) {
  const [presetId, setPresetId] = useState(() => defaultSourceViewport(props.device).id);
  const [responsiveWidth, setResponsiveWidth] = useState(960);
  const previousDevice = useRef(props.device);
  const preset = sourceViewportPresets.find((candidate) => candidate.id === presetId) ?? defaultSourceViewport(props.device);
  const frame = { width: preset.id === "responsive" ? responsiveWidth : preset.width, height: preset.height };

  useEffect(() => {
    if (previousDevice.current === props.device) return;
    previousDevice.current = props.device;
    const selectedPreset = sourceViewportPresets.find((candidate) => candidate.id === presetId);
    if (selectedPreset?.device !== props.device) setPresetId(defaultSourceViewport(props.device).id);
  }, [presetId, props.device]);

  const changeDevice = (device: DesignSpaceDevice) => {
    setPresetId(defaultSourceViewport(device).id);
    props.onDeviceChange(device);
  };
  const changePreset = (id: string) => {
    setPresetId(id);
    const next = sourceViewportPresets.find((candidate) => candidate.id === id);
    if (next && next.device !== "responsive" && next.device !== props.device) props.onDeviceChange(next.device);
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1">
      <PreviewCanvas
        cameraKey={`${props.device}:${presetId}:${props.selectionKey ?? props.node?.id ?? "source"}`}
        toolbar={(
          <SourceViewportPicker
            device={props.device}
            node={props.node}
            presetId={presetId}
            responsiveWidth={responsiveWidth}
            onDeviceChange={changeDevice}
            onPresetChange={changePreset}
            onResponsiveWidthChange={(width) => setResponsiveWidth(Math.max(320, Math.min(1440, width)))}
            after={(
              <>
                {props.mode && props.onModeChange ? <SourcePreviewModeToggle mode={props.mode} onChange={props.onModeChange} /> : null}
                {props.toolbarEnd}
              </>
            )}
          />
        )}
        preview={(
          <div
            data-design-space-instance-id={sourcePreviewId}
            className="overflow-hidden rounded-md border border-white/15 bg-[#111216] shadow-2xl"
            style={{
              backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.055) 0, rgba(255,255,255,.055) 9px, rgba(255,255,255,.012) 9px, rgba(255,255,255,.012) 20px)",
              height: frame.height,
              width: frame.width,
            }}
          >
            {props.children(frame)}
          </div>
        )}
        rootInstanceId={sourcePreviewId}
        selectedComponentInstanceId={sourcePreviewId}
        selection={props.selectedLayer ? undefined : { kind: "component", id: sourcePreviewId }}
        selectionLabel={props.selectionLabel ?? `${preset.label.replace("Responsive", `Responsive · ${responsiveWidth} × ${preset.height}`)}`}
        slots={[]}
        staticPreview
        forcedInteractionMode={props.mode === "play" ? "interact" : "select"}
        compact={props.compact}
        worldWidth={frame.width}
        onSelect={() => undefined}
      />
    </div>
  );
}
