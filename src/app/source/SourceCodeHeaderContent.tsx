import { Button } from "@heroui/react";
import { Code2, Eye, FolderOpen, LockKeyhole } from "lucide-react";
import { SourceCodeEditor } from "./SourceCodeCanvas";

export function SourceCodeHeaderContent(props: {
  editable: boolean;
  editor: SourceCodeEditor;
  label: string;
  path?: string;
  toolbar?: React.ReactNode;
  onRevealInFiles?: () => void;
  onPreview?: () => void;
}) {
  return (
    <>
      <Code2 aria-hidden="true" className="shrink-0 text-sky-300" size={13} />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-300">{props.label}</span>
      {props.path && <span className="hidden max-w-[42%] truncate text-[9px] text-zinc-600 xl:block">{props.path}</span>}
      {props.toolbar}
      {props.onRevealInFiles && (
        <Button
          aria-label="Show current source in Files"
          className="h-6 min-w-0 shrink-0 gap-1 rounded-full bg-white/[0.055] px-2 text-[9px] text-zinc-400 hover:bg-white/[0.09] hover:text-white"
          size="sm"
          variant="ghost"
          onPress={props.onRevealInFiles}
        >
          <FolderOpen aria-hidden="true" size={11} />
          Files
        </Button>
      )}
      <span className={`flex shrink-0 items-center gap-1 text-[9px] ${props.editable ? props.editor.dirty ? "text-amber-300" : "text-emerald-400" : "text-zinc-600"}`}>
        {!props.editable && <LockKeyhole aria-hidden="true" size={10} />}
        {props.editable ? props.editor.dirty ? "Unsaved" : "Editable" : "Read only"}
      </span>
      {props.onPreview && <Button aria-label="Preview in canvas" className="min-h-0 h-6 min-w-0 gap-1 rounded px-2 text-[9px] text-zinc-500" size="sm" variant="ghost" onPress={props.onPreview}><Eye size={11} />Preview</Button>}
    </>
  );
}
