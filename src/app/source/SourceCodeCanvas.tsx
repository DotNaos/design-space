import { Button, Label, TextArea, TextField } from "@heroui/react";
import { Code2, Eye, LoaderCircle, LockKeyhole } from "lucide-react";

import type { SourceFileEditor } from "./useSourceFileEditor";

export function SourceCodeCanvas(props: {
  editor: SourceFileEditor;
  editable: boolean;
  label: string;
  path?: string;
  toolbar?: React.ReactNode;
  onPreview?: () => void;
}) {
  const editor = props.editor;
  return (
    <section aria-label="Source code workspace" className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#0d0e10]">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#101113] px-3">
        <Code2 aria-hidden="true" className="text-sky-300" size={13} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-300">{props.label}</span>
        {props.path && <span className="hidden max-w-[50%] truncate text-[9px] text-zinc-600 xl:block">{props.path}</span>}
        {props.toolbar}
        <span className={`flex items-center gap-1 text-[9px] ${props.editable ? editor.dirty ? "text-amber-300" : "text-emerald-400" : "text-zinc-600"}`}>
          {!props.editable && <LockKeyhole aria-hidden="true" size={10} />}
          {props.editable ? editor.dirty ? "Unsaved" : "Editable" : "Read only"}
        </span>
        {props.onPreview && <Button aria-label="Preview in canvas" className="min-h-0 h-6 min-w-0 gap-1 rounded px-2 text-[9px] text-zinc-500" size="sm" variant="ghost" onPress={props.onPreview}><Eye size={11} />Preview</Button>}
      </header>
      {editor.loading ? (
        <div className="grid min-h-0 flex-1 place-items-center text-xs text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Opening source…</div>
      ) : !editor.snapshot ? (
        <div className="min-h-0 flex-1 p-5 text-xs leading-5 text-amber-300">{editor.error ?? "Select a source file to open it here."}</div>
      ) : (
        <>
          <TextField className="flex min-h-0 flex-1" value={editor.draft} onChange={props.editable ? editor.setDraft : undefined}>
            <Label className="sr-only">Source code</Label>
            <TextArea
              aria-label="Source code"
              className="min-h-0 flex-1 resize-none rounded-none border-0 bg-[#0d0e10] p-5 font-mono text-[12px] leading-5 text-zinc-300 outline-none selection:bg-sky-500/30"
              readOnly={!props.editable}
              spellCheck={false}
            />
          </TextField>
          {editor.error && <p className="shrink-0 border-t border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[10px] leading-4 text-amber-300">{editor.error}</p>}
        </>
      )}
    </section>
  );
}
