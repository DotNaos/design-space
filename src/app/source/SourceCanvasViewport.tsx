import { useEffect, useRef, useState } from "react";

import type { DesignSpaceDevice } from "../../shared/source-workspace";
import type { CanvasWorldRect } from "../canvas-transform";
import { PreviewCanvas } from "../components/PreviewCanvas/PreviewCanvas";
import { SourceCanvasAncestryHeader } from "./SourceCanvasAncestryHeader";
import { SourceDeviceTabs } from "./SourceDeviceTabs";
import { SourceDeviceFrame } from "./SourceDeviceFrame";
import { SourceViewportPicker } from "./SourceViewportPicker";
import { SourcePreviewModeToggle } from "./SourcePreviewModeToggle";
import { SourceReviewGraphModeControl, SourceReviewGraphStage, type SourceReviewGraph, type SourceReviewGraphLayout } from "./SourceReviewGraphStage";
import type { SourcePreviewMode } from "./source-layer-design";
import type { SourcePreviewContentSize } from "./source-preview-content-size";
import type { SourceTreeNode } from "./source-workspace-tree";
import { sourceDeviceFrameKind, sourceDeviceFrameLayout } from "./source-device-frame";
import { defaultSourceViewport, sourceViewportPresets } from "./source-viewports";
import type { SourceCanvasAncestryItem, SourceCanvasSlotTab } from "./source-canvas-ancestry";
import { PreviewScreen } from "./PreviewScreen";

export const sourcePreviewId = "source-preview";

