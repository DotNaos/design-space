import { useCallback, useEffect, useState } from "react";

import type { TailwindPreview } from "../../shared/contracts";
import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { sourceWithLayerClassName } from "./source-layer-class-edit";
import type { SourceFileEditor } from "./useSourceFileEditor";

export function useSourceLayerClassEditor(options: {
  connected: boolean;
  editor: SourceFileEditor;
  layer?: SourceWorkspaceLayer;
}) {
  const binding = options.layer?.kind === "html" ? options.layer.className : undefined;
  const [value, setValue] = useState(binding?.value ?? "");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setValue(binding?.value ?? "");
    setCss("");
    setError(undefined);
  }, [binding?.end, binding?.start, binding?.value, options.editor.snapshot?.version]);

  useEffect(() => {
    if (!binding || !options.connected) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({ type: "compile-tailwind", value });
        if (!cancelled) {
          setCss(result.css);
          setError(undefined);
        }
      } catch (reason) {
        if (!cancelled) {
          setCss("");
          setError(reason instanceof Error ? reason.message : "The Tailwind draft did not compile.");
        }
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [binding, options.connected, value]);

  const change = useCallback((next: string) => {
    setValue(next);
    const source = options.editor.snapshot?.source;
    if (binding && source !== undefined) {
      options.editor.setDraft(sourceWithLayerClassName(source, binding, next));
    }
  }, [binding, options.editor]);

  const reset = useCallback(() => {
    setValue(binding?.value ?? "");
    setCss("");
    setError(undefined);
    options.editor.reset();
  }, [binding?.value, options.editor]);

  return {
    binding,
    change,
    css,
    editable: Boolean(binding && options.editor.snapshot),
    error,
    reset,
    value,
  };
}

export type SourceLayerClassEditor = ReturnType<typeof useSourceLayerClassEditor>;
