import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { WandSparkles } from "lucide-react";
import { Button } from "@heroui/react";

import type {
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import type { ComponentDesignDefinition } from "../../shared/component-design";
import { SourceCanvasViewport } from "./SourceCanvasViewport";
import { SourceCanvasContextHud } from "./SourceCanvasContextHud";
import { SourceCanvasFeedbackDock } from "./SourceCanvasFeedbackDock";
import { sourceCanvasAnnotationTargetAtPoint, SourceCanvasAnnotationOverlay, useSourceCanvasAnnotations } from "./SourceCanvasAnnotations";
import { SourceDesignControls } from "./SourceDesignControls";
import { SourceHoverIdentityHud } from "./SourceHoverIdentityHud";
import { SourcePreviewState as PreviewState } from "./SourcePreviewState";
import { sourceFeedbackContext } from "./source-feedback";
import { SourceInstanceNavigator } from "./SourceInstanceNavigator";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";
import { sourceLayerHitAtPreviewPoint, type SourceLayerHit } from "./source-preview-hit-testing";
import { measureSourcePreviewContent, type SourcePreviewContentSize } from "./source-preview-content-size";
import { externalSourceLayerOwner, sourceEntryOwner, sourceLayerOwner } from "./source-layer-ownership";
import { mountSourceLayerHover, mountSourceLayerSelection, sourceLayerElement, sourceLayerElements } from "./source-preview-selection-overlay";
import { sourceCanvasVisualLayer } from "./source-canvas-selection";
import { renderStaticSourceDesignMarkup, renderStaticSourcePreviewMarkup, SourcePreviewContent } from "./source-static-preview";
import type { SourcePreviewFrameProps } from "./source-preview-frame-props";
import { SourceComponentReviewCheckpoint } from "./SourceComponentReviewCheckpoint";
import { sourceReviewGraphProperties, sourceReviewGraphSlots } from "./source-review-graph";

export function sourceStaticProjectionLayerId(options: {
  entry?: RuntimeSourceWorkspaceEntry;
  isolateSelectedLayer?: boolean;
  selectedCase?: string;
  selectedLayer?: SourceWorkspaceLayer;
}): string | undefined {
  return options.isolateSelectedLayer !== false
    && options.entry
    && options.selectedLayer?.kind === "html"
    && options.selectedCase
    ? options.selectedLayer.id
    : undefined;
}

export function SourcePreviewFrame(props: SourcePreviewFrameProps) {
  const [mounts, setMounts] = useState<PreviewMounts>();
  const [loaded, setLoaded] = useState<LoadedDesign>();
  const [loadState, setLoadState] = useState<"checking" | "invalid" | "ready">("checking");
  const [loadMessage, setLoadMessage] = useState<string>();
  const [caseByDesign, setCaseByDesign] = useState<Readonly<Record<string, string>>>({});
  const [matrixByDesign, setMatrixByDesign] = useState<Readonly<Record<string, boolean>>>({});
  const [staticRevision, setStaticRevision] = useState(0);
  const [hoveredLayerHit, setHoveredLayerHit] = useState<SourceLayerHit>();
  const [selectedLayerHit, setSelectedLayerHit] = useState<(SourceLayerHit & { entryId: string })>();
  const [selectedLayerOccurrenceCount, setSelectedLayerOccurrenceCount] = useState(0);
  const [contentSize, setContentSize] = useState<SourcePreviewContentSize>();
  const [revealTarget, setRevealTarget] = useState<{ key: string; rect: SourceLayerMetrics }>();
  const canvasAnnotations = useSourceCanvasAnnotations(props.entry?.id);
  const previewMode: SourcePreviewMode | "static" = props.mode ?? (props.selectionMode ? "design" : "static");
  const feedbackContext = sourceFeedbackContext(props.entry, props.selectedLayer);
  const previewEntries = useMemo(() => props.entries ?? (props.entry ? [props.entry] : []), [props.entries, props.entry]);
  const selectableLayerIds = useMemo(() => new Set([
    ...sourceLayerIds(previewEntries),
    ...(props.slotLayers ?? []).map((slot) => slot.id),
  ]), [previewEntries, props.slotLayers]);
  const externallyHoveredLayerHit = useMemo(() => props.hoveredLayer ? {
    layerId: props.hoveredLayer.id,
    occurrence: props.hoveredLayerOccurrence ?? 0,
  } : undefined, [props.hoveredLayer, props.hoveredLayerOccurrence]);
  const visibleHoveredLayerHit = hoveredLayerHit ?? externallyHoveredLayerHit;
  const hoveredLayer = useMemo(() => (
    visibleHoveredLayerHit
      ? findPreviewLayer(previewEntries, visibleHoveredLayerHit.layerId)
        ?? props.slotLayers?.find((slot) => slot.id === visibleHoveredLayerHit.layerId)
      : undefined
  ), [previewEntries, props.slotLayers, visibleHoveredLayerHit]);
  const selectedOwner = useMemo(() => props.selectedLayer
    ? sourceLayerOwner(previewEntries, props.selectedLayer.id)
      ?? (props.selectedLayer.kind === "slot" && props.entry ? sourceEntryOwner(props.entry) : undefined)
    : props.entry ? sourceEntryOwner(props.entry) : undefined,
  [previewEntries, props.entry, props.selectedLayer]);
  const hoveredExternalOwner = useMemo(() => visibleHoveredLayerHit && props.onOpenLayerOwner
    ? externalSourceLayerOwner(props.entry, previewEntries, visibleHoveredLayerHit.layerId)
    : undefined,
  [previewEntries, props.entry, props.onOpenLayerOwner, visibleHoveredLayerHit]);
  const defaultVisualLayer = sourceCanvasVisualLayer(props.entry, undefined);
  const canvasSlotTabs = useMemo(() => (props.slotLayers ?? []).map((slot) => ({
    active: props.selectedLayer?.id === slot.id,
    id: slot.id,
    label: slot.label,
    scope: props.slotScopes?.[slot.id] ?? "tree",
  })), [props.selectedLayer?.id, props.slotLayers, props.slotScopes]);
  const designId = props.entry?.design?.fileId;
  const structuralDesign = props.workspaceMode === "design";
  useEffect(() => {
    if (structuralDesign) {
      setLoaded(undefined);
      setLoadState("checking");
      setLoadMessage(undefined);
      return;
    }
    const design = props.entry?.design;
    if (!design) {
      setLoaded(undefined);
      setLoadState("checking");
      setLoadMessage(undefined);
      return;
    }
    let active = true;
    setLoadState("checking");
    void design.load().then((definition) => {
      if (!active) return;
      const message = invalidDesignMessage(definition);
      if (message) {
        setLoadState("invalid");
        setLoadMessage(message);
        return;
      }
      setLoaded({ designId: design.fileId, definition });
      setLoadState("ready");
      setLoadMessage(undefined);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadState("invalid");
      setLoadMessage(error instanceof Error ? error.message : "The colocated design could not be loaded.");
    });
    return () => { active = false; };
  }, [designId, props.entry?.design, structuralDesign]);
  const activeLoaded = loaded?.designId === designId ? loaded : undefined;
  const definition = activeLoaded?.definition;
  const caseNames = useMemo(() => Object.keys(definition?.cases ?? {}), [definition]);
  const requestedCase = props.selectedDesignCase ?? caseByDesign[designId ?? ""];
  const selectedCase = definition && caseNames.includes(requestedCase ?? "")
    ? requestedCase!
    : definition?.initialCase;
  const selectDesignCase = useCallback((next: string) => {
    if (designId) setCaseByDesign((current) => ({ ...current, [designId]: next }));
    props.onDesignCaseChange?.(next);
  }, [designId, props.onDesignCaseChange]);
  const reviewGraph = props.entry ? {
    caseNames: structuralDesign ? [] : caseNames,
    componentLabel: props.entry.label,
    isStateful: definition?.isStateful ?? false,
    properties: sourceReviewGraphProperties({
      caseValues: selectedCase ? definition?.cases[selectedCase] : undefined,
      defaults: definition?.defaults,
      entry: props.entry,
    }),
    selectedCase: structuralDesign ? undefined : selectedCase,
    slots: sourceReviewGraphSlots({
      entry: props.entry,
      selectedLayerId: props.selectedLayer?.id,
      slotLayers: props.slotLayers,
    }),
    onCaseChange: structuralDesign ? undefined : selectDesignCase,
    onSelectSlot: (slotId: string) => props.onSelectLayer?.(slotId, 0),
  } : undefined;
  const matrixAvailable = Boolean(props.entry?.props.some((property) => (property.values?.length ?? 0) > 1));
  const matrix = Boolean(designId && matrixByDesign[designId] && !props.selectedLayer);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const selectionSurfaceRef = useRef<HTMLDivElement | null>(null);
  const previewState = structuralDesign && props.entry ? undefined : unavailablePreviewState({
    ...props,
    definition,
    loadMessage,
    loadState,
  });
  const projectionLayerId = sourceStaticProjectionLayerId({
    entry: props.entry,
    isolateSelectedLayer: props.isolateSelectedLayer,
    selectedCase,
    selectedLayer: props.selectedLayer,
  });
  const projectionKey = projectionLayerId && props.entry && selectedCase
    ? `${props.entry.id}:${projectionLayerId}:${selectedCase}`
    : undefined;
  const loadFrame = useCallback((node: HTMLIFrameElement | null) => {
    frameRef.current = node;
    if (!node) {
      setMounts(undefined);
      return;
    }
    node.inert = true;
    node.setAttribute("inert", "");
    const update = () => {
      const document = node.contentDocument;
      const output = document?.getElementById("design-space-preview-root");
      const staging = document?.getElementById("design-space-preview-staging");
      const styles = document?.getElementById("design-space-preview-styles");
      setMounts(output && staging && styles ? { output, staging, styles } : undefined);
    };
    node.addEventListener("load", update, { once: true });
    update();
  }, []);

  useEffect(() => {
    if (!mounts || previewMode === "play" || !props.entry || (!structuralDesign && (!definition || !selectedCase))) return;
    let active = true;
    mounts.output.replaceChildren();
    mounts.staging.replaceChildren();
    const render = structuralDesign
      ? renderStaticSourceDesignMarkup({
        entry: props.entry,
        slotLayers: props.slotLayers ?? [],
        slotScopes: props.slotScopes,
      })
      : renderStaticSourcePreviewMarkup({
        caseName: selectedCase!, centered: props.centerContent, definition: definition!, entry: props.entry,
        matrix, slotLayers: props.slotLayers,
      });
    void render.then((markup) => {
      if (!active) return;
      mounts.staging.innerHTML = markup;
      if (projectionLayerId) {
        if (!projectSourceLayer(mounts.staging, mounts.output, projectionLayerId)) {
          showStaticPreviewMessage(mounts.output, "This HTML layer is not rendered in the current state.");
        }
      } else {
        mounts.output.innerHTML = mounts.staging.innerHTML;
      }
      setStaticRevision((current) => current + 1);
    }).catch((error: unknown) => {
      if (!active) return;
      showStaticPreviewMessage(mounts.output, error instanceof Error ? error.message : "The static design could not be rendered.", true);
    });
    return () => { active = false; };
  }, [definition, matrix, mounts, previewMode, projectionLayerId, props.centerContent, props.entry, props.slotLayers, props.slotScopes, selectedCase, structuralDesign]);

  const selectStaticLayer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const hit = sourceLayerHitAtPreviewPoint(frame, event, selectableLayerIds, defaultVisualLayer?.id);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    if (!props.onSelectLayer) return;
    setSelectedLayerHit({ ...hit, entryId: props.entry?.id ?? "" });
    props.onSelectLayer(hit.layerId, hit.occurrence);
  };
  const annotateStaticLayer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    const surface = selectionSurfaceRef.current;
    if (!frame || !surface || !props.entry) return;
    const hit = sourceLayerHitAtPreviewPoint(frame, event, selectableLayerIds, defaultVisualLayer?.id);
    const layer = hit
      ? findPreviewLayer(previewEntries, hit.layerId) ?? props.slotLayers?.find((slot) => slot.id === hit.layerId)
      : defaultVisualLayer;
    const context = sourceFeedbackContext(props.entry, layer);
    if (!context) return;
    event.preventDefault();
    event.stopPropagation();
    canvasAnnotations.begin(sourceCanvasAnnotationTargetAtPoint({
      context,
      element: sourceCanvasLayerLabel(layer) ?? context.label,
      event,
      occurrence: hit?.occurrence ?? 0,
      surface,
    }));
  };
  const openStaticLayerOwner = (event: ReactMouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame || !props.onOpenLayerOwner) return;
    const hit = sourceLayerHitAtPreviewPoint(frame, event, selectableLayerIds, defaultVisualLayer?.id);
    if (!hit) return;
    const owner = externalSourceLayerOwner(props.entry, previewEntries, hit.layerId);
    if (!owner) return;
    event.preventDefault();
    event.stopPropagation();
    props.onOpenLayerOwner(owner.entryId, hit.layerId, hit.occurrence);
  };

  const hoverStaticLayer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const hit = sourceLayerHitAtPreviewPoint(frame, event, selectableLayerIds, defaultVisualLayer?.id);
    setHoveredLayerHit((current) => current?.layerId === hit?.layerId && current?.occurrence === hit?.occurrence ? current : hit);
  };

  const selectedOccurrence = props.selectedLayerOccurrence ?? (selectedLayerHit
    && selectedLayerHit.entryId === props.entry?.id
    && selectedLayerHit.layerId === props.selectedLayer?.id
    ? selectedLayerHit.occurrence
    : 0);
  const revealKey = props.revealSelectedLayerKey !== undefined && props.selectedLayer?.kind === "component"
    ? `${props.entry?.id ?? "source"}:${props.selectedLayer.id}:${selectedOccurrence}:${props.revealSelectedLayerKey}`
    : undefined;

  useLayoutEffect(() => {
    if (!mounts || previewMode !== "design" || !props.selectedLayer) {
      setSelectedLayerOccurrenceCount(0);
      return;
    }
    setSelectedLayerOccurrenceCount(sourceLayerElements(mounts.output, props.selectedLayer.id).length);
  }, [mounts, previewMode, props.selectedLayer, staticRevision]);

  useLayoutEffect(() => {
    if (!mounts || previewMode !== "design" || !props.selectedLayer) {
      props.onSelectedLayerMetrics?.(undefined);
      return undefined;
    }
    return mountSourceLayerSelection(
      mounts.output,
      props.selectedLayer.id,
      props.selectedLayer.kind === "component"
        ? "component"
        : props.selectedLayer.kind === "slot"
          ? props.slotScopes?.[props.selectedLayer.id] === "shared" ? "shared-slot" : "slot"
          : "layer",
      (metrics) => {
        props.onSelectedLayerMetrics?.(metrics);
        if (metrics && revealKey) setRevealTarget({ key: revealKey, rect: metrics });
      },
      props.selectedLayer.id === defaultVisualLayer?.id
        ? mounts.output.querySelector<HTMLElement>("[data-design-space-preview-entry-root]")
        : undefined,
      selectedOccurrence,
      props.selectedLayerLabel ?? sourceCanvasLayerLabel(props.selectedLayer),
    );
  }, [defaultVisualLayer?.id, mounts, previewMode, props.onSelectedLayerMetrics, props.selectedLayer, props.selectedLayerLabel, props.slotScopes, revealKey, selectedOccurrence, staticRevision]);

  useLayoutEffect(() => {
    if (!mounts || previewMode !== "design" || !visibleHoveredLayerHit || (visibleHoveredLayerHit.layerId === props.selectedLayer?.id && visibleHoveredLayerHit.occurrence === selectedOccurrence)) return undefined;
    return mountSourceLayerHover(
      mounts.output,
      visibleHoveredLayerHit.layerId,
      visibleHoveredLayerHit.layerId === defaultVisualLayer?.id
        ? mounts.output.querySelector<HTMLElement>("[data-design-space-preview-entry-root]")
        : undefined,
      visibleHoveredLayerHit.occurrence,
      hoveredExternalOwner,
      sourceCanvasLayerLabel(hoveredLayer),
      canvasAnnotations.active
        ? "annotation"
        : hoveredLayer?.kind === "component"
          ? "component"
          : hoveredLayer?.kind === "slot"
            ? props.slotScopes?.[hoveredLayer.id] === "shared" ? "shared-slot" : "slot"
            : "layer",
    );
  }, [canvasAnnotations.active, defaultVisualLayer?.id, hoveredExternalOwner, hoveredLayer, mounts, previewMode, props.selectedLayer?.id, props.slotScopes, selectedOccurrence, staticRevision, visibleHoveredLayerHit]);

  useEffect(() => {
    setHoveredLayerHit(undefined);
  }, [props.entry?.id, previewMode]);

  useEffect(() => {
    if (props.workspaceMode !== "preview" || previewMode !== "play" || !props.onModeChange) return undefined;
    const stop = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onModeChange?.("design");
    };
    window.addEventListener("keydown", stop);
    return () => window.removeEventListener("keydown", stop);
  }, [previewMode, props.onModeChange, props.workspaceMode]);

  useEffect(() => {
    if (!hoveredLayerHit) return undefined;
    const clearOutsideSurface = (event: MouseEvent | PointerEvent) => {
      const surface = selectionSurfaceRef.current;
      if (!surface || !(event.target instanceof Node) || !surface.contains(event.target)) {
        setHoveredLayerHit(undefined);
      }
    };
    document.addEventListener("mousemove", clearOutsideSurface, true);
    document.addEventListener("pointermove", clearOutsideSurface, true);
    return () => {
      document.removeEventListener("mousemove", clearOutsideSurface, true);
      document.removeEventListener("pointermove", clearOutsideSurface, true);
    };
  }, [hoveredLayerHit]);

  useEffect(() => {
    if (mounts) mounts.styles.textContent = [props.styles.join("\n"), props.selectedClassCss ?? ""].join("\n");
  }, [mounts, props.selectedClassCss, props.styles]);

  useEffect(() => {
    if (!mounts || props.selectedClassName === undefined) return;
    if (projectionKey) {
      applySourceLayerClassName(mounts.output, props.selectedClassName);
    } else if (!projectionKey && props.selectedLayer) {
      applySourceLayerClassNameById(mounts.output, props.selectedLayer.id, props.selectedClassName, selectedOccurrence);
    }
  }, [mounts, projectionKey, props.selectedClassName, props.selectedLayer, selectedOccurrence, staticRevision]);

  useEffect(() => {
    if (!mounts || props.selectedText === undefined) return;
    if (projectionKey) {
      applySourceLayerText(mounts.output, props.selectedText);
    } else if (!projectionKey && props.selectedLayer) {
      applySourceLayerTextById(mounts.output, props.selectedLayer.id, props.selectedText, selectedOccurrence);
    }
  }, [mounts, projectionKey, props.selectedLayer, props.selectedText, selectedOccurrence, staticRevision]);

  useLayoutEffect(() => {
    if (!mounts || previewMode === "play") {
      setContentSize(undefined);
      return;
    }
    const next = measureSourcePreviewContent(mounts.output);
    setContentSize((current) => current?.width === next?.width && current?.height === next?.height ? current : next);
  }, [mounts, previewMode, props.selectedClassName, props.selectedText, staticRevision]);

  return (
    <SourceCanvasViewport
      ancestry={props.ancestry}
      compact={props.compact}
      contentSize={contentSize}
      device={props.device}
      mode={previewMode === "static" ? undefined : previewMode}
      node={props.node}
      selectedLayer={Boolean(props.selectedLayer)}
      showModeToggle={!props.workspaceMode}
      revealTarget={revealTarget?.key === revealKey ? revealTarget : undefined}
      reviewGraph={previewMode === "play" ? undefined : reviewGraph}
      selectionKey={props.entry?.id}
      selectionLabel={props.selectedLayerLabel ?? sourceCanvasLayerLabel(props.selectedLayer) ?? props.node?.label}
      slotOwnerLabel={props.node?.label ?? props.entry?.label}
      slotTabs={canvasSlotTabs}
      footer={selectedOwner ? (
        <SourceHoverIdentityHud
          action={props.onOpenSlotTarget && props.slotTargetLabel ? {
            label: props.slotTargetLabel,
            onPress: props.onOpenSlotTarget,
          } : undefined}
          external={Boolean(props.onOpenLayerOwner && selectedOwner.fileId !== props.entry?.fileId)}
          owner={selectedOwner}
        />
      ) : undefined}
      hud={(
        <div className="flex w-[min(600px,calc(100vw-2rem))] max-w-full flex-col gap-1.5">
          {!props.workspaceMode && props.selectedLayer && selectedLayerOccurrenceCount > 1 ? (
            <div className="min-w-0">
              <SourceInstanceNavigator
                count={selectedLayerOccurrenceCount}
                index={selectedOccurrence}
                onChange={(occurrence) => props.onSelectLayer?.(props.selectedLayer!.id, occurrence)}
              />
            </div>
          ) : null}
          <SourceCanvasFeedbackDock
            annotationMode={canvasAnnotations.active}
            annotations={canvasAnnotations.annotations}
            context={feedbackContext}
            meta={props.workspaceMode || props.reviewCheckpoint ? (
              <>
                {props.workspaceMode ? (
                  <SourceCanvasContextHud
                    contextLabel={props.node?.label ?? props.entry?.label ?? "Component"}
                    mode={props.workspaceMode}
                    playing={previewMode === "play"}
                    onPlayChange={(playing) => props.onModeChange?.(playing ? "play" : "design")}
                    onReturnToPreview={props.onReturnToPreview}
                  />
                ) : null}
                {props.reviewCheckpoint ? (
                  <SourceComponentReviewCheckpoint
                    {...props.reviewCheckpoint}
                    stateCount={caseNames.length || (props.entry?.design ? 1 : 0)}
                    onRequestChanges={() => canvasAnnotations.setActive(true)}
                  />
                ) : null}
              </>
            ) : undefined}
            onAnnotationModeChange={previewMode === "design" && !previewState ? canvasAnnotations.setActive : undefined}
            onAnnotationsSent={canvasAnnotations.clear}
          />
        </div>
      )}
      onDeviceChange={props.onDeviceChange ?? (() => undefined)}
      onSelectAncestry={props.onSelectAncestry}
      onSelectSlot={(slot) => props.onSelectLayer?.(slot.id, 0)}
      onModeChange={props.onModeChange}
      toolbarEnd={props.workspaceNavigation || (!structuralDesign && definition && selectedCase) ? (
        <>
          {props.workspaceNavigation}
          {!structuralDesign && definition && selectedCase ? (
            <SourceDesignControls
              matrix={matrix}
              matrixAvailable={matrixAvailable}
              stale={loadState === "invalid"}
              onMatrixChange={() => designId && setMatrixByDesign((current) => ({ ...current, [designId]: !current[designId] }))}
            />
          ) : null}
        </>
      ) : undefined}
    >
      {(frame) => (
        <div className="relative h-full w-full" style={{ width: frame.width, height: frame.height }}>
          {previewState ?? (previewMode === "play" ? (
            <PlayablePreview
              caseName={selectedCase!}
              centered={props.centerContent}
              classCss={props.selectedClassCss}
              className={props.selectedClassName}
              definition={definition!}
              entry={props.entry!}
              layer={props.selectedLayer}
              matrix={matrix}
              styles={props.styles}
              text={props.selectedText}
            />
          ) : (
            <>
              <iframe
                key={projectionKey ?? props.entry?.id ?? "unavailable"}
                ref={loadFrame}
                aria-label={`${props.entry?.label ?? props.node?.label ?? "Source"} static preview`}
                className="pointer-events-none h-full w-full select-none border-0"
                srcDoc={previewDocument}
                tabIndex={-1}
                title={`${props.entry?.label ?? props.node?.label ?? "Source"} ${props.device} preview`}
              />
              {previewMode === "design" ? (
                <>
                  <div
                    ref={selectionSurfaceRef}
                    aria-label="Select layers in static preview"
                    className={`absolute inset-0 z-10 touch-none ${canvasAnnotations.active ? "cursor-crosshair" : "cursor-default"}`}
                    data-design-space-canvas-action
                    data-testid="source-preview-selection-surface"
                    onClick={canvasAnnotations.active ? annotateStaticLayer : selectStaticLayer}
                    onDoubleClick={canvasAnnotations.active ? undefined : openStaticLayerOwner}
                    onMouseLeave={() => setHoveredLayerHit(undefined)}
                    onMouseMove={hoverStaticLayer}
                    onPointerLeave={() => setHoveredLayerHit(undefined)}
                  />
                  <SourceCanvasAnnotationOverlay
                    active={canvasAnnotations.active}
                    annotations={canvasAnnotations.annotations}
                    target={canvasAnnotations.target}
                    onCancel={canvasAnnotations.cancel}
                    onDelete={canvasAnnotations.remove}
                    onEdit={canvasAnnotations.edit}
                    onFinish={() => canvasAnnotations.setActive(false)}
                    onSave={canvasAnnotations.save}
                  />
                </>
              ) : null}
            </>
          ))}
        </div>
      )}
    </SourceCanvasViewport>
  );
}

