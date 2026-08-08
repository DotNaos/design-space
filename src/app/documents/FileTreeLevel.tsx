
import { Button } from "@heroui/react";
import { Braces, ChevronRight, FileCode2, FileImage, FileJson2, FileText, Folder, FolderOpen, LockKeyhole, Palette } from "lucide-react";
import { NpmBrandIcon } from "../source/NpmBrandIcon";
import type { SourceWorkspaceFileEntry } from "../../shared/source-workspace";

export function FileTreeLevel(props: {
  childrenByParent: ReadonlyMap<string | undefined, readonly SourceWorkspaceFileEntry[]>;
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
          className={`min-h-11 w-full justify-start rounded-none px-2 text-xs lg:min-h-9 ${isSelected ? "bg-sky-500/10 text-sky-200" : "text-zinc-400"}`}
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
              <FileIcon label={entry.label} />
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

function FileIcon(props: { label: string }) {
  const label = props.label.toLocaleLowerCase();
  if (label === "package.json") return <NpmBrandIcon />;
  if (label.endsWith(".lock") || label === "bun.lockb") return <LockKeyhole aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />;
  if (label.endsWith(".json") || label.endsWith(".jsonc")) return <Braces aria-hidden="true" className="shrink-0 text-amber-300/70" size={13} />;
  if (label.endsWith(".ts") || label.endsWith(".tsx") || label.endsWith(".js") || label.endsWith(".jsx")) return <FileCode2 aria-hidden="true" className="shrink-0 text-sky-300/70" size={13} />;
  if (label.endsWith(".css") || label.endsWith(".scss") || label.endsWith(".sass")) return <Palette aria-hidden="true" className="shrink-0 text-fuchsia-300/70" size={13} />;
  if (label.endsWith(".svg") || /\.(?:png|jpe?g|gif|webp|ico)$/.test(label)) return <FileImage aria-hidden="true" className="shrink-0 text-emerald-300/70" size={13} />;
  if (/\.(?:md|mdx|txt|log)$/.test(label)) return <FileText aria-hidden="true" className="shrink-0 text-zinc-400" size={13} />;
  if (label.endsWith(".html")) return <FileJson2 aria-hidden="true" className="shrink-0 text-orange-300/70" size={13} />;
  return <FileText aria-hidden="true" className="shrink-0 text-zinc-500" size={13} />;
}
