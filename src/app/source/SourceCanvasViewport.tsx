import { useEffect, useRef, useState } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import { PreviewCanvas } from "../components/PreviewCanvas";
import { SourceViewportPicker } from "./SourceViewportPicker";
import type { SourceTreeNode } from "./source-workspace-tree";
import { defaultSourceViewport, sourceViewportPresets } from "./source-viewports";

const sourcePreviewId = "source-preview";

export function SourceCanvasViewport(props: {
  children: (frame: { width: number; height: number }) => React.ReactNode;
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onModeChange: (mode: "preview" | "code") => void;
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
        cameraKey={`${props.device}:${presetId}`}
        preview={(
          <div
            data-design-space-instance-id={sourcePreviewId}
            className="overflow-hidden rounded-md border border-white/20 bg-white shadow-2xl"
            style={{ width: frame.width, height: frame.height }}
          >
            {props.children(frame)}
          </div>
        )}
        rootInstanceId={sourcePreviewId}
        selectedComponentInstanceId={sourcePreviewId}
        selection={{ kind: "component", id: sourcePreviewId }}
        selectionLabel={`${preset.label.replace("Responsive", `Responsive · ${responsiveWidth} × ${preset.height}`)}`}
        slots={[]}
        worldWidth={frame.width}
        onSelect={() => undefined}
      />
      <SourceViewportPicker
        device={props.device}
        node={props.node}
        presetId={presetId}
        responsiveWidth={responsiveWidth}
        onDeviceChange={changeDevice}
        onModeChange={props.onModeChange}
        onPresetChange={changePreset}
        onResponsiveWidthChange={(width) => setResponsiveWidth(Math.max(320, Math.min(1440, width)))}
      />
    </div>
  );
}
