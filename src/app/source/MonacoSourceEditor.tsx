import "./monaco-environment";

import { useEffect, useId, useRef } from "react";
import * as monaco from "monaco-editor";
import type { SourceLayerBinding } from "../../shared/source-workspace";
import { configureMonacoTypeScript, sourceLanguageFor } from "./monaco-source-language";
import { monacoModelPath } from "./monaco-model-path";

configureMonacoTypeScript();

type MonacoSourceEditorProps = {
  path: string;
  readOnly: boolean;
  value: string;
  selection?: SourceLayerBinding;
  onChange: (value: string) => void;
  onCursorOffsetChange?: (offset: number) => void;
};

export function MonacoSourceEditor(props: MonacoSourceEditorProps) {
  const modelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const modelRef = useRef<monaco.editor.ITextModel | undefined>(undefined);
  const onChangeRef = useRef(props.onChange);
  const onCursorOffsetChangeRef = useRef(props.onCursorOffsetChange);
  const synchronizing = useRef(false);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  useEffect(() => {
    onCursorOffsetChangeRef.current = props.onCursorOffsetChange;
  }, [props.onCursorOffsetChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const uri = monaco.Uri.file(monacoModelPath(props.path, modelId));
    const model = monaco.editor.createModel(props.value, sourceLanguageFor(props.path), uri);
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
    const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
      onCursorOffsetChangeRef.current?.(model.getOffsetAt(event.position));
    });

    modelRef.current = model;
    editorRef.current = editor;
    return () => {
      subscription.dispose();
      cursorSubscription.dispose();
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
