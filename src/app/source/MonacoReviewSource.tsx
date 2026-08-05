import "./monaco-environment";

import { useEffect, useId, useRef } from "react";
import * as monaco from "monaco-editor";

import { currentDesignSpaceTheme, subscribeDesignSpaceTheme } from "../shell/design-space-theme";
import { configureMonacoTypeScript, sourceLanguageFor } from "./monaco-source-language";
import { monacoModelPath } from "./monaco-model-path";

configureMonacoTypeScript();

export function MonacoReviewSource(props: { ariaLabel: string; path: string; value: string }) {
  const modelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const model = monaco.editor.createModel(
      props.value,
      sourceLanguageFor(props.path),
      monaco.Uri.file(monacoModelPath(props.path, modelId)),
    );
    const editor = monaco.editor.create(container, {
      ariaLabel: props.ariaLabel,
      automaticLayout: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 20,
      minimap: { enabled: false },
      model,
      padding: { top: 14, bottom: 14 },
      readOnly: true,
      renderLineHighlight: "none",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      theme: currentDesignSpaceTheme() === "light" ? "vs" : "vs-dark",
      wordWrap: "off",
    });

    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [modelId, props.ariaLabel, props.path, props.value]);

  useEffect(() => subscribeDesignSpaceTheme((theme) => {
    monaco.editor.setTheme(theme === "light" ? "vs" : "vs-dark");
  }), []);

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}
