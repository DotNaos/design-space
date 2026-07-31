export function applyPreviewHtmlClassNames(
  root: HTMLElement,
  values: Readonly<Record<string, string>> | undefined,
): void {
  for (const [selectionId, className] of Object.entries(values ?? {})) {
    const element = root.querySelector<HTMLElement>(`[data-design-space-html-id="${CSS.escape(selectionId)}"]`);
    if (element && element.className !== className) element.className = className;
  }
}

export function isCanvasChromeTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-design-space-canvas-chrome]"));
}