function unavailablePreviewState(props: Pick<Parameters<typeof SourcePreviewFrame>[0], "device" | "entry" | "generateDesignError" | "generatingDesign" | "onGenerateDesign" | "runtime"> & {
  definition?: ComponentDesignDefinition;
  loadMessage?: string;
  loadState: "checking" | "invalid" | "ready";
}) {
  if (props.runtime === "react-native") return <PreviewState title="React Native target indexed" message="The native source tree and TypeScript contracts are available. A simulator renderer must connect before this target can claim preview readiness." />;
  if (!props.entry) return <PreviewState title={`No ${props.device} implementation`} message="Add an exported React component at the shown fixed path, or configure the explicit Tablet fallback." />;
  if (!props.entry.design) return (
    <PreviewState
      title="Design required"
      message="This component needs a colocated design before Design Space can render it in isolation."
      error={props.generateDesignError}
      action={props.onGenerateDesign ? (
        <Button data-design-space-canvas-action isPending={props.generatingDesign} size="sm" variant="secondary" onPress={props.onGenerateDesign}>
          <WandSparkles aria-hidden="true" size={13} />
          {props.generatingDesign ? "Generating…" : "Generate design"}
        </Button>
      ) : undefined}
    />
  );
  if (!props.definition) {
    return props.loadState === "invalid"
      ? (
        <PreviewState
          tone="error"
          title="Design invalid"
          message="The component design could not be loaded."
          error={props.loadMessage ?? "Fix the colocated design to enable this preview."}
        />
      )
      : <PreviewState title="Checking design" message="TypeScript and the colocated design module are being verified before the canvas can execute them." />;
  }
  return undefined;
}

