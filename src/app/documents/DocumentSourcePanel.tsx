import { Braces, FileJson2 } from "lucide-react";
import type { ReactNode } from "react";

export function DocumentSourcePanel(props: {
  className?: string;
  label: string;
  source: string;
}) {
  const lines = props.source.split("\n");
  return (
    <aside aria-label="Document source code" className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col bg-[#111214]`}>
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <FileJson2 aria-hidden="true" className="shrink-0 text-sky-300" size={14} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-medium text-zinc-200">{props.label}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-600">
            <Braces aria-hidden="true" size={10} /> Live document tree
          </p>
        </div>
      </header>

      <div aria-label="Current document source" className="min-h-0 flex-1 overflow-auto" role="region" tabIndex={0}>
        <pre className="min-h-full min-w-max py-3 font-mono text-[11px] leading-5 text-zinc-400">
          <code>
            {lines.map((line, index) => (
              <span key={`${index}-${line}`} className="flex min-h-5">
                <span aria-hidden="true" className="sticky left-0 w-11 shrink-0 select-none bg-[#111214] pr-3 text-right text-zinc-700">
                  {index + 1}
                </span>
                <span className="pr-4">{highlightJsonLine(line)}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </aside>
  );
}

function highlightJsonLine(line: string) {
  const matches = [...line.matchAll(/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?/g)];
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [index, match] of matches.entries()) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(line.slice(cursor, start));
    const token = match[0];
    const isKey = token.startsWith('"') && /^\s*:/.test(line.slice(start + token.length));
    const className = isKey
      ? "text-sky-300"
      : token.startsWith('"')
        ? "text-emerald-300/90"
        : /^(true|false|null)$/.test(token)
          ? "text-amber-300"
          : "text-violet-300";
    parts.push(<span key={`${index}-${start}`} className={className}>{token}</span>);
    cursor = start + token.length;
  }
  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}
