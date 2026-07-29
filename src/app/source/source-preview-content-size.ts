export type SourcePreviewContentSize = {
  height: number;
  width: number;
};

export function measureSourcePreviewContent(output: HTMLElement): SourcePreviewContentSize | undefined {
  const outputRect = output.getBoundingClientRect();
  const candidates = [...output.querySelectorAll<HTMLElement>("[data-design-space-source-layer-id]")]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height > 0 && rect.width > 0);
  if (!candidates.length) return undefined;

  const visible = candidates.filter(({ element, rect }) => {
    const containsNestedLayer = Boolean(element.querySelector("[data-design-space-source-layer-id]"));
    const fillsPreview = rect.width >= outputRect.width - 1 && rect.height >= outputRect.height - 1;
    return !containsNestedLayer || !fillsPreview;
  });
  const measured = visible.length ? visible : candidates;
  const left = Math.min(...measured.map(({ rect }) => rect.left));
  const top = Math.min(...measured.map(({ rect }) => rect.top));
  const right = Math.max(...measured.map(({ rect }) => rect.right));
  const bottom = Math.max(...measured.map(({ rect }) => rect.bottom));

  return {
    height: Math.max(1, Math.ceil(bottom - top)),
    width: Math.max(1, Math.ceil(right - left)),
  };
}
