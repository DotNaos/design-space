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
  return sourceLayerHitAtPreviewPoint(frame, event, accepted, fallbackLayerId)?.layerId;
}

export type SourceLayerHit = { layerId: string; occurrence: number };

export function sourceLayerHitAtPreviewPoint(
  frame: HTMLIFrameElement,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  accepted?: ReadonlySet<string>,
  fallbackLayerId?: string,
): SourceLayerHit | undefined {
  const document = frame.contentDocument;
  if (!document) return fallbackLayerId ? { layerId: fallbackLayerId, occurrence: 0 } : undefined;
  const frameBounds = frame.getBoundingClientRect();
  const point = scalePreviewEventPoint(
    { clientX: event.clientX - frameBounds.left, clientY: event.clientY - frameBounds.top },
    { height: frameBounds.height, width: frameBounds.width },
    { height: document.documentElement.clientHeight, width: document.documentElement.clientWidth },
  );
  const element = sourceLayerElementFromTarget(document.elementFromPoint(point.x, point.y), accepted);
  const layerId = element?.dataset.designSpaceSourceLayerId;
  if (!element || !layerId) return fallbackLayerId ? { layerId: fallbackLayerId, occurrence: 0 } : undefined;
  const root = element.closest<HTMLElement>("#design-space-preview-root") ?? document.body;
  const occurrences = [...root.querySelectorAll<HTMLElement>("[data-design-space-source-layer-id]")]
    .filter((candidate) => candidate.dataset.designSpaceSourceLayerId === layerId);
  return { layerId, occurrence: Math.max(0, occurrences.indexOf(element)) };
}

export function sourceLayerIdFromElement(
  target: EventTarget | null,
  accepted?: ReadonlySet<string>,
): string | undefined {
  return sourceLayerElementFromTarget(target, accepted)?.dataset.designSpaceSourceLayerId;
}

function sourceLayerElementFromTarget(
  target: EventTarget | null,
  accepted?: ReadonlySet<string>,
): HTMLElement | undefined {
  let element = target as Element | null;
  if (!element || typeof element.closest !== "function") return undefined;
  if (!accepted) return element.closest<HTMLElement>("[data-design-space-source-layer-id]") ?? undefined;
  element = element.closest<HTMLElement>("[data-design-space-source-layer-id]");
  while (element) {
    const layerId = (element as HTMLElement).dataset.designSpaceSourceLayerId;
    if (layerId && accepted.has(layerId)) return element as HTMLElement;
    element = element.parentElement?.closest<HTMLElement>("[data-design-space-source-layer-id]") ?? null;
  }
  return undefined;
}
