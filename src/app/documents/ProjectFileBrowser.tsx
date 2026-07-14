import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { ChevronRight, FileCode2, Folder, FolderOpen, ShieldCheck } from "lucide-react";

import type { TargetFileEntry } from "../../shared/target-module";

export interface ProjectFileBrowserProps {
  className?: string;
  files: readonly TargetFileEntry[];
  selectedFileId?: string;
  onSelect: (fileId: string) => void;
}

export function ProjectFileBrowser(props: ProjectFileBrowserProps) {
  const directoryIds = useMemo(
    () => props.files.filter((entry) => entry.kind === "directory").map((entry) => entry.id),
    [props.files],
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(directoryIds));

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set([...current].filter((id) => directoryIds.includes(id)));
      for (const id of directoryIds) next.add(id);
      return next;
    });
  }, [directoryIds.join("\u0000")]);

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
      aria-label="Project file browser"
      className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      <header className="flex min-h-11 items-center gap-2 border-b border-white/10 px-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-medium text-zinc-300">Project files</h2>
          <p className="mt-0.5 text-[9px] text-zinc-600">{fileCount} allowlisted {fileCount === 1 ? "file" : "files"}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-400">
          <ShieldCheck aria-hidden="true" size={12} /> Trusted root
        </span>
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
        Source navigation is limited to files registered by the target server.
      </p>
    </aside>
  );
}

function FileTreeLevel(props: {
  childrenByParent: ReadonlyMap<string | undefined, readonly TargetFileEntry[]>;
  parentId: string | undefined;
  depth: number;
  expanded: ReadonlySet<string>;
  selectedFileId?: string;
  visited: ReadonlySet<string>;
  onToggle: (directoryId: string) => void;
  onSelect: (fileId: string) => void;
}) {
  const entries = props.childrenByParent.get(props.parentId) ?? [];
  return entries.map((entry) => {
    if (props.visited.has(entry.id)) return null;
    const branchVisited = new Set(props.visited).add(entry.id);
    const isDirectory = entry.kind === "directory";
    const isExpanded = isDirectory && props.expanded.has(entry.id);
    const isSelected = !isDirectory && entry.id === props.selectedFileId;

    return (
      <li
        key={entry.id}
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        role="treeitem"
      >
        <Button
          className={`min-h-11 w-full justify-start rounded-none px-2 text-xs lg:min-h-9 ${isSelected ? "bg-indigo-500/10 text-indigo-200" : "text-zinc-400"}`}
          fullWidth
          size="sm"
          variant="ghost"
          onPress={() => isDirectory ? props.onToggle(entry.id) : props.onSelect(entry.id)}
        >
          <span aria-hidden="true" className="shrink-0" style={{ width: 8 + props.depth * 14 }} />
          {isDirectory ? (
            <>
              <ChevronRight aria-hidden="true" className={`shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} size={13} />
              {isExpanded ? <FolderOpen aria-hidden="true" className="shrink-0 text-amber-300/80" size={14} /> : <Folder aria-hidden="true" className="shrink-0 text-amber-300/70" size={14} />}
            </>
          ) : (
            <>
              <span aria-hidden="true" className="w-[13px] shrink-0" />
              <FileCode2 aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />
            </>
          )}
          <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
        </Button>
        {isExpanded && (
          <ul role="group">
            <FileTreeLevel
              {...props}
              depth={props.depth + 1}
              parentId={entry.id}
              visited={branchVisited}
            />
          </ul>
        )}
      </li>
    );
  });
}

function indexChildren(files: readonly TargetFileEntry[]): ReadonlyMap<string | undefined, readonly TargetFileEntry[]> {
  const ids = new Set(files.map((entry) => entry.id));
  const result = new Map<string | undefined, TargetFileEntry[]>();
  for (const entry of files) {
    const parentId = entry.parentId && ids.has(entry.parentId) ? entry.parentId : undefined;
    result.set(parentId, [...(result.get(parentId) ?? []), entry]);
  }
  return result;
}

function ancestorDirectoryIds(files: readonly TargetFileEntry[], entryId: string): string[] {
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
