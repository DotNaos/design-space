import { useEffect, useRef, useState } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { CanvasWorldRect } from "../canvas-transform";
import { PreviewCanvas } from "../components/PreviewCanvas/PreviewCanvas";
import { SourceCanvasAncestryHeader } from "./SourceCanvasAncestryHeader";
import { SourceDeviceTabs } from "./SourceDeviceTabs";
import { SourceDeviceFrame } from "./SourceDeviceFrame";
import { SourceViewportPicker } from "./SourceViewportPicker";
import { SourcePreviewModeToggle } from "./SourcePreviewModeToggle";
import type { SourcePreviewMode } from "./source-layer-design";
import type { SourcePreviewContentSize } from "./source-preview-content-size";
import type { SourceTreeNode } from "./source-workspace-tree";
import { sourceDeviceFrameKind, sourceDeviceFrameLayout } from "./source-device-frame";
import { defaultSourceViewport, sourceViewportPresets } from "./source-viewports";
import type { SourceCanvasAncestryItem, SourceCanvasSlotTab } from "./source-canvas-ancestry";

const sourcePreviewId = "source-preview";

export function SourceCanvasViewport(props: {
  children: (frame: { width: number; height: number }) => React.ReactNode;
  ancestry?: readonly SourceCanvasAncestryItem[];
  compact?: boolean;
  contentSize?: SourcePreviewContentSize;
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  mode?: SourcePreviewMode;
  showModeToggle?: boolean;
  selectedLayer?: boolean;
  selectionKey?: string;
  selectionLabel?: string;
  slotOwnerLabel?: string;
  slotTabs?: readonly SourceCanvasSlotTab[];
  hud?: React.ReactNode;
  revealTarget?: { key: string; rect: CanvasWorldRect };
  toolbarEnd?: React.ReactNode;
  onSelectAncestry?: (item: SourceCanvasAncestryItem) => void;
  onSelectSlot?: (slot: SourceCanvasSlotTab) => void;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onModeChange?: (mode: SourcePreviewMode) => void;
}) {
  const [presetId, setPresetId] = useState(() => defaultSourceViewport(props.device).id);
  const [responsiveWidth, setResponsiveWidth] = useState(960);
  const [clipToScreen, setClipToScreen] = useState(true);
  const [showDeviceFrame, setShowDeviceFrame] = useState(false);
  const previousDevice = useRef(props.device);
  const preset = sourceViewportPresets.find((candidate) => candidate.id === presetId) ?? defaultSourceViewport(props.device);
  const screenFrame = { width: preset.id === "responsive" ? responsiveWidth : preset.width, height: preset.height };
  const frame = !clipToScreen && props.contentSize ? props.contentSize : screenFrame;
  const deviceFrameKind = sourceDeviceFrameKind(props.device);
  const deviceFrame = showDeviceFrame ? sourceDeviceFrameLayout(deviceFrameKind, frame.width, frame.height) : undefined;
  const previewFrame = deviceFrame
    ? { width: deviceFrame.outerWidth, height: deviceFrame.outerHeight }
    : frame;
  const hasCanvasDeviceSwitcher = Boolean(props.ancestry?.length && props.node);
  const ancestryHeight = props.ancestry?.length ? props.slotTabs?.length ? 64 : 36 : 0;

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
        cameraKey={`${props.device}:${presetId}:${clipToScreen ? "screen" : "content"}:${showDeviceFrame ? "device" : "plain"}:${props.selectionKey ?? props.node?.id ?? "source"}`}
        revealTarget={props.revealTarget}
        toolbar={(
          <SourceViewportPicker
            device={props.device}
            node={props.node}
            presetId={presetId}
            responsiveWidth={responsiveWidth}
            clipToScreen={clipToScreen}
            showDeviceFrame={showDeviceFrame}
            onDeviceChange={changeDevice}
            onPresetChange={changePreset}
            onResponsiveWidthChange={(width) => setResponsiveWidth(Math.max(320, Math.min(1440, width)))}
            showDeviceTabs={!hasCanvasDeviceSwitcher}
            onClipToScreenChange={setClipToScreen}
            onShowDeviceFrameChange={setShowDeviceFrame}
            after={(
              <>
                {props.showModeToggle !== false && props.mode && props.onModeChange ? <SourcePreviewModeToggle mode={props.mode} onChange={props.onModeChange} /> : null}
                {props.toolbarEnd}
              </>
            )}
          />
        )}
        preview={showDeviceFrame ? (
          <SourceDeviceFrame kind={deviceFrameKind} screenHeight={frame.height} screenWidth={frame.width}>
            <PreviewScreen attachedHeader={ancestryHeight > 0} clipToScreen={clipToScreen} frame={frame}>
              {props.children(frame)}
            </PreviewScreen>
          </SourceDeviceFrame>
        ) : (
          <PreviewScreen attachedHeader={ancestryHeight > 0} clipToScreen={clipToScreen} frame={frame}>
            {props.children(frame)}
          </PreviewScreen>
        )}
        rootInstanceId={sourcePreviewId}
        selectedComponentInstanceId={sourcePreviewId}
        selection={props.selectedLayer ? undefined : { kind: "component", id: sourcePreviewId }}
        selectionLabel={props.selectionLabel ?? `${preset.label.replace("Responsive", `Responsive · ${responsiveWidth} × ${preset.height}`)}`}
        hud={props.hud}
        slots={[]}
        staticPreview
        forcedInteractionMode={props.mode === "play" ? "interact" : "select"}
        compact={props.compact}
        verticalAlignment="start"
        worldHeader={props.ancestry?.length ? (
          <SourceCanvasAncestryHeader
            deviceSwitcher={hasCanvasDeviceSwitcher ? (
              <SourceDeviceTabs device={props.device} node={props.node} onChange={changeDevice} />
            ) : undefined}
            items={props.ancestry}
            slotOwnerLabel={props.slotOwnerLabel}
            slots={props.slotTabs}
            onSelect={props.onSelectAncestry}
            onSelectSlot={props.onSelectSlot}
          />
        ) : undefined}
        worldHeaderHeight={ancestryHeight}
        worldWidth={previewFrame.width}
        onSelect={() => undefined}
      />
    </div>
  );
}

function PreviewScreen(props: {
  attachedHeader: boolean;
  children: React.ReactNode;
  clipToScreen: boolean;
  frame: { height: number; width: number };
}) {
  return (
    <div
      data-design-space-instance-id={sourcePreviewId}
      data-preview-frame-mode={props.clipToScreen ? "screen" : "content"}
      className={`${props.clipToScreen ? "overflow-hidden" : "overflow-visible"} size-full ${props.attachedHeader ? "rounded-b-md" : "rounded-md"} border border-white/15 bg-[#111216] shadow-2xl`}
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
