import type { SourceLayerMetrics } from "./source-layer-design";

export function mountSourceLayerSelection(
  output: HTMLElement,
  layerId: string,
  tone: "component" | "layer",
  onMetrics?: (metrics: SourceLayerMetrics | undefined) => void,
  fallback?: HTMLElement | null,
): () => void {
  return mountSourceLayerOutline(output, layerId, {
    fallback,
    onMetrics,
    tone,
    variant: "selection",
  });
}

export function mountSourceLayerHover(
  output: HTMLElement,
  layerId: string,
  fallback?: HTMLElement | null,
): () => void {
  return mountSourceLayerOutline(output, layerId, {
    fallback,
    tone: "layer",
    variant: "hover",
  });
}

function mountSourceLayerOutline(
  output: HTMLElement,
  layerId: string,
  options: {
    fallback?: HTMLElement | null;
    onMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
    tone: "component" | "layer";
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
  const color = options.tone === "component" ? "#a855f7" : "#38bdf8";
  overlay.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "border:0",
    "margin:0",
    "padding:0",
    "box-sizing:border-box",
    "display:none",
  ].join(";");
  if (options.variant === "selection") {
    for (const position of ["top:0;left:0", "top:0;right:0", "bottom:0;left:0", "bottom:0;right:0"]) {
      const handle = overlayRoot.ownerDocument.createElement("span");
      handle.style.cssText = [
        position,
        "position:absolute",
        "display:block",
        "margin:0",
        "padding:0",
        "transform:translate(-50%,-50%)",
        "background:#f4f4f5",
        "box-sizing:border-box",
      ].join(";");
      overlay.append(handle);
    }
  }
  overlayRoot.append(overlay);

  let frame: number | undefined;
  let previous = "";
  const update = () => {
    frame = undefined;
    const target = sourceLayerElement(output, layerId) ?? options.fallback;
    if (!target) {
      overlay.style.display = "none";
      if (previous) options.onMetrics?.(undefined);
      previous = "";
      return;
    }
    const sourceRect = sourceLayerBounds(target);
    const rect = sourceLayerOverlayBounds(sourceRect, output);
    const metrics = measureSourceLayer(sourceRect, output.getBoundingClientRect());
    const serialized = `${metrics.x}:${metrics.y}:${metrics.width}:${metrics.height}`;
    const outlineWidth = options.variant === "selection" ? 1.5 : 1;
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${Math.max(1, rect.width)}px`;
    overlay.style.height = `${Math.max(1, rect.height)}px`;
    overlay.style.boxShadow = `0 0 0 ${outlineWidth}px ${color}`;
    if (options.variant === "selection") {
      const handleSize = 6;
      for (const handle of overlay.querySelectorAll<HTMLElement>("span")) {
        handle.style.width = `${handleSize}px`;
        handle.style.height = `${handleSize}px`;
        handle.style.border = `1px solid ${color}`;
      }
    }
    if (serialized !== previous) {
      previous = serialized;
      options.onMetrics?.(metrics);
    }
  };
  const schedule = () => {
    if (!ownerWindow || frame !== undefined) return;
    frame = ownerWindow.requestAnimationFrame(update);
  };
  const mutationObserver = ownerWindow ? new ownerWindow.MutationObserver(schedule) : undefined;
  mutationObserver?.observe(output, { attributes: true, childList: true, subtree: true, characterData: true });
  const frameElement = ownerWindow?.frameElement as HTMLElement | null | undefined;
  const parentMutationObserver = hostWindow
    ? new hostWindow.MutationObserver(schedule)
    : undefined;
  for (let current = frameElement; current; current = current.parentElement) {
    parentMutationObserver?.observe(current, { attributes: true, attributeFilter: ["class", "style"] });
  }
  const resizeObserver = ownerWindow && "ResizeObserver" in ownerWindow
    ? new ownerWindow.ResizeObserver(schedule)
    : undefined;
  resizeObserver?.observe(output);
  const hostResizeObserver = hostWindow && "ResizeObserver" in hostWindow
    ? new hostWindow.ResizeObserver(schedule)
    : undefined;
  hostResizeObserver?.observe(overlayRoot);
  if (frameElement) hostResizeObserver?.observe(frameElement);
  ownerWindow?.addEventListener("resize", schedule);
  hostWindow?.addEventListener("resize", schedule);
  previewDocument.addEventListener("scroll", schedule, true);
  overlayRoot.ownerDocument.addEventListener("scroll", schedule, true);
  schedule();
  return () => {
    if (ownerWindow && frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
    mutationObserver?.disconnect();
    parentMutationObserver?.disconnect();
    resizeObserver?.disconnect();
    hostResizeObserver?.disconnect();
    ownerWindow?.removeEventListener("resize", schedule);
    hostWindow?.removeEventListener("resize", schedule);
    previewDocument.removeEventListener("scroll", schedule, true);
    overlayRoot.ownerDocument.removeEventListener("scroll", schedule, true);
    overlay.remove();
    if (!overlayRoot.childElementCount) overlayRoot.remove();
  };
}

function sourceLayerOverlayRoot(previewDocument: Document): HTMLElement {
  const frame = previewDocument.defaultView?.frameElement as HTMLElement | null | undefined;
  const hostDocument = frame?.ownerDocument ?? previewDocument;
  const existing = hostDocument.getElementById("design-space-canvas-overlays");
  if (existing) return existing;
  const root = hostDocument.createElement("div");
  root.id = "design-space-canvas-overlays";
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "pointer-events:none",
    "overflow:visible",
    "contain:layout style",
    "isolation:isolate",
  ].join(";");
  hostDocument.body.append(root);
  return root;
}

function sourceLayerOverlayBounds(
  rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
  output: HTMLElement,
): Pick<DOMRect, "height" | "left" | "top" | "width"> {
  const frame = output.ownerDocument.defaultView?.frameElement as HTMLElement | null | undefined;
  if (!frame) return rect;
  const frameRect = frame.getBoundingClientRect();
  const frameScaleX = frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1;
  const frameScaleY = frame.clientHeight > 0 ? frameRect.height / frame.clientHeight : frameScaleX;
  return {
    left: frameRect.left + frame.clientLeft * frameScaleX + rect.left * frameScaleX,
    top: frameRect.top + frame.clientTop * frameScaleY + rect.top * frameScaleY,
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

export function sourceLayerElement(output: HTMLElement, layerId: string): HTMLElement | null {
  return [...output.querySelectorAll<HTMLElement>("[data-design-space-source-layer-id]")]
    .find((element) => element.dataset.designSpaceSourceLayerId === layerId) ?? null;
}
