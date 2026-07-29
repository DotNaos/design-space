import { useCallback, useEffect, useRef, useState } from "react";

import type { TailwindPreview } from "../../shared/contracts";
import type { SourceDesignScope } from "../../shared/source-design";
import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { runLocalOperation } from "../api";
import { sourceWithLayerVisualState } from "./source-layer-class-edit";
import type { SourceCodeEditor } from "./SourceCodeCanvas";

export function useSourceLayerClassEditor(options: {
  connected: boolean;
  editor: SourceCodeEditor & { reset: () => void };
  layer?: SourceWorkspaceLayer;
  ready?: boolean;
  scope?: SourceDesignScope;
}) {
  const binding = options.layer?.className;
  const textBinding = options.layer?.text;
  const [value, setValue] = useState(binding?.value ?? "");
  const [textValue, setTextValue] = useState(textBinding?.value ?? "");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string>();
  const [classPreview, setClassPreview] = useState<{ target: string; value: string }>();
  const [textPreview, setTextPreview] = useState<{ target: string; value: string }>();
  const editBase = useRef(options.editor.draft);
  const lastCanvasDraft = useRef<string | undefined>(undefined);
  const target = options.editor.snapshot && options.layer
    ? `${options.editor.snapshot.fileId}:${options.layer.id}`
    : undefined;

  useEffect(() => {
    setValue(binding?.value ?? "");
    setTextValue(textBinding?.value ?? "");
    setCss("");
    setError(undefined);
    editBase.current = options.editor.draft;
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
    if (options.editor.draft !== lastCanvasDraft.current) {
      editBase.current = options.editor.draft;
    }
  }, [options.editor.draft]);

  useEffect(() => {
    if (!binding || !options.connected) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({
          type: "compile-tailwind",
          value,
          scope: options.scope,
        });
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
  }, [binding, options.connected, options.scope, value]);

  const apply = useCallback((nextClassName: string, nextText: string) => {
    if (options.ready === false) return false;
    const source = editBase.current;
    if (source === undefined) return false;
    const nextSource = sourceWithLayerVisualState(source, {
      ...(binding ? { className: { binding, value: nextClassName } } : {}),
      ...(textBinding ? { text: { binding: textBinding, value: nextText } } : {}),
    });
    lastCanvasDraft.current = nextSource;
    options.editor.setDraft(nextSource);
    return true;
  }, [binding, options.editor, options.ready, textBinding]);

  const change = useCallback((next: string) => {
    setValue(next);
    setCss("");
    if (apply(next, textValue) && target) setClassPreview({ target, value: next });
  }, [apply, target, textValue]);

  const changeText = useCallback((next: string) => {
    setTextValue(next);
    if (apply(value, next) && target) setTextPreview({ target, value: next });
  }, [apply, target, value]);

  const reset = useCallback(() => {
    setValue(binding?.value ?? "");
    setTextValue(textBinding?.value ?? "");
    setCss("");
    setError(undefined);
    setClassPreview(undefined);
    setTextPreview(undefined);
    lastCanvasDraft.current = undefined;
    options.editor.reset();
  }, [binding?.value, options.editor, textBinding?.value]);

  const previewCurrent = Boolean(
    target
    && options.editor.draft === lastCanvasDraft.current,
  );
  const previewValue = previewCurrent && classPreview && classPreview.target === target
    ? classPreview.value
    : undefined;
  const previewTextValue = previewCurrent && textPreview && textPreview.target === target
    ? textPreview.value
    : undefined;

  return {
    binding,
    change,
    css,
    editable: Boolean(binding && options.editor.snapshot && options.ready !== false),
    error,
    reset,
    changeText,
    previewCss: previewValue === undefined ? "" : css,
    previewTextValue,
    previewValue,
    textBinding,
    textEditable: Boolean(textBinding && options.editor.snapshot && options.ready !== false),
    textValue,
    value,
  };
}

export type SourceLayerClassEditor = ReturnType<typeof useSourceLayerClassEditor>;
