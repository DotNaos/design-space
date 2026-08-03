
import { LockKeyhole, PackageCheck } from "lucide-react";
import type { SourceWorkspaceEntry } from "../../shared/source-workspace";

export function ReleaseEvidence(props: { entry?: SourceWorkspaceEntry }) {
  return (
    <aside aria-label="Read-only library release" className="flex h-full w-full flex-col border-l border-white/10 bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500">
        <PackageCheck aria-hidden="true" size={14} />
        <span className="text-[10px] font-medium">Library evidence</span>
      </div>
      <h2 className="mt-5 truncate text-sm font-semibold text-zinc-200">{props.entry?.label ?? "Installed component"}</h2>
      {props.entry && <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{props.entry.relativePath}</p>}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400"><LockKeyhole aria-hidden="true" size={12} />Read-only release</p>
      <p className="mt-2 text-[10px] leading-5 text-zinc-600">Attach the development source to edit this component and its design file.</p>
    </aside>
  );
}
