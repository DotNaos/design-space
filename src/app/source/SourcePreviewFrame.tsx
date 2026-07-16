import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import type {
  DesignSpaceDevice,
  RuntimeSourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourceCanvasViewport } from "./SourceCanvasViewport";
import { SourcePreviewRuntimeContext } from "./SourcePreviewRuntime";
import type { SourceTreeNode } from "./source-workspace-tree";

export function SourcePreviewFrame(props: {
  device: DesignSpaceDevice;
  entry?: RuntimeSourceWorkspaceEntry;
  runtime: "react" | "react-native";
  styles: readonly string[];
  node?: SourceTreeNode;
  selectedLayer?: SourceWorkspaceLayer;
  selectedClassName?: string;
  selectedClassCss?: string;
  selectedText?: string;
  onDeviceChange?: (device: DesignSpaceDevice) => void;
}) {
  const [mounts, setMounts] = useState<PreviewMounts>();
  const [projectedKey, setProjectedKey] = useState<string>();
  const previewState = unavailablePreviewState(props);
  const projectionKey = props.entry && props.selectedLayer
    ? `${props.entry.id}:${props.selectedLayer.id}`
    : undefined;
  const completeProjection = useCallback(() => {
    if (projectionKey) setProjectedKey(projectionKey);
  }, [projectionKey]);
  const loadFrame = useCallback((node: HTMLIFrameElement | null) => {
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
    if (mounts) mounts.styles.textContent = [props.styles.join("\n"), props.selectedClassCss ?? ""].join("\n");
  }, [mounts, props.selectedClassCss, props.styles]);

  useEffect(() => {
    if (
      mounts &&
      projectionKey &&
      projectedKey === projectionKey &&
      props.selectedClassName !== undefined
    ) {
      applySourceLayerClassName(mounts.output, props.selectedClassName);
    }
  }, [mounts, projectedKey, projectionKey, props.selectedClassName]);

  useEffect(() => {
    if (
      mounts &&
      projectionKey &&
      projectedKey === projectionKey &&
      props.selectedText !== undefined
    ) {
      applySourceLayerText(mounts.output, props.selectedText);
    }
  }, [mounts, projectedKey, projectionKey, props.selectedText]);

  return (
    <SourceCanvasViewport
      device={props.device}
      node={props.node}
      selectionKey={props.selectedLayer?.id ?? props.entry?.id}
      selectionLabel={props.selectedLayer?.kind === "html" ? `<${props.selectedLayer.label}>` : props.node?.label}
      onDeviceChange={props.onDeviceChange ?? (() => undefined)}
    >
      {(frame) => (
        <div className="h-full w-full" style={{ width: frame.width, height: frame.height }}>
          {previewState ?? (
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
              {mounts && !projectionKey && createPortal(<PreviewContent entry={props.entry!} />, mounts.output)}
              {mounts && projectionKey && projectedKey !== projectionKey && createPortal(
                <>
                  <PreviewContent entry={props.entry!} />
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
          )}
        </div>
      )}
    </SourceCanvasViewport>
  );
}

function unavailablePreviewState(props: Pick<Parameters<typeof SourcePreviewFrame>[0], "device" | "entry" | "runtime">) {
  if (props.runtime === "react-native") return <PreviewState title="React Native target indexed" message="The native source tree and TypeScript contracts are available. A simulator renderer must connect before this target can claim preview readiness." />;
  if (!props.entry) return <PreviewState title={`No ${props.device} implementation`} message="Add an exported React component at the shown fixed path, or configure the explicit Tablet fallback." />;
  const requiredProps = props.entry.props.filter((property) => property.required);
  const requiredSlots = props.entry.slots.filter((slot) => slot.required || slot.min > 0);
  if (requiredProps.length > 0 || requiredSlots.length > 0) {
    const requirements = [
      requiredProps.length ? `Required props: ${requiredProps.map((property) => property.name).join(", ")}` : undefined,
      requiredSlots.length ? `Required slots: ${requiredSlots.map((slot) => slot.name).join(", ")}` : undefined,
    ].filter(Boolean).join(". ");
    return <PreviewState title="Preview arguments required" message={`Design Space will not invent values or execute this component with an invalid contract. ${requirements}.`} />;
  }
  return undefined;
}

type PreviewMounts = {
  output: HTMLElement;
  staging: HTMLElement;
  styles: HTMLElement;
};

const previewDocument = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style id="design-space-preview-styles"></style><style>#design-space-preview-staging{position:fixed;left:-100000px;top:0;width:100%;visibility:hidden;pointer-events:none}</style></head><body><div id="design-space-preview-staging"></div><div id="design-space-preview-root"></div></body></html>';

function PreviewContent(props: { entry: RuntimeSourceWorkspaceEntry }) {
  const entry = props.entry;
  const Component = entry.component;
  return (
    <PreviewBoundary resetKey={entry.id} errorTitle="Target preview crashed" errorMessage="Fix the target source or its required runtime context to recover.">
      <SourcePreviewRuntimeContext.Provider value><Component /></SourcePreviewRuntimeContext.Provider>
    </PreviewBoundary>
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

export function applySourceLayerClassName(output: HTMLElement, className: string): boolean {
  const selected = output.firstElementChild;
  if (!selected) return false;
  selected.setAttribute("class", className);
  return true;
}

export function applySourceLayerText(output: HTMLElement, text: string): boolean {
  const selected = output.firstElementChild;
  if (!selected) return false;
  const textNodes = [...selected.childNodes].filter((node) => node.nodeType === 3);
  const textNode = textNodes.find((node) => Boolean(node.textContent?.trim()))
    ?? (textNodes.length === 1 ? textNodes[0] : undefined);
  if (!textNode) return false;
  textNode.textContent = text;
  return true;
}

function PreviewState(props: { title: string; message: string }) {
  return (
    <section className="grid h-full min-h-0 place-items-center bg-[#0d0e10] px-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-sm font-semibold text-zinc-200">{props.title}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{props.message}</p>
      </div>
    </section>
  );
}
