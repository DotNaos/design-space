import { Button } from "@heroui/react";
import { Code2, Eye, LoaderCircle, LockKeyhole } from "lucide-react";
import { lazy, Suspense } from "react";

import type { SourceFileEditor } from "./useSourceFileEditor";

const MonacoSourceEditor = lazy(async () => {
  const module = await import("./MonacoSourceEditor");
  return { default: module.MonacoSourceEditor };
});

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
          <div className="min-h-0 flex-1">
            <Suspense fallback={<div className="grid h-full place-items-center text-xs text-zinc-600"><LoaderCircle className="animate-spin" size={14} /> Loading editor…</div>}>
              <MonacoSourceEditor
                key={editor.snapshot.fileId}
                path={props.path ?? editor.snapshot.label}
                readOnly={!props.editable}
                value={editor.draft}
                onChange={editor.setDraft}
              />
            </Suspense>
          </div>
          {editor.error && <p className="shrink-0 border-t border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[10px] leading-4 text-amber-300">{editor.error}</p>}
        </>
      )}
    </section>
  );
}
