import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CircleAlert, Grid2X2, WandSparkles } from "lucide-react";
import { Button, ListBox, Select } from "@heroui/react";

import type {
  DesignSpaceDevice,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import type { ComponentDesignDefinition } from "../../shared/component-design";
import { SourceCanvasViewport } from "./SourceCanvasViewport";
import { SourceHoverIdentityHud } from "./SourceHoverIdentityHud";
import { SourceInstanceNavigator } from "./SourceInstanceNavigator";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";
import { sourceLayerHitAtPreviewPoint, type SourceLayerHit } from "./source-preview-hit-testing";
import { externalSourceLayerOwner, sourceLayerOwner } from "./source-layer-ownership";
import { mountSourceLayerHover, mountSourceLayerSelection, sourceLayerElement, sourceLayerElements } from "./source-preview-selection-overlay";
import { sourceCanvasVisualLayer } from "./source-canvas-selection";
import { renderStaticSourcePreviewMarkup, SourcePreviewContent } from "./source-static-preview";
import type { SourceTreeNode } from "./source-workspace-tree";

export function SourcePreviewFrame(props: {
  device: DesignSpaceDevice;
  entry?: RuntimeSourceWorkspaceEntry;
  runtime: "react" | "react-native";
  styles: readonly string[];
  entries?: readonly RuntimeSourceWorkspaceEntry[];
  node?: SourceTreeNode;
  selectedLayer?: SourceWorkspaceLayer;
  selectedLayerOccurrence?: number;
  selectedClassName?: string;
  selectedClassCss?: string;
  selectedText?: string;
  centerContent?: boolean;
  compact?: boolean;
  isolateSelectedLayer?: boolean;
  generateDesignError?: string;
  generatingDesign?: boolean;
  selectionMode?: boolean;
  slotLayers?: readonly SourceWorkspaceLayer[];
  mode?: SourcePreviewMode;
  onGenerateDesign?: () => void;
  onDeviceChange?: (device: DesignSpaceDevice) => void;
  onSelectLayer?: (layerId: string, occurrence: number) => void;
  onOpenLayerOwner?: (entryId: string, layerId: string, occurrence: number) => void;
  onModeChange?: (mode: SourcePreviewMode) => void;
  onSelectedLayerMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
  revealSelectedLayerKey?: number;
}) {
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
  const [revealTarget, setRevealTarget] = useState<{ key: string; rect: SourceLayerMetrics }>();
  const previewMode: SourcePreviewMode | "static" = props.mode ?? (props.selectionMode ? "design" : "static");
  const previewEntries = useMemo(() => props.entries ?? (props.entry ? [props.entry] : []), [props.entries, props.entry]);
  const selectableLayerIds = useMemo(() => sourceLayerIds(previewEntries), [previewEntries]);
  const hoveredOwner = useMemo(() => (
    hoveredLayerHit ? sourceLayerOwner(previewEntries, hoveredLayerHit.layerId) : undefined
  ), [hoveredLayerHit, previewEntries]);
  const hoveredExternalOwner = useMemo(() => (
    hoveredOwner && props.onOpenLayerOwner && hoveredOwner.fileId !== props.entry?.fileId
      ? hoveredOwner
      : undefined
  ), [hoveredOwner, props.entry?.fileId, props.onOpenLayerOwner]);
  const defaultVisualLayer = sourceCanvasVisualLayer(props.entry, undefined);
  const designId = props.entry?.design?.fileId;
  useEffect(() => {
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
  }, [designId, props.entry?.design]);
  const activeLoaded = loaded?.designId === designId ? loaded : undefined;
  const definition = activeLoaded?.definition;
  const caseNames = useMemo(() => Object.keys(definition?.cases ?? {}), [definition]);
  const selectedCase = definition && caseNames.includes(caseByDesign[designId ?? ""] ?? "")
    ? caseByDesign[designId ?? ""]!
    : definition?.initialCase;
  const matrixAvailable = Boolean(props.entry?.props.some((property) => (property.values?.length ?? 0) > 1));
  const matrix = Boolean(designId && matrixByDesign[designId] && !props.selectedLayer);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const selectionSurfaceRef = useRef<HTMLDivElement | null>(null);
  const previewState = unavailablePreviewState({
    ...props,
    definition,
    loadMessage,
    loadState,
  });
  const projectionKey = props.isolateSelectedLayer !== false && props.entry && props.selectedLayer?.kind === "html" && selectedCase
    ? `${props.entry.id}:${props.selectedLayer.id}:${selectedCase}`
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
    if (!mounts || previewMode === "play" || !definition || !props.entry || !selectedCase) return;
    let active = true;
    mounts.output.replaceChildren();
    mounts.staging.replaceChildren();
    void renderStaticSourcePreviewMarkup({
      caseName: selectedCase,
      centered: props.centerContent,
      definition,
      entry: props.entry,
      matrix,
      slotLayers: props.slotLayers,
    }).then((markup) => {
      if (!active) return;
      mounts.staging.innerHTML = markup;
      if (projectionKey && props.selectedLayer) {
        if (!projectSourceLayer(mounts.staging, mounts.output, props.selectedLayer.id)) {
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
  }, [definition, matrix, mounts, previewMode, projectionKey, props.centerContent, props.entry, props.selectedLayer, props.slotLayers, selectedCase]);

  const selectStaticLayer = (event: ReactMouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;
    const hit = sourceLayerHitAtPreviewPoint(frame, event, selectableLayerIds, defaultVisualLayer?.id);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    if (props.onOpenLayerOwner && externalSourceLayerOwner(props.entry, previewEntries, hit.layerId)) return;
    if (!props.onSelectLayer) return;
    setSelectedLayerHit({ ...hit, entryId: props.entry?.id ?? "" });
    props.onSelectLayer(hit.layerId, hit.occurrence);
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
      props.selectedLayer.kind === "component" ? "component" : "layer",
      (metrics) => {
        props.onSelectedLayerMetrics?.(metrics);
        if (metrics && revealKey) setRevealTarget({ key: revealKey, rect: metrics });
      },
      props.selectedLayer.id === defaultVisualLayer?.id
        ? mounts.output.querySelector<HTMLElement>("[data-design-space-preview-entry-root]")
        : undefined,
      selectedOccurrence,
    );
  }, [defaultVisualLayer?.id, mounts, previewMode, props.onSelectedLayerMetrics, props.selectedLayer, revealKey, selectedOccurrence, staticRevision]);

  useLayoutEffect(() => {
    if (!mounts || previewMode !== "design" || !hoveredLayerHit || (hoveredLayerHit.layerId === props.selectedLayer?.id && hoveredLayerHit.occurrence === selectedOccurrence)) return undefined;
    return mountSourceLayerHover(
      mounts.output,
      hoveredLayerHit.layerId,
      hoveredLayerHit.layerId === defaultVisualLayer?.id
        ? mounts.output.querySelector<HTMLElement>("[data-design-space-preview-entry-root]")
        : undefined,
      hoveredLayerHit.occurrence,
      hoveredExternalOwner,
    );
  }, [defaultVisualLayer?.id, hoveredExternalOwner, hoveredLayerHit, mounts, previewMode, props.selectedLayer?.id, selectedOccurrence, staticRevision]);

  useEffect(() => {
    setHoveredLayerHit(undefined);
  }, [props.entry?.id, previewMode]);

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

  return (
    <SourceCanvasViewport
      compact={props.compact}
      device={props.device}
      mode={previewMode === "static" ? undefined : previewMode}
      node={props.node}
      selectedLayer={Boolean(props.selectedLayer)}
      revealTarget={revealTarget?.key === revealKey ? revealTarget : undefined}
      selectionKey={props.entry?.id}
      selectionLabel={props.selectedLayer?.kind === "html" ? `<${props.selectedLayer.label}>` : props.node?.label}
      hud={hoveredOwner ? (
        <SourceHoverIdentityHud external={Boolean(hoveredExternalOwner)} owner={hoveredOwner} />
      ) : props.selectedLayer && selectedLayerOccurrenceCount > 1 ? (
        <SourceInstanceNavigator
          count={selectedLayerOccurrenceCount}
          index={selectedOccurrence}
          onChange={(occurrence) => props.onSelectLayer?.(props.selectedLayer!.id, occurrence)}
        />
      ) : undefined}
      onDeviceChange={props.onDeviceChange ?? (() => undefined)}
      onModeChange={props.onModeChange}
      toolbarEnd={definition && selectedCase ? (
        <SourceDesignControls
          caseNames={caseNames}
          isStateful={definition.isStateful}
          matrix={matrix}
          matrixAvailable={matrixAvailable}
          selectedCase={selectedCase}
          stale={loadState === "invalid"}
          onCaseChange={(next) => designId && setCaseByDesign((current) => ({ ...current, [designId]: next }))}
          onMatrixChange={() => designId && setMatrixByDesign((current) => ({ ...current, [designId]: !current[designId] }))}
        />
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
                    className="absolute inset-0 z-10 cursor-default touch-none"
                    data-design-space-canvas-action
                    data-testid="source-preview-selection-surface"
                    onClick={selectStaticLayer}
                    onDoubleClick={openStaticLayerOwner}
                    onMouseLeave={() => setHoveredLayerHit(undefined)}
                    onMouseMove={hoverStaticLayer}
                    onPointerLeave={() => setHoveredLayerHit(undefined)}
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

function SourceDesignControls(props: {
  caseNames: readonly string[];
  isStateful: boolean;
  matrix: boolean;
  matrixAvailable: boolean;
  selectedCase: string;
  stale: boolean;
  onCaseChange: (value: string) => void;
  onMatrixChange: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      {props.stale ? <span className="hidden text-[9px] text-amber-300 xl:inline">Last valid</span> : null}
      <span className="hidden text-[9px] text-zinc-600 xl:inline">{props.isStateful ? "State" : "Design"}</span>
      <Select
        aria-label={props.isStateful ? "Component state" : "Component design"}
        className="w-24 min-w-0 shrink-0"
        selectedKey={props.selectedCase}
        onSelectionChange={(key) => props.onCaseChange(String(key))}
      >
        <Select.Trigger className="flex h-6 min-w-0 items-center gap-1 rounded-md border border-white/10 bg-[#18191c] px-1.5 text-[10px] text-zinc-300 outline-none">
          <Select.Value className="min-w-0 flex-1 truncate text-left" />
          <Select.Indicator className="size-3 shrink-0 text-zinc-500" />
        </Select.Trigger>
        <Select.Popover placement="bottom end" className="max-h-64 min-w-36 overflow-y-auto rounded-lg border border-white/10 bg-[#18191c] p-1 shadow-2xl">
          <ListBox items={props.caseNames.map((name) => ({ id: name, name }))}>
            {(item) => <ListBox.Item id={item.id} textValue={item.name} className="flex min-h-8 cursor-default items-center rounded-md px-2 text-xs text-zinc-300 outline-none data-[focused]:bg-white/10 data-[selected]:text-sky-300">{item.name}<ListBox.ItemIndicator className="ml-auto size-3" /></ListBox.Item>}
          </ListBox>
        </Select.Popover>
      </Select>
      {props.matrixAvailable ? <Button isIconOnly aria-label="Toggle property matrix" aria-pressed={props.matrix} className={`size-6 min-w-6 ${props.matrix ? "bg-sky-400/15 text-sky-300" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={props.onMatrixChange}><Grid2X2 aria-hidden="true" size={12} /></Button> : null}
    </div>
  );
}

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

function PreviewState(props: {
  action?: React.ReactNode;
  error?: string;
  message: string;
  title: string;
  tone?: "error" | "neutral";
}) {
  const isError = props.tone === "error" || Boolean(props.error);
  return (
    <section
      aria-live={isError ? "assertive" : undefined}
      className="grid h-full min-h-0 place-items-center bg-[#0d0e10] px-8 text-center"
      role={isError ? "alert" : undefined}
    >
      <div className="max-w-sm">
        {isError ? <CircleAlert aria-hidden="true" className="mx-auto text-red-400" size={24} /> : null}
        <h2 className={`text-sm font-semibold ${isError ? "mt-3 text-red-200" : "text-zinc-200"}`}>{props.title}</h2>
        <p className={`mt-2 text-xs leading-5 ${isError ? "text-red-300/80" : "text-zinc-500"}`}>{props.message}</p>
        {props.error ? (
          <p className="mt-3 max-h-24 overflow-auto border-t border-red-500/20 pt-3 font-mono text-[10px] leading-4 text-red-300/70">
            {props.error}
          </p>
        ) : null}
        {props.action ? <div className="mt-4 flex justify-center">{props.action}</div> : null}
      </div>
    </section>
  );
}
