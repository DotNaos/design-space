import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Grid2X2, WandSparkles } from "lucide-react";
import { Button, ListBox, Select } from "@heroui/react";

import type {
  DesignSpaceDevice,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import type { ComponentDesignDefinition } from "../../shared/component-design";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourceCanvasViewport } from "./SourceCanvasViewport";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source-layer-design";
import { mountSourceLayerSelection, sourceLayerElement } from "./source-preview-selection-overlay";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";
import type { SourceTreeNode } from "./source-workspace-tree";

export function SourcePreviewFrame(props: {
  device: DesignSpaceDevice;
  entry?: RuntimeSourceWorkspaceEntry;
  runtime: "react" | "react-native";
  styles: readonly string[];
  entries?: readonly RuntimeSourceWorkspaceEntry[];
  node?: SourceTreeNode;
  selectedLayer?: SourceWorkspaceLayer;
  selectedClassName?: string;
  selectedClassCss?: string;
  selectedText?: string;
  centerContent?: boolean;
  compact?: boolean;
  isolateSelectedLayer?: boolean;
  generateDesignError?: string;
  generatingDesign?: boolean;
  selectionMode?: boolean;
  mode?: SourcePreviewMode;
  onGenerateDesign?: () => void;
  onDeviceChange?: (device: DesignSpaceDevice) => void;
  onSelectLayer?: (layerId: string) => void;
  onModeChange?: (mode: SourcePreviewMode) => void;
  onSelectedLayerMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
}) {
  const [mounts, setMounts] = useState<PreviewMounts>();
  const [projectedKey, setProjectedKey] = useState<string>();
  const [loaded, setLoaded] = useState<LoadedDesign>();
  const [loadState, setLoadState] = useState<"checking" | "invalid" | "ready">("checking");
  const [loadMessage, setLoadMessage] = useState<string>();
  const [caseByDesign, setCaseByDesign] = useState<Readonly<Record<string, string>>>({});
  const [matrixByDesign, setMatrixByDesign] = useState<Readonly<Record<string, boolean>>>({});
  const previewMode: SourcePreviewMode | "static" = props.mode ?? (props.selectionMode ? "design" : "static");
  const selectableLayerIds = useMemo(() => sourceLayerIds(props.entries ?? (props.entry ? [props.entry] : [])), [props.entries, props.entry]);
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
  const previewState = unavailablePreviewState({
    ...props,
    definition,
    loadMessage,
    loadState,
  });
  const projectionKey = props.isolateSelectedLayer !== false && props.entry && props.selectedLayer?.kind === "html" && selectedCase
    ? `${props.entry.id}:${props.selectedLayer.id}:${selectedCase}`
    : undefined;
  const completeProjection = useCallback(() => {
    if (projectionKey) setProjectedKey(projectionKey);
  }, [projectionKey]);
  const loadFrame = useCallback((node: HTMLIFrameElement | null) => {
    if (!node) {
      setMounts(undefined);
      return;
    }
    node.inert = previewMode === "static";
    if (previewMode !== "static") node.removeAttribute("inert");
    else node.setAttribute("inert", "");
    const update = () => {
      const document = node.contentDocument;
      const output = document?.getElementById("design-space-preview-root");
      const staging = document?.getElementById("design-space-preview-staging");
      const styles = document?.getElementById("design-space-preview-styles");
      setMounts(output && staging && styles ? { output, staging, styles } : undefined);
    };
    node.addEventListener("load", update, { once: true });
    update();
  }, [previewMode]);

  useEffect(() => {
    if (!mounts || previewMode !== "design" || !props.onSelectLayer) return undefined;
    const document = mounts.output.ownerDocument;
    const select = (event: Event) => {
      const point = sourceLayerTargetAtEventPoint(document, event);
      const layerId = sourceLayerIdFromElement(point ?? event.target, selectableLayerIds);
      if (!layerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      props.onSelectLayer?.(layerId);
    };
    document.addEventListener("pointerdown", select, true);
    document.addEventListener("click", select, true);
    return () => {
      document.removeEventListener("pointerdown", select, true);
      document.removeEventListener("click", select, true);
    };
  }, [mounts, previewMode, props.onSelectLayer, selectableLayerIds]);

  useLayoutEffect(() => {
    if (!mounts || previewMode !== "design" || !props.selectedLayer) {
      props.onSelectedLayerMetrics?.(undefined);
      return undefined;
    }
    return mountSourceLayerSelection(
      mounts.output.ownerDocument,
      mounts.output,
      props.selectedLayer.id,
      props.selectedLayer.kind === "component" ? "component" : "layer",
      props.onSelectedLayerMetrics,
    );
  }, [mounts, previewMode, props.onSelectedLayerMetrics, props.selectedLayer]);

  useEffect(() => {
    if (mounts) mounts.styles.textContent = [props.styles.join("\n"), props.selectedClassCss ?? ""].join("\n");
  }, [mounts, props.selectedClassCss, props.styles]);

  useEffect(() => {
    if (!mounts || props.selectedClassName === undefined) return;
    if (projectionKey && projectedKey === projectionKey) {
      applySourceLayerClassName(mounts.output, props.selectedClassName);
    } else if (!projectionKey && props.selectedLayer) {
      applySourceLayerClassNameById(mounts.output, props.selectedLayer.id, props.selectedClassName);
    }
  }, [mounts, projectedKey, projectionKey, props.selectedClassName, props.selectedLayer]);

  useEffect(() => {
    if (!mounts || props.selectedText === undefined) return;
    if (projectionKey && projectedKey === projectionKey) {
      applySourceLayerText(mounts.output, props.selectedText);
    } else if (!projectionKey && props.selectedLayer) {
      applySourceLayerTextById(mounts.output, props.selectedLayer.id, props.selectedText);
    }
  }, [mounts, projectedKey, projectionKey, props.selectedLayer, props.selectedText]);

  return (
    <SourceCanvasViewport
      compact={props.compact}
      device={props.device}
      mode={previewMode === "static" ? undefined : previewMode}
      node={props.node}
      selectedLayer={Boolean(props.selectedLayer)}
      selectionKey={props.entry?.id}
      selectionLabel={props.selectedLayer?.kind === "html" ? `<${props.selectedLayer.label}>` : props.node?.label}
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
        <div className="h-full w-full" style={{ width: frame.width, height: frame.height }}>
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
                className={`${previewMode === "static" ? "pointer-events-none" : "pointer-events-auto"} ${previewMode === "design" ? "cursor-default select-none" : "cursor-auto"} h-full w-full border-0`}
                srcDoc={previewDocument}
                tabIndex={-1}
                title={`${props.entry?.label ?? props.node?.label ?? "Source"} ${props.device} preview`}
              />
              {mounts && !projectionKey && createPortal(
                <PreviewContent caseName={selectedCase!} centered={props.centerContent} definition={definition!} entry={props.entry!} matrix={matrix} />,
                mounts.output,
              )}
              {mounts && projectionKey && projectedKey !== projectionKey && createPortal(
                <>
                  <PreviewContent caseName={selectedCase!} centered={props.centerContent} definition={definition!} entry={props.entry!} matrix={false} />
                  <IsolatedLayerProjector
                    layerId={props.selectedLayer!.id}
                    output={mounts.output}
                    staging={mounts.staging}
                    onProjected={completeProjection}
                  />
                </>,
                mounts.staging,
              )}
            </>
          ))}
        </div>
      )}
    </SourceCanvasViewport>
  );
}

