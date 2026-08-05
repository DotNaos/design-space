
import { LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";

import type { ProjectFileSnapshot } from "../../shared/contracts";
import type { SourceLayerBinding } from "../../shared/source-workspace";
import { SourceCodeHeaderContent } from "./SourceCodeHeaderContent";
import type { SourceCodeSelectionContext } from "./source-feedback";

const MonacoSourceEditor = lazy(async () => {
  const module = await import("./MonacoSourceEditor");
  return { default: module.MonacoSourceEditor };
});

export function SourceCodeCanvas(props: {
  editor: SourceCodeEditor;
  editable: boolean;
  label: string;
  path?: string;
  selection?: SourceLayerBinding;
  toolbar?: React.ReactNode;
  onCursorOffsetChange?: (offset: number) => void;
  onAnnotateSelection?: (selection: SourceCodeSelectionContext, comment: string) => void;
  onAttachSelection?: (selection: SourceCodeSelectionContext) => void;
  onPreview?: () => void;
  onRevealInFiles?: () => void;
  showHeader?: boolean;
}) {
  const editor = props.editor;
  return (
    <section aria-label="Source code workspace" className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#0d0e10]">
      {props.showHeader !== false ? (
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#101113] px-3">
          <SourceCodeHeaderContent {...props} />
        </header>
      ) : null}
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
                selection={props.selection}
                value={editor.draft}
                onChange={editor.setDraft}
                onAnnotateSelection={props.onAnnotateSelection}
                onAttachSelection={props.onAttachSelection}
                onCursorOffsetChange={props.onCursorOffsetChange}
              />
            </Suspense>
          </div>
          {editor.error && <p className="shrink-0 border-t border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[10px] leading-4 text-amber-300">{editor.error}</p>}
        </>
      )}
    </section>
  );
}

export type SourceCodeEditor = {
  draft: string;
  dirty: boolean;
  error?: string;
  loading: boolean;
  snapshot?: ProjectFileSnapshot;
  setDraft: (source: string) => void;
};

export { SourceCodeHeaderContent } from "./SourceCodeHeaderContent";