type PreviewMounts = {
  output: HTMLElement;
  staging: HTMLElement;
  styles: HTMLElement;
};

const previewDocument = '<!doctype html><html class="dark" data-theme="dark" data-resolved-theme="dark" data-component-library="shadcn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="design-space-preview-styles"></style><style>html,body,#design-space-preview-root{height:100%;margin:0;background:transparent;color:#f4f4f5}#design-space-preview-staging{position:fixed;left:-100000px;top:0;width:100%;visibility:hidden;pointer-events:none}</style></head><body><div id="design-space-preview-staging"></div><div id="design-space-preview-root"></div></body></html>';

function invalidDesignMessage(definition: ComponentDesignDefinition | undefined): string | undefined {
  if (!definition || typeof definition !== "object") return "The design module must default-export defineComponentDesign(...).";
  if (typeof definition.render !== "function") return "The design must provide a render function.";
  const names = Object.keys(definition.cases ?? {});
  if (!names.length) return definition.isStateful ? "A stateful design must declare at least one state." : "A stateless design must declare at least the default design.";
  if (!names.includes(definition.initialCase)) return `The initial ${definition.isStateful ? "state" : "design"} is not declared.`;
  return undefined;
}

type LoadedDesign = { designId: string; definition: ComponentDesignDefinition };
function PlayablePreview(props: {
  caseName: string;
  centered?: boolean;
  classCss?: string;
  className?: string;
  definition: ComponentDesignDefinition;
  entry: RuntimeSourceWorkspaceEntry;
  layer?: SourceWorkspaceLayer;
  matrix: boolean;
  styles: readonly string[];
  text?: string;
}) {
  const output = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = output.current;
    if (!root || !props.layer) return;
    if (props.className !== undefined) applySourceLayerClassNameById(root, props.layer.id, props.className);
    if (props.text !== undefined) applySourceLayerTextById(root, props.layer.id, props.text);
  }, [props.className, props.layer, props.text]);
  return (
    <section aria-label={`${props.entry.label} interactive preview`} className="h-full w-full overflow-auto bg-[#0d0e10] text-zinc-100">
      <style>{[props.styles.join("\n"), props.classCss ?? ""].join("\n")}</style>
      <div ref={output} className="min-h-full">
        <SourcePreviewContent caseName={props.caseName} centered={props.centered} definition={props.definition} entry={props.entry} matrix={props.matrix} />
      </div>
    </section>
  );
}