export function scalePreviewEventPoint(
  point: { clientX: number; clientY: number },
  frame: { height: number; width: number },
  viewport: { height: number; width: number },
): { x: number; y: number } {
  return {
    x: point.clientX * (frame.width > 0 && viewport.width > 0 ? viewport.width / frame.width : 1),
    y: point.clientY * (frame.height > 0 && viewport.height > 0 ? viewport.height / frame.height : 1),
  };
}

function sourceLayerTargetAtEventPoint(document: Document, event: Event): Element | null {
  if (!("clientX" in event) || !("clientY" in event)) return null;
  const frame = document.defaultView?.frameElement;
  const bounds = frame?.getBoundingClientRect();
  const point = scalePreviewEventPoint(
    { clientX: Number(event.clientX), clientY: Number(event.clientY) },
    { height: bounds?.height ?? 0, width: bounds?.width ?? 0 },
    { height: document.documentElement.clientHeight, width: document.documentElement.clientWidth },
  );
  return document.elementFromPoint(point.x, point.y);
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
      ? <PreviewState title="Design invalid" message={props.loadMessage ?? "Fix the colocated design to enable this preview."} />
      : <PreviewState title="Checking design" message="TypeScript and the colocated design module are being verified before the canvas can execute them." />;
  }
  return undefined;
}

