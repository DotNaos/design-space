import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import type { SourceWorkspaceFileEntry } from "../../shared/source-workspace";
import { FileTreeLevel } from "./FileTreeLevel";

export interface ProjectFileBrowserProps {
  className?: string;
  files: readonly SourceWorkspaceFileEntry[];
  title?: string;
  selectedFileId?: string;
  showIgnored?: boolean;
  header?: ReactNode;
  onSelect: (fileId: string) => void;
}

export function ProjectFileBrowser(props: ProjectFileBrowserProps) {
  const directoryIds = useMemo(
    () => props.files.filter((entry) => entry.kind === "directory").map((entry) => entry.id),
    [props.files],
  );
  const rootDirectoryIds = useMemo(
    () => props.files.filter((entry) => entry.kind === "directory" && !entry.parentId).map((entry) => entry.id),
    [props.files],
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(rootDirectoryIds));

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set([...current].filter((id) => directoryIds.includes(id)));
      for (const id of rootDirectoryIds) next.add(id);
      return next;
    });
  }, [directoryIds.join("\u0000"), rootDirectoryIds.join("\u0000")]);

  useEffect(() => {
    if (!props.selectedFileId) return;
    const parents = ancestorDirectoryIds(props.files, props.selectedFileId);
    if (!parents.length) return;
    setExpanded((current) => new Set([...current, ...parents]));
  }, [props.files, props.selectedFileId]);

  const childrenByParent = useMemo(() => indexChildren(props.files), [props.files]);
  const fileCount = props.files.filter((entry) => entry.kind === "file").length;

  const toggleDirectory = (directoryId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(directoryId)) next.delete(directoryId);
      else next.add(directoryId);
      return next;
    });
  };

  return (
    <aside
      aria-label={`${props.title ?? "Project files"} browser`}
      className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      <header className="flex min-h-11 items-center gap-2 border-b border-white/10 px-3">
        {props.header ?? (
          <>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xs font-medium text-zinc-300">{props.title ?? "Project files"}</h2>
              <p className="mt-0.5 text-[9px] text-zinc-600">{fileCount} allowlisted {fileCount === 1 ? "file" : "files"}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-400">
              <ShieldCheck aria-hidden="true" size={12} /> Trusted root
            </span>
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <ul aria-label="Allowlisted source files" role="tree">
          <FileTreeLevel
            childrenByParent={childrenByParent}
            depth={0}
            expanded={expanded}
            parentId={undefined}
            selectedFileId={props.selectedFileId}
            visited={new Set()}
            onSelect={props.onSelect}
            onToggle={toggleDirectory}
          />
        </ul>
        {!props.files.length && (
          <p className="px-4 py-6 text-xs leading-5 text-zinc-600">
            This target has not declared any source files for browsing.
          </p>
        )}
      </div>

      <p className="border-t border-white/10 p-3 text-[9px] leading-4 text-zinc-600">
        Repository files are read-only unless the source is registered for editing.
      </p>
    </aside>
  );
}

function indexChildren(files: readonly SourceWorkspaceFileEntry[]): ReadonlyMap<string | undefined, readonly SourceWorkspaceFileEntry[]> {
  const ids = new Set(files.map((entry) => entry.id));
  const result = new Map<string | undefined, SourceWorkspaceFileEntry[]>();
  for (const entry of files) {
    const parentId = entry.parentId && ids.has(entry.parentId) ? entry.parentId : undefined;
    result.set(parentId, [...(result.get(parentId) ?? []), entry]);
  }
  return result;
}

function ancestorDirectoryIds(files: readonly SourceWorkspaceFileEntry[], entryId: string): string[] {
  const byId = new Map(files.map((entry) => [entry.id, entry]));
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(entryId);
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    if (parent.kind === "directory") ancestors.push(parent.id);
    current = parent;
  }
  return ancestors;
}
