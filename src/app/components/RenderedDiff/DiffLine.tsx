
import { RenderedDiffLine } from "./RenderedDiff";

export function DiffLine({ line }: { line: RenderedDiffLine }) {
  const tone = line.kind === "add"
    ? "bg-emerald-500/10 text-emerald-200"
    : line.kind === "remove"
      ? "bg-rose-500/10 text-rose-200"
      : line.kind === "hunk"
        ? "bg-sky-500/10 text-sky-200"
        : line.kind === "file"
          ? "text-zinc-300"
          : "text-zinc-500";
  return (
    <div className={`grid min-h-5 grid-cols-[3.25rem_3.25rem_minmax(0,1fr)] ${tone}`} role="row">
      <span aria-label={line.oldLine ? `Old line ${line.oldLine}` : undefined} className="select-none border-r border-white/5 px-2 text-right text-zinc-700" role="cell">{line.oldLine ?? ""}</span>
      <span aria-label={line.newLine ? `New line ${line.newLine}` : undefined} className="select-none border-r border-white/5 px-2 text-right text-zinc-700" role="cell">{line.newLine ?? ""}</span>
      <code className="whitespace-pre px-3" role="cell">{line.text || " "}</code>
    </div>
  );
}
