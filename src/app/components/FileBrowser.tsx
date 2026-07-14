import { ChevronDown, FileCode2, FolderOpen } from "lucide-react";

import type { TargetFileEntry } from "../../shared/target-module";

export function FileBrowser(props: {
  className?: string;
  files: readonly TargetFileEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-3">
        <h2 className="text-xs font-medium text-zinc-300">Project files</h2>
        <span className="text-[9px] text-emerald-400">Allowlisted</span>
      </div>
      <div className="flex-1 overflow-auto py-2 text-xs text-zinc-400">
        {renderChildren(props.files, undefined, 0, props.selectedId, props.onSelect)}
        {props.files.length === 0 && <p className="px-3 py-4 text-[10px] text-zinc-600">No displayable files were declared by this target.</p>}
      </div>
      <p className="border-t border-white/10 p-3 text-[9px] leading-4 text-zinc-600">
        The target server owns this root and file list. Browser input cannot select paths.
      </p>
    </aside>
  );
}

function renderChildren(
  files: readonly TargetFileEntry[],
  parentId: string | undefined,
  depth: number,
  selectedId: string | undefined,
  onSelect: (id: string) => void,
): React.ReactNode {
  return files.filter((file) => file.parentId === parentId).map((file) => (
    <div key={file.id}>
      <button
        aria-selected={selectedId === file.id}
        className={`flex h-11 w-full items-center gap-2 pr-2 text-left lg:h-8 ${selectedId === file.id ? "bg-sky-500/10 text-sky-200" : "hover:bg-white/[0.03]"}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        type="button"
        onClick={() => onSelect(file.id)}
      >
        {file.kind === "directory" ? <><ChevronDown size={13} /><FolderOpen size={14} /></> : <><span className="w-[13px]" /><FileCode2 size={13} /></>}
        <span className="truncate">{file.label}</span>
      </button>
      {file.kind === "directory" && renderChildren(files, file.id, depth + 1, selectedId, onSelect)}
    </div>
  ));
}
