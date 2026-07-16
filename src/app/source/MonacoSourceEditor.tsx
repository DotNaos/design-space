import "./monaco-environment";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

type MonacoSourceEditorProps = {
  path: string;
  readOnly: boolean;
  value: string;
  onChange: (value: string) => void;
};

export function MonacoSourceEditor(props: MonacoSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const modelRef = useRef<monaco.editor.ITextModel | undefined>(undefined);
  const onChangeRef = useRef(props.onChange);
  const synchronizing = useRef(false);

  useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const uri = monaco.Uri.file(`/${props.path.replace(/^\/+/, "")}`);
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
  }, [props.path]);

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

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}

function languageFor(path: string): string {
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.jsx?$/i.test(path)) return "javascript";
  if (/\.json$/i.test(path)) return "json";
  if (/\.(?:css|scss|less)$/i.test(path)) return "css";
  if (/\.(?:html|htm)$/i.test(path)) return "html";
  return "plaintext";
}
