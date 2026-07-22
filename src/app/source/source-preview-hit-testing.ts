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

export function sourceLayerIdAtPreviewPoint(
  frame: HTMLIFrameElement,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  accepted?: ReadonlySet<string>,
  fallbackLayerId?: string,
): string | undefined {
  const document = frame.contentDocument;
  if (!document) return fallbackLayerId;
  const frameBounds = frame.getBoundingClientRect();
  const point = scalePreviewEventPoint(
    { clientX: event.clientX - frameBounds.left, clientY: event.clientY - frameBounds.top },
    { height: frameBounds.height, width: frameBounds.width },
    { height: document.documentElement.clientHeight, width: document.documentElement.clientWidth },
  );
  return sourceLayerIdFromElement(
    document.elementFromPoint(point.x, point.y),
    accepted,
  ) ?? fallbackLayerId;
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
