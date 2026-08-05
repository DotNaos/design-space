import { FileCode2 } from "lucide-react";
import type { SourceWorkspaceEntry } from "../../shared/source-workspace";

export function ComponentInspectorHeader({ entry, selectedRegion = false }: { entry: SourceWorkspaceEntry; selectedRegion?: boolean }) {
  return (
    <header
      aria-label={selectedRegion ? "Selected component" : undefined}
      className="shrink-0 border-b border-white/10 px-4 py-2.5"
      role={selectedRegion ? "region" : undefined}
    >
      <div className="flex items-center gap-2">
        <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={15} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{entry.label}</h2>
      </div>
      <p className="mt-1 truncate pl-[23px] font-mono text-[9px] text-zinc-600" title={`${entry.relativePath} · ${entry.exportName}`}>{entry.relativePath}</p>
    </header>
  );
}
