import "./monaco-environment";

import { useEffect, useId, useRef } from "react";
import * as monaco from "monaco-editor";
import * as typeScriptContribution from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import type { SourceLayerBinding } from "../../shared/source-workspace";
import { monacoModelPath } from "./monaco-model-path";

configureMonacoTypeScript();

type MonacoSourceEditorProps = {
  path: string;
  readOnly: boolean;
  value: string;
  selection?: SourceLayerBinding;
  onChange: (value: string) => void;
};

export function MonacoSourceEditor(props: MonacoSourceEditorProps) {
  const modelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const modelRef = useRef<monaco.editor.ITextModel | undefined>(undefined);
  const onChangeRef = useRef(props.onChange);
  const synchronizing = useRef(false);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const uri = monaco.Uri.file(monacoModelPath(props.path, modelId));
    const model = monaco.editor.createModel(props.value, languageFor(props.path), uri);
    const editor = monaco.editor.create(container, {
      model,
      theme: "vs-dark",
      readOnly: props.readOnly,
      ariaLabel: "Source code",
      automaticLayout: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 20,
      minimap: { enabled: false },
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      wordWrap: "off",
    });
    const subscription = model.onDidChangeContent(() => {
      if (!synchronizing.current) onChangeRef.current(model.getValue());
    });

    modelRef.current = model;
    editorRef.current = editor;
    return () => {
      subscription.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = undefined;
      modelRef.current = undefined;
    };
  }, [modelId, props.path]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: props.readOnly });
  }, [props.readOnly]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue() === props.value) return;
    const position = editorRef.current?.getPosition();
    synchronizing.current = true;
    model.setValue(props.value);
    synchronizing.current = false;
    if (position) editorRef.current?.setPosition(position);
  }, [props.value]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = modelRef.current;
    if (!editor || !model) return;
    const selection = props.selection;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, selection ? [{
      range: monaco.Range.fromPositions(
        model.getPositionAt(selection.start),
        model.getPositionAt(Math.max(selection.start + 1, selection.end)),
      ),
      options: {
        className: "design-space-source-selection",
        isWholeLine: true,
        linesDecorationsClassName: "design-space-source-selection-gutter",
      },
    }] : []);
    if (selection) editor.revealRangeInCenterIfOutsideViewport(monaco.Range.fromPositions(
      model.getPositionAt(selection.start),
      model.getPositionAt(Math.max(selection.start + 1, selection.end)),
    ));
  }, [props.selection, props.value]);

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}

function configureMonacoTypeScript() {
  const diagnostics = {
    // The editor intentionally opens one trusted file at a time. Project-wide
    // semantic validation remains the server compiler's responsibility.
    noSemanticValidation: true,
    noSyntaxValidation: false,
  };
  type LanguageDefaults = {
    getCompilerOptions: () => Record<string, unknown>;
    setCompilerOptions: (options: Record<string, unknown>) => void;
    setDiagnosticsOptions: (options: typeof diagnostics) => void;
  };
  const contribution = typeScriptContribution as unknown as {
    JsxEmit: { ReactJSX: number };
    javascriptDefaults: LanguageDefaults;
    typescriptDefaults: LanguageDefaults;
  };
  for (const language of [contribution.typescriptDefaults, contribution.javascriptDefaults]) {
    language.setCompilerOptions({
      ...language.getCompilerOptions(),
      allowNonTsExtensions: true,
      jsx: contribution.JsxEmit.ReactJSX,
    });
    language.setDiagnosticsOptions(diagnostics);
  }
}

function languageFor(path: string): string {
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.jsx?$/i.test(path)) return "javascript";
  if (/\.json$/i.test(path)) return "json";
  if (/\.(?:css|scss|less)$/i.test(path)) return "css";
  if (/\.(?:html|htm)$/i.test(path)) return "html";
  return "plaintext";
}
