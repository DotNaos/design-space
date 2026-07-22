import type { SourceLayerMetrics } from "./source-layer-design";

export function mountSourceLayerSelection(
  document: Document,
  output: HTMLElement,
  layerId: string,
  tone: "component" | "layer",
  onMetrics?: (metrics: SourceLayerMetrics | undefined) => void,
  fallback?: HTMLElement | null,
): () => void {
  return mountSourceLayerOutline(document, output, layerId, {
    fallback,
    onMetrics,
    tone,
    variant: "selection",
  });
}

export function mountSourceLayerHover(
  document: Document,
  output: HTMLElement,
  layerId: string,
  fallback?: HTMLElement | null,
): () => void {
  return mountSourceLayerOutline(document, output, layerId, {
    fallback,
    tone: "layer",
    variant: "hover",
  });
}

function mountSourceLayerOutline(
  document: Document,
  output: HTMLElement,
  layerId: string,
  options: {
    fallback?: HTMLElement | null;
    onMetrics?: (metrics: SourceLayerMetrics | undefined) => void;
    tone: "component" | "layer";
    variant: "hover" | "selection";
  },
): () => void {
  const ownerWindow = document.defaultView;
  const overlayRoot = sourceLayerOverlayRoot(document);
  const overlay = document.createElement("div");
  if (options.variant === "selection") overlay.dataset.designSpaceSourceSelection = layerId;
  else overlay.dataset.designSpaceSourceHover = layerId;
  const color = options.tone === "component" ? "#a855f7" : "#38bdf8";
  overlay.style.cssText = [
    "position:absolute",
    "pointer-events:none",
    "border:0",
    "margin:0",
    "padding:0",
    "box-sizing:border-box",
    "display:none",
  ].join(";");
  if (options.variant === "selection") {
    for (const position of ["top:0;left:0", "top:0;right:0", "bottom:0;left:0", "bottom:0;right:0"]) {
      const handle = document.createElement("span");
      handle.style.cssText = `${position};position:absolute;background:#f4f4f5;box-sizing:border-box`;
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
    const rect = sourceLayerBounds(target);
    const metrics = measureSourceLayer(rect, output.getBoundingClientRect());
    const serialized = `${metrics.x}:${metrics.y}:${metrics.width}:${metrics.height}`;
    const scale = sourcePreviewScale(document);
    const outlineWidth = (options.variant === "selection" ? 1.5 : 1) / scale;
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${Math.max(1, rect.width)}px`;
    overlay.style.height = `${Math.max(1, rect.height)}px`;
    overlay.style.boxShadow = `0 0 0 ${outlineWidth}px ${color}`;
    if (options.variant === "selection") {
      const handleSize = 6 / scale;
      for (const handle of overlay.querySelectorAll<HTMLElement>("span")) {
        handle.style.width = `${handleSize}px`;
        handle.style.height = `${handleSize}px`;
        handle.style.border = `${1 / scale}px solid ${color}`;
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
  const parentMutationObserver = frameElement?.ownerDocument.defaultView
    ? new frameElement.ownerDocument.defaultView.MutationObserver(schedule)
    : undefined;
  for (let current = frameElement; current; current = current.parentElement) {
    parentMutationObserver?.observe(current, { attributes: true, attributeFilter: ["class", "style"] });
  }
  const resizeObserver = ownerWindow && "ResizeObserver" in ownerWindow
    ? new ownerWindow.ResizeObserver(schedule)
    : undefined;
  resizeObserver?.observe(output);
  ownerWindow?.addEventListener("resize", schedule);
  document.addEventListener("scroll", schedule, true);
  schedule();
  return () => {
    if (ownerWindow && frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
    mutationObserver?.disconnect();
    parentMutationObserver?.disconnect();
    resizeObserver?.disconnect();
    ownerWindow?.removeEventListener("resize", schedule);
    document.removeEventListener("scroll", schedule, true);
    overlay.remove();
  };
}

function sourceLayerOverlayRoot(document: Document): HTMLElement {
  const existing = document.getElementById("design-space-preview-overlays");
  if (existing) return existing;
  const root = document.createElement("div");
  root.id = "design-space-preview-overlays";
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "pointer-events:none",
    "overflow:hidden",
    "contain:strict",
    "isolation:isolate",
  ].join(";");
  document.body.append(root);
  return root;
}

function sourcePreviewScale(document: Document): number {
  const frame = document.defaultView?.frameElement as HTMLElement | null | undefined;
  if (!frame) return 1;
  const layoutWidth = frame.clientWidth;
  const renderedWidth = frame.getBoundingClientRect().width;
  return layoutWidth > 0 && renderedWidth > 0 ? Math.max(0.01, renderedWidth / layoutWidth) : 1;
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