export function SourceCanvasViewport(props: {
  children: (frame: { width: number; height: number }) => React.ReactNode;
  ancestry?: readonly SourceCanvasAncestryItem[];
  compact?: boolean;
  contentSize?: SourcePreviewContentSize;
  device: DesignSpaceDevice;
  node?: SourceTreeNode;
  mode?: SourcePreviewMode;
  showChrome?: boolean;
  showModeToggle?: boolean;
  showDeviceSwitcher?: boolean;
  selectedLayer?: boolean;
  selectionKey?: string;
  selectionLabel?: string;
  slotOwnerLabel?: string;
  slotTabs?: readonly SourceCanvasSlotTab[];
  hud?: React.ReactNode;
  footer?: React.ReactNode;
  revealTarget?: { key: string; rect: CanvasWorldRect };
  reviewGraph?: SourceReviewGraph;
  toolbarEnd?: React.ReactNode;
  toolbarSigning?: React.ReactNode;
  onSelectAncestry?: (item: SourceCanvasAncestryItem) => void;
  onSelectSlot?: (slot: SourceCanvasSlotTab) => void;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onModeChange?: (mode: SourcePreviewMode) => void;
}) {
  const showChrome = props.showChrome !== false;
  const [presetId, setPresetId] = useState(() => defaultSourceViewport(props.device).id);
  const [responsiveWidth, setResponsiveWidth] = useState(960);
  const [clipToScreen, setClipToScreen] = useState(true);
  const [showDeviceFrame, setShowDeviceFrame] = useState(false);
  const [reviewGraphLayout, setReviewGraphLayout] = useState<SourceReviewGraphLayout>("vertical");
  const previousDevice = useRef(props.device);
  const preset = sourceViewportPresets.find((candidate) => candidate.id === presetId) ?? defaultSourceViewport(props.device);
  const screenFrame = { width: preset.id === "responsive" ? responsiveWidth : preset.width, height: preset.height };
  const frame = !clipToScreen && props.contentSize ? props.contentSize : screenFrame;
  const deviceFrameKind = sourceDeviceFrameKind(props.device);
  const deviceFrame = showDeviceFrame ? sourceDeviceFrameLayout(deviceFrameKind, frame.width, frame.height) : undefined;
  const previewFrame = deviceFrame
    ? { width: deviceFrame.outerWidth, height: deviceFrame.outerHeight }
    : frame;
  const graphInsets = showChrome && props.reviewGraph && props.mode !== "play"
    ? sourceReviewGraphInsets(reviewGraphLayout)
    : { bottom: 0, left: 0, right: 0, top: 0 };
  const graphFrame = {
    height: previewFrame.height,
    left: graphInsets.left,
    top: graphInsets.top,
    width: previewFrame.width,
  };
  const canvasWorld = {
    height: previewFrame.height + graphInsets.top + graphInsets.bottom,
    width: previewFrame.width + graphInsets.left + graphInsets.right,
  };
  const showDeviceSwitcher = props.showDeviceSwitcher !== false;
  const hasCanvasDeviceSwitcher = showChrome && showDeviceSwitcher && Boolean(props.ancestry?.length && props.node);
  const ancestryHeight = showChrome && props.ancestry?.length ? 36 : 0;

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
        cameraKey={`${props.device}:${presetId}:${clipToScreen ? "screen" : "content"}:${showDeviceFrame ? "device" : "plain"}:${reviewGraphLayout}:${props.selectionKey ?? props.node?.id ?? "source"}`}
        revealTarget={props.revealTarget}
        canvasHeader={showChrome && props.ancestry?.length ? (
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
        canvasHeaderHeight={ancestryHeight}
        toolbar={showChrome ? (
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
            showDeviceTabs={showDeviceSwitcher && !hasCanvasDeviceSwitcher}
            onClipToScreenChange={setClipToScreen}
            onShowDeviceFrameChange={setShowDeviceFrame}
            after={(
              <>
                {props.showModeToggle !== false && props.mode && props.onModeChange ? <SourcePreviewModeToggle mode={props.mode} onChange={props.onModeChange} /> : null}
                {props.toolbarEnd}
                {props.reviewGraph && props.mode !== "play" ? (
                  <SourceReviewGraphModeControl layout={reviewGraphLayout} onChange={setReviewGraphLayout} />
                ) : null}
              </>
            )}
          />
        ) : undefined}
        toolbarSigning={showChrome ? props.toolbarSigning : undefined}
        preview={(
          <div className="relative" style={{ height: canvasWorld.height, width: canvasWorld.width }}>
            <div className="absolute" style={{ left: graphFrame.left, top: graphFrame.top }}>
              {showDeviceFrame ? (
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
            </div>
            {showChrome && props.reviewGraph && props.mode !== "play" ? (
              <div className="absolute inset-0" data-testid="source-review-graph-world">
                <SourceReviewGraphStage frame={graphFrame} graph={props.reviewGraph} layout={reviewGraphLayout} />
              </div>
            ) : null}
          </div>
        )}
        rootInstanceId={sourcePreviewId}
        selectedComponentInstanceId={sourcePreviewId}
        selection={showChrome && !props.selectedLayer ? { kind: "component", id: sourcePreviewId } : undefined}
        selectionLabel={props.selectionLabel ?? `${preset.label.replace("Responsive", `Responsive · ${responsiveWidth} × ${preset.height}`)}`}
        hud={showChrome ? props.hud : undefined}
        slots={[]}
        staticPreview
        forcedInteractionMode={props.mode === "play" ? "interact" : "select"}
        compact={props.compact}
        showControls={showChrome}
        verticalAlignment="start"
        worldFooter={showChrome ? props.footer : undefined}
        worldFooterHeight={32}
        pinWorldFooter
        worldHeight={canvasWorld.height}
        worldWidth={canvasWorld.width}
        onSelect={() => undefined}
      />
    </div>
  );
}

function sourceReviewGraphInsets(layout: SourceReviewGraphLayout) {
  if (layout === "focus") return { bottom: 0, left: 0, right: 0, top: 52 };
  if (layout === "horizontal") return { bottom: 44, left: 220, right: 220, top: 52 };
  return { bottom: 88, left: 0, right: 0, top: 116 };
}
