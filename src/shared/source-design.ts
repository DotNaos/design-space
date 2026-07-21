import type { SourceWorkspaceEntry } from "./source-workspace";

export type SourceDesignScope = "app" | "library-development";

export function suggestedSourceDesignPath(
  entry: Pick<SourceWorkspaceEntry, "exportName" | "label" | "relativePath">,
  entries: readonly Pick<SourceWorkspaceEntry, "relativePath">[],
): string {
  const extension = /\.[cm]?tsx?$/.exec(entry.relativePath)?.[0] ?? ".tsx";
  const stem = entry.relativePath.slice(0, -extension.length);
  const sharedSourceFile = entries.filter((candidate) => candidate.relativePath === entry.relativePath).length > 1;
  if (!sharedSourceFile) return `${stem}.design.tsx`;
  const exportName = (entry.exportName === "default" ? entry.label : entry.exportName)
    .replace(/[^A-Za-z0-9_$-]/g, "-");
  return `${stem}.${exportName}.design.tsx`;
}