type PreviewMounts = {
  output: HTMLElement;
  staging: HTMLElement;
  styles: HTMLElement;
};

const previewDocument = '<!doctype html><html class="dark" data-theme="dark" data-resolved-theme="dark" data-component-library="shadcn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="design-space-preview-styles"></style><style>html,body,#design-space-preview-root{height:100%;margin:0;background:#0d0e10;color:#f4f4f5}#design-space-preview-staging{position:fixed;left:-100000px;top:0;width:100%;visibility:hidden;pointer-events:none}</style></head><body><div id="design-space-preview-staging"></div><div id="design-space-preview-root"></div></body></html>';

function PreviewContent(props: {
  caseName: string;
  centered?: boolean;
  definition: ComponentDesignDefinition;
  entry: RuntimeSourceWorkspaceEntry;
  matrix: boolean;
}) {
  const cases = propertyCases(props.entry, props.matrix);
  return (
    <PreviewBoundary resetKey={`${props.entry.id}:${props.caseName}:${props.matrix}`} errorTitle="Design preview crashed" errorMessage="Fix the colocated design or its required runtime context to recover.">
      <SourcePreviewRuntimeContext.Provider value>
        <div style={cases.length > 1
          ? { display: "grid", gridTemplateColumns: `repeat(${Math.min(cases.length, 3)}, minmax(0, 1fr))`, gap: 16, minHeight: "100%", padding: 16 }
          : props.centered
            ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: "100%", width: "100%" }
            : { minHeight: "100%" }}>
          {cases.map((propertyCase) => (
            <section key={propertyCase.label} style={cases.length > 1 ? { minWidth: 0, border: "1px solid rgba(127,127,127,.22)", borderRadius: 8, padding: 12 } : undefined}>
              {cases.length > 1 ? <p style={{ margin: "0 0 8px", color: "#71717a", font: "10px/1.4 ui-monospace,monospace" }}>{propertyCase.label}</p> : null}
              <div style={cases.length > 1 && props.centered ? { alignItems: "center", display: "flex", justifyContent: "center", minHeight: 120 } : undefined}>
                {props.definition.render({
                  ...props.definition.defaults,
                  ...props.definition.cases[props.caseName],
                  ...propertyCase.values,
                })}
              </div>
            </section>
          ))}
        </div>
      </SourcePreviewRuntimeContext.Provider>
    </PreviewBoundary>
  );
}

function propertyCases(entry: RuntimeSourceWorkspaceEntry, matrix: boolean): readonly PropertyCase[] {
  if (!matrix) return [{ label: "Current", values: {} }];
  const axes = entry.props.filter((property) => (property.values?.length ?? 0) > 1).slice(0, 2);
  if (!axes.length) return [{ label: "Current", values: {} }];
  const [rows, columns] = axes;
  return (rows?.values ?? []).flatMap((row) => (columns?.values ?? [undefined]).map((column) => ({
    label: [rows ? `${rows.name}=${String(row)}` : undefined, columns && column !== undefined ? `${columns.name}=${String(column)}` : undefined].filter(Boolean).join(" · "),
    values: {
      ...(rows ? { [rows.name]: row } : {}),
      ...(columns && column !== undefined ? { [columns.name]: column } : {}),
    },
  }))).slice(0, 18);
}

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
type PropertyCase = { label: string; values: Readonly<Record<string, boolean | number | string>> };

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
        <PreviewContent caseName={props.caseName} centered={props.centered} definition={props.definition} entry={props.entry} matrix={props.matrix} />
      </div>
    </section>
  );
}

