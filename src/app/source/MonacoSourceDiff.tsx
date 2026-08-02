import "./monaco-environment";

import { useEffect, useId, useRef } from "react";
import * as monaco from "monaco-editor";

import { configureMonacoTypeScript, sourceLanguageFor } from "./monaco-source-language";
import { monacoModelPath } from "./monaco-model-path";
import { currentDesignSpaceTheme, subscribeDesignSpaceTheme } from "../shell/design-space-theme";

configureMonacoTypeScript();

export function MonacoSourceDiff(props: { modified: string; original: string; path: string }) {
  const modelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<monaco.editor.ITextModel | undefined>(undefined);
  const modifiedRef = useRef<monaco.editor.ITextModel | undefined>(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const language = sourceLanguageFor(props.path);
    const original = monaco.editor.createModel(
      props.original,
      language,
      monaco.Uri.file(monacoModelPath(`${props.path}.before`, modelId)),
    );
    const modified = monaco.editor.createModel(
      props.modified,
      language,
      monaco.Uri.file(monacoModelPath(`${props.path}.after`, modelId)),
    );
    const editor = monaco.editor.createDiffEditor(container, {
      automaticLayout: true,
      diffAlgorithm: "advanced",
      diffWordWrap: "off",
      enableSplitViewResizing: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 11,
      ignoreTrimWhitespace: false,
      lineHeight: 19,
      minimap: { enabled: false },
      modifiedAriaLabel: "After source",
      originalAriaLabel: "Before source",
      originalEditable: false,
      padding: { top: 12, bottom: 12 },
      readOnly: true,
      renderIndicators: true,
      renderMarginRevertIcon: false,
      renderOverviewRuler: false,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      theme: currentDesignSpaceTheme() === "light" ? "vs" : "vs-dark",
      useInlineViewWhenSpaceIsLimited: false,
    });
    editor.setModel({ original, modified });
    originalRef.current = original;
    modifiedRef.current = modified;
    return () => {
      editor.dispose();
      original.dispose();
      modified.dispose();
      originalRef.current = undefined;
      modifiedRef.current = undefined;
    };
  }, [modelId, props.path]);

  useEffect(() => subscribeDesignSpaceTheme((theme) => {
    monaco.editor.setTheme(theme === "light" ? "vs" : "vs-dark");
  }), []);

  useEffect(() => {
    if (originalRef.current?.getValue() !== props.original) originalRef.current?.setValue(props.original);
    if (modifiedRef.current?.getValue() !== props.modified) modifiedRef.current?.setValue(props.modified);
  }, [props.modified, props.original]);

  return <div ref={containerRef} aria-label="Source diff editor" className="h-full min-h-0 w-full" />;
}