export function projectSourceLayer(staging: HTMLElement, output: HTMLElement, layerId: string): boolean {
  const target = [...staging.querySelectorAll<HTMLElement>("[data-design-space-source-layer-id]")]
    .find((element) => element.dataset.designSpaceSourceLayerId === layerId);
  if (!target) return false;
  output.replaceChildren(target.cloneNode(true));
  return true;
}

function showStaticPreviewMessage(output: HTMLElement, message: string, error = false): void {
  const element = output.ownerDocument.createElement("p");
  element.textContent = message;
  element.style.cssText = `margin:24px;color:${error ? "#fda4af" : "#71717a"};font:12px/1.5 system-ui,sans-serif`;
  output.replaceChildren(element);
}

function sourceLayerIds(entries: readonly RuntimeSourceWorkspaceEntry[]): ReadonlySet<string> {
  const ids = new Set<string>();
  const visit = (layers: readonly SourceWorkspaceLayer[] | undefined): void => {
    for (const layer of layers ?? []) {
      ids.add(layer.id);
      visit(layer.children);
    }
  };
  for (const entry of entries) visit(entry.layers);
  return ids;
}

function findPreviewLayer(
  entries: readonly RuntimeSourceWorkspaceEntry[],
  layerId: string,
): SourceWorkspaceLayer | undefined {
  const visit = (layers: readonly SourceWorkspaceLayer[] | undefined): SourceWorkspaceLayer | undefined => {
    for (const layer of layers ?? []) {
      if (layer.id === layerId) return layer;
      const nested = visit(layer.children);
      if (nested) return nested;
    }
    return undefined;
  };
  for (const entry of entries) {
    const layer = visit(entry.layers);
    if (layer) return layer;
  }
  return undefined;
}

