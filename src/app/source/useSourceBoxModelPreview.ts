import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import type { SourceBoxModelPreviewStore } from "./source-box-model-preview";
import { mountSourceBoxModelPreview } from "./source-box-model-preview";
import { sourceLayerElement } from "./source-preview-selection-overlay";

const emptySubscribe = () => () => undefined;
const emptySnapshot = () => undefined;

export function useSourceBoxModelPreview(options: {
  compiledClassCss?: string;
  output?: HTMLElement;
  previewMode: string;
  projected: boolean;
  selectedLayerId?: string;
  selectedOccurrence: number;
  staticRevision: number;
  store?: SourceBoxModelPreviewStore;
}): void {
  const compiledClassCssRef = useRef(options.compiledClassCss);
  const preview = useSyncExternalStore(
    options.store?.subscribe ?? emptySubscribe,
    options.store?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );

  useEffect(() => {
    if (compiledClassCssRef.current === options.compiledClassCss) return;
    compiledClassCssRef.current = options.compiledClassCss;
    if (preview) options.store?.set();
  }, [options.compiledClassCss, options.store, preview]);

  useLayoutEffect(() => {
    if (!options.output || options.previewMode === "play" || !preview) return undefined;
    const target = options.projected
      ? options.output.firstElementChild as HTMLElement | null
      : options.selectedLayerId
        ? sourceLayerElement(options.output, options.selectedLayerId, options.selectedOccurrence)
        : undefined;
    if (!target) return undefined;
    return mountSourceBoxModelPreview(target, preview);
  }, [
    options.output,
    options.previewMode,
    options.projected,
    options.selectedLayerId,
    options.selectedOccurrence,
    options.staticRevision,
    preview,
  ]);
}
