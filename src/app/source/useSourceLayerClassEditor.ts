import { useCallback, useEffect, useState } from "react";

import type { TailwindPreview } from "../../shared/contracts";
import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { sourceWithLayerClassName, sourceWithLayerText } from "./source-layer-class-edit";
import type { SourceFileEditor } from "./useSourceFileEditor";

export function useSourceLayerClassEditor(options: {
  connected: boolean;
  editor: SourceFileEditor;
  layer?: SourceWorkspaceLayer;
}) {
  const binding = options.layer?.kind === "html" ? options.layer.className : undefined;
  const textBinding = options.layer?.text;
  const [value, setValue] = useState(binding?.value ?? "");
  const [textValue, setTextValue] = useState(textBinding?.value ?? "");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setValue(binding?.value ?? "");
    setTextValue(textBinding?.value ?? "");
    setCss("");
    setError(undefined);
  }, [
    binding?.end,
    binding?.start,
    binding?.value,
    options.editor.snapshot?.version,
    textBinding?.end,
    textBinding?.start,
    textBinding?.value,
  ]);

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

  const apply = useCallback((nextClassName: string, nextText: string) => {
    const source = options.editor.snapshot?.source;
    if (source === undefined) return;
    const withText = textBinding ? sourceWithLayerText(source, textBinding, nextText) : source;
    options.editor.setDraft(binding
      ? sourceWithLayerClassName(withText, binding, nextClassName)
      : withText);
  }, [binding, options.editor, textBinding]);

  const change = useCallback((next: string) => {
    setValue(next);
    apply(next, textValue);
  }, [apply, textValue]);

  const changeText = useCallback((next: string) => {
    setTextValue(next);
    apply(value, next);
  }, [apply, value]);

  const reset = useCallback(() => {
    setValue(binding?.value ?? "");
    setTextValue(textBinding?.value ?? "");
    setCss("");
    setError(undefined);
    options.editor.reset();
  }, [binding?.value, options.editor, textBinding?.value]);

  return {
    binding,
    change,
    css,
    editable: Boolean(binding && options.editor.snapshot),
    error,
    reset,
    changeText,
    textBinding,
    textEditable: Boolean(textBinding && options.editor.snapshot),
    textValue,
    value,
  };
}

export type SourceLayerClassEditor = ReturnType<typeof useSourceLayerClassEditor>;