function sourceCanvasLayerLabel(layer: SourceWorkspaceLayer | undefined): string | undefined {
  if (!layer) return undefined;
  if (layer.kind === "html") return `<${layer.label}>`;
  if (layer.kind === "slot") return `slot:${layer.label}`;
  return layer.label;
}

export function applySourceLayerClassName(output: HTMLElement, className: string): boolean {
  const selected = output.firstElementChild;
  if (!selected) return false;
  selected.setAttribute("class", className);
  return true;
}

export function applySourceLayerClassNameById(output: HTMLElement, layerId: string, className: string, occurrence = 0): boolean {
  const selected = sourceLayerElement(output, layerId, occurrence);
  if (!selected) return false;
  selected.setAttribute("class", className);
  return true;
}

export function applySourceLayerText(output: HTMLElement, text: string): boolean {
  const selected = output.firstElementChild;
  if (!selected) return false;
  return replaceDirectText(selected, text);
}

export function applySourceLayerTextById(output: HTMLElement, layerId: string, text: string, occurrence = 0): boolean {
  const selected = sourceLayerElement(output, layerId, occurrence);
  return selected ? replaceDirectText(selected, text) : false;
}

function replaceDirectText(selected: Element, text: string): boolean {
  const textNodes = [...selected.childNodes].filter((node) => node.nodeType === 3);
  const textNode = textNodes.find((node) => Boolean(node.textContent?.trim()))
    ?? (textNodes.length === 1 ? textNodes[0] : undefined);
  if (!textNode) return false;
  textNode.textContent = text;
  return true;
}