function IsolatedLayerProjector(props: {
  layerId: string;
  output: HTMLElement;
  staging: HTMLElement;
  onProjected: () => void;
}) {
  const { layerId, onProjected, output, staging } = props;
  useLayoutEffect(() => {
    const ownerWindow = staging.ownerDocument.defaultView;
    if (!ownerWindow) return undefined;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onProjected();
    };
    const project = () => {
      if (!projectSourceLayer(staging, output, layerId)) return false;
      finish();
      return true;
    };
    output.replaceChildren();
    if (project()) return undefined;
    const observer = new ownerWindow.MutationObserver(() => project());
    observer.observe(staging, { childList: true, subtree: true });
    const timer = ownerWindow.setTimeout(() => {
      if (settled) return;
      const message = output.ownerDocument.createElement("p");
      message.textContent = "This HTML layer is not rendered in the current state.";
      message.style.cssText = "margin:24px;color:#71717a;font:12px/1.5 system-ui,sans-serif";
      output.replaceChildren(message);
      finish();
    }, 3_000);
    return () => {
      observer.disconnect();
      ownerWindow.clearTimeout(timer);
    };
  }, [layerId, onProjected, output, staging]);
  return null;
}

export function projectSourceLayer(staging: HTMLElement, output: HTMLElement, layerId: string): boolean {
  const target = [...staging.querySelectorAll<HTMLElement>("[data-design-space-source-layer-id]")]
    .find((element) => element.dataset.designSpaceSourceLayerId === layerId);
  if (!target) return false;
  output.replaceChildren(target.cloneNode(true));
  return true;
}

export function sourceLayerIdFromElement(
  target: EventTarget | null,
  accepted?: ReadonlySet<string>,
): string | undefined {
  let element = target as Element | null;
  if (!element || typeof element.closest !== "function") return undefined;
  if (!accepted) return element.closest<HTMLElement>("[data-design-space-source-layer-id]")?.dataset.designSpaceSourceLayerId;
  element = element.closest<HTMLElement>("[data-design-space-source-layer-id]");
  while (element) {
    const layerId = (element as HTMLElement).dataset.designSpaceSourceLayerId;
    if (layerId && accepted.has(layerId)) return layerId;
    element = element.parentElement?.closest<HTMLElement>("[data-design-space-source-layer-id]") ?? null;
  }
  return undefined;
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

export function applySourceLayerClassNameById(output: HTMLElement, layerId: string, className: string): boolean {
  const selected = sourceLayerElement(output, layerId);
  if (!selected) return false;
  selected.setAttribute("class", className);
  return true;
}

export function applySourceLayerText(output: HTMLElement, text: string): boolean {
  const selected = output.firstElementChild;
  if (!selected) return false;
  return replaceDirectText(selected, text);
}

export function applySourceLayerTextById(output: HTMLElement, layerId: string, text: string): boolean {
  const selected = sourceLayerElement(output, layerId);
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

function PreviewState(props: { action?: React.ReactNode; error?: string; title: string; message: string }) {
  return (
    <section className="grid h-full min-h-0 place-items-center bg-[#0d0e10] px-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-sm font-semibold text-zinc-200">{props.title}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{props.message}</p>
        {props.error ? <p className="mt-3 text-[10px] leading-4 text-red-300">{props.error}</p> : null}
        {props.action ? <div className="mt-4 flex justify-center">{props.action}</div> : null}
      </div>
    </section>
  );
}
