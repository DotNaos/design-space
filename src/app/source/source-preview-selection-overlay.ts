import type { SourceLayerMetrics } from "./source-layer-design";

export function mountSourceLayerSelection(
  output: HTMLElement,
  layerId: string,
  tone: "component" | "layer" | "slot",
  onMetrics?: (metrics: SourceLayerMetrics | undefined) => void,
  fallback?: HTMLElement | null,
  occurrence = 0,
  label?: string,
): () => void {
  return mountSourceLayerOutline(output, layerId, {
    fallback,
    label,
    onMetrics,
    occurrence,
    tone,
    variant: "selection",
  });
}

export function mountSourceLayerHover(
  output: HTMLElement,
  layerId: string,
  fallback?: HTMLElement | null,
  occurrence = 0,
  externalOwner?: {
    label: string;
    relativePath: string;
  },
  label?: string,
  tone?: "annotation" | "component" | "layer" | "slot",
): () => void {
  return mountSourceLayerOutline(output, layerId, {
    externalOwner,
    fallback,
    label: label ?? externalOwner?.label,
    occurrence,
    tone: tone ?? (externalOwner ? "component" : "layer"),
    variant: "hover",
  });
}

function mountSourceLayerOutline(
  output: HTMLElement,
  layerId: string,
  options: {
    fallback?: HTMLElement | null;
    onMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
    occurrence: number;
    externalOwner?: {
      label: string;
      relativePath: string;
    };
    label?: string;
    tone: "annotation" | "component" | "layer" | "slot";
    variant: "hover" | "selection";
  },
): () => void {
  const previewDocument = output.ownerDocument;
  const ownerWindow = previewDocument.defaultView;
  const overlayRoot = sourceLayerOverlayRoot(previewDocument);
  const hostWindow = overlayRoot.ownerDocument.defaultView;
  const overlay = overlayRoot.ownerDocument.createElement("div");
  if (options.variant === "selection") overlay.dataset.designSpaceSourceSelection = layerId;
  else overlay.dataset.designSpaceSourceHover = layerId;
  const color = options.tone === "annotation"
    ? "#fbbf24"
    : options.tone === "component"
      ? "#a78bfa"
      : options.tone === "slot"
        ? options.variant === "selection" ? "#d946ef" : "#c084fc"
      : options.variant === "selection"
      ? "#0d99ff"
      : "#72bfff";
  const outlineWidth = options.variant === "selection" ? options.tone === "slot" ? 2 : 1.5 : 1;
  const outlineShadow = options.tone === "slot" && options.variant === "selection"
    ? `inset 0 0 0 ${outlineWidth}px ${color}, inset 0 0 16px rgba(217,70,239,.24)`
    : `inset 0 0 0 ${outlineWidth}px ${color}`;
  overlay.style.cssText = [
    "position:absolute",
    "pointer-events:none",
    "border:0",
    "margin:0",
    "padding:0",
    "box-sizing:border-box",
    "display:none",
    `box-shadow:${outlineShadow}`,
  ].join(";");
  const label = options.label ? overlayRoot.ownerDocument.createElement("span") : undefined;
  if (label) {
    label.dataset.designSpaceSourceOutlineLabel = options.variant;
    label.textContent = options.label ?? "";
    label.style.cssText = [
      "position:absolute",
      "left:0",
      "top:-19px",
      "max-width:240px",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "white-space:nowrap",
      "pointer-events:none",
      "font:500 12px/16px Inter,ui-sans-serif,system-ui,sans-serif",
      `color:${color}`,
      "text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(0,0,0,.8)",
    ].join(";");
    overlay.append(label);
  }
  overlayRoot.append(overlay);

  let frame: number | undefined;
  let previous = "";
  let cachedTarget: HTMLElement | null | undefined;
  let cachedSourceRect: Pick<DOMRect, "height" | "left" | "top" | "width"> | undefined;
  let cachedMetrics: SourceLayerMetrics | undefined;
  let sourceGeometryDirty = true;
  const update = () => {
    frame = undefined;
    const target = cachedTarget?.isConnected
      ? cachedTarget
      : sourceLayerElement(output, layerId, options.occurrence) ?? options.fallback;
    if (!target) {
      overlay.style.display = "none";
      if (previous) options.onMetrics?.(undefined);
      previous = "";
      cachedTarget = null;
      cachedSourceRect = undefined;
      cachedMetrics = undefined;
      return;
    }
    if (cachedTarget !== target) {
      cachedTarget = target;
      sourceGeometryDirty = true;
    }
    if (sourceGeometryDirty || !cachedSourceRect || !cachedMetrics) {
      cachedSourceRect = sourceLayerBounds(target);
      cachedMetrics = measureSourceLayer(cachedSourceRect, output.getBoundingClientRect());
      sourceGeometryDirty = false;
    }
    const sourceRect = cachedSourceRect;
    const rect = sourceLayerOverlayBounds(sourceRect, output, overlayRoot);
    const metrics = cachedMetrics;
    const serialized = `${metrics.x}:${metrics.y}:${metrics.width}:${metrics.height}`;
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${Math.max(1, rect.width)}px`;
    overlay.style.height = `${Math.max(1, rect.height)}px`;
    if (label) label.style.top = rect.top >= 19 ? "-19px" : "2px";
    // Draw the chrome inside its measured rectangle. An outer shadow loses its
    // right and bottom edges whenever the target touches the clipped canvas
    // boundary, which makes ordinary borders look truncated in self-hosted
    // previews.
    if (serialized !== previous) {
      previous = serialized;
      options.onMetrics?.(metrics);
    }
  };
  const schedule = () => {
    if (!ownerWindow || frame !== undefined) return;
    frame = ownerWindow.requestAnimationFrame(update);
  };
  const invalidateSourceGeometry = () => {
    sourceGeometryDirty = true;
    cachedTarget = undefined;
    schedule();
  };
  const mutationObserver = ownerWindow ? new ownerWindow.MutationObserver(invalidateSourceGeometry) : undefined;
  mutationObserver?.observe(output, { attributes: true, childList: true, subtree: true, characterData: true });
  const frameElement = ownerWindow?.frameElement as HTMLElement | null | undefined;
  const parentMutationObserver = hostWindow
    ? new hostWindow.MutationObserver(schedule)
    : undefined;
  for (let current = frameElement; current; current = current.parentElement) {
    parentMutationObserver?.observe(current, { attributes: true, attributeFilter: ["class", "style"] });
  }
  const resizeObserver = ownerWindow && "ResizeObserver" in ownerWindow
    ? new ownerWindow.ResizeObserver(invalidateSourceGeometry)
    : undefined;
  resizeObserver?.observe(output);
  const hostResizeObserver = hostWindow && "ResizeObserver" in hostWindow
    ? new hostWindow.ResizeObserver(schedule)
    : undefined;
  hostResizeObserver?.observe(overlayRoot);
  if (frameElement) hostResizeObserver?.observe(frameElement);
  ownerWindow?.addEventListener("resize", invalidateSourceGeometry);
  hostWindow?.addEventListener("resize", schedule);
  previewDocument.addEventListener("scroll", invalidateSourceGeometry, true);
  overlayRoot.ownerDocument.addEventListener("scroll", schedule, true);
  schedule();
  return () => {
    if (ownerWindow && frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
    mutationObserver?.disconnect();
    parentMutationObserver?.disconnect();
    resizeObserver?.disconnect();
    hostResizeObserver?.disconnect();
    ownerWindow?.removeEventListener("resize", invalidateSourceGeometry);
    hostWindow?.removeEventListener("resize", schedule);
    previewDocument.removeEventListener("scroll", invalidateSourceGeometry, true);
    overlayRoot.ownerDocument.removeEventListener("scroll", schedule, true);
    overlay.remove();
    if (!overlayRoot.childElementCount) overlayRoot.remove();
  };
}

function sourceLayerOverlayRoot(previewDocument: Document): HTMLElement {
  const frame = previewDocument.defaultView?.frameElement as HTMLElement | null | undefined;
  const hostDocument = frame?.ownerDocument ?? previewDocument;
  const canvas = frame?.closest<HTMLElement>("[data-design-space-canvas-viewport]");
  const host = canvas ?? hostDocument.body;
  const existing = [...host.children]
    .find((child): child is HTMLElement => child instanceof HTMLElement && child.id === "design-space-canvas-overlays");
  if (existing) return existing;
  const root = hostDocument.createElement("div");
  root.id = "design-space-canvas-overlays";
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = [
    `position:${canvas ? "absolute" : "fixed"}`,
    "inset:0",
    "z-index:10",
    "pointer-events:none",
    "overflow:hidden",
    "contain:layout style paint",
    "isolation:isolate",
  ].join(";");
  host.append(root);
  return root;
}

function sourceLayerOverlayBounds(
  rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
  output: HTMLElement,
  overlayRoot: HTMLElement,
): Pick<DOMRect, "height" | "left" | "top" | "width"> {
  const frame = output.ownerDocument.defaultView?.frameElement as HTMLElement | null | undefined;
  if (!frame) return rect;
  const frameRect = frame.getBoundingClientRect();
  const overlayRect = overlayRoot.getBoundingClientRect();
  const frameScaleX = frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1;
  const frameScaleY = frame.clientHeight > 0 ? frameRect.height / frame.clientHeight : frameScaleX;
  return {
    left: frameRect.left - overlayRect.left + frame.clientLeft * frameScaleX + rect.left * frameScaleX,
    top: frameRect.top - overlayRect.top + frame.clientTop * frameScaleY + rect.top * frameScaleY,
    width: rect.width * frameScaleX,
    height: rect.height * frameScaleY,
  };
}

export function sourceLayerBounds(target: HTMLElement): Pick<DOMRect, "height" | "left" | "top" | "width"> {
  const own = target.getBoundingClientRect();
  if (own.width > 0 || own.height > 0) return own;
  const descendants = [...target.querySelectorAll<HTMLElement>("*")]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!descendants.length) return own;
  const left = Math.min(...descendants.map((rect) => rect.left));
  const top = Math.min(...descendants.map((rect) => rect.top));
  const right = Math.max(...descendants.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...descendants.map((rect) => rect.top + rect.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function measureSourceLayer(
  rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
  rootRect: Pick<DOMRect, "left" | "top">,
): SourceLayerMetrics {
  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function sourceLayerElement(output: HTMLElement, layerId: string, occurrence = 0): HTMLElement | null {
  return sourceLayerElements(output, layerId)[occurrence] ?? null;
}

export function sourceLayerElements(output: HTMLElement, layerId: string): readonly HTMLElement[] {
  const escapedLayerId = layerId.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [...output.querySelectorAll<HTMLElement>(`[data-design-space-source-layer-id="${escapedLayerId}"]`)];
}
