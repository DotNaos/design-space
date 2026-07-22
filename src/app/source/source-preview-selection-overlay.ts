import type { SourceLayerMetrics } from "./source-layer-design";

export function mountSourceLayerSelection(
  document: Document,
  output: HTMLElement,
  layerId: string,
  tone: "component" | "layer",
  onMetrics?: (metrics: SourceLayerMetrics | undefined) => void,
  fallback?: HTMLElement | null,
): () => void {
  const ownerWindow = document.defaultView;
  const overlay = document.createElement("div");
  overlay.dataset.designSpaceSourceSelection = layerId;
  overlay.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "pointer-events:none",
    `border:1.5px solid ${tone === "component" ? "#a855f7" : "#38bdf8"}`,
    "box-sizing:border-box",
    "display:none",
  ].join(";");
  for (const position of ["top:0;left:0", "top:0;right:0", "bottom:0;left:0", "bottom:0;right:0"]) {
    const handle = document.createElement("span");
    handle.style.cssText = `${position};position:absolute;width:7px;height:7px;transform:translate(var(--tx),var(--ty));border:1px solid ${tone === "component" ? "#a855f7" : "#38bdf8"};background:#f4f4f5;box-sizing:border-box`;
    handle.style.setProperty("--tx", position.includes("left") ? "-50%" : "50%");
    handle.style.setProperty("--ty", position.includes("top") ? "-50%" : "50%");
    overlay.append(handle);
  }
  document.body.append(overlay);

  let frame: number | undefined;
  let previous = "";
  const update = () => {
    frame = undefined;
    const target = sourceLayerElement(output, layerId) ?? fallback;
    if (!target) {
      overlay.style.display = "none";
      if (previous) onMetrics?.(undefined);
      previous = "";
      return;
    }
    const rect = sourceLayerBounds(target);
    const metrics = measureSourceLayer(rect, output.getBoundingClientRect());
    const serialized = `${metrics.x}:${metrics.y}:${metrics.width}:${metrics.height}`;
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${Math.max(1, rect.width)}px`;
    overlay.style.height = `${Math.max(1, rect.height)}px`;
    if (serialized !== previous) {
      previous = serialized;
      onMetrics?.(metrics);
    }
  };
  const schedule = () => {
    if (!ownerWindow || frame !== undefined) return;
    frame = ownerWindow.requestAnimationFrame(update);
  };
  const mutationObserver = ownerWindow ? new ownerWindow.MutationObserver(schedule) : undefined;
  mutationObserver?.observe(output, { attributes: true, childList: true, subtree: true, characterData: true });
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
    resizeObserver?.disconnect();
    ownerWindow?.removeEventListener("resize", schedule);
    document.removeEventListener("scroll", schedule, true);
    overlay.remove();
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
