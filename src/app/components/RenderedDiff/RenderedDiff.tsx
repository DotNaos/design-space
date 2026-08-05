import { Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import { DiffBody } from "./DiffBody";

export type DiffLineKind = "add" | "context" | "file" | "hunk" | "meta" | "remove";

export type RenderedDiffLine = {
  kind: DiffLineKind;
  newLine?: number;
  oldLine?: number;
  text: string;
};

export type RenderedDiffFile = {
  id: string;
  label: string;
  lines: readonly RenderedDiffLine[];
};

export function RenderedDiff(props: { diff: string; className?: string }) {
  const files = useMemo(() => parseUnifiedDiff(props.diff), [props.diff]);
  const [selectedId, setSelectedId] = useState(files[0]?.id);
  const selected = files.find((file) => file.id === selectedId) ?? files[0];

  if (!selected) {
    return <p className="p-4 text-xs text-zinc-500">No source changes.</p>;
  }

  return (
    <section className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col bg-[#101113]`}>
      {files.length > 1 ? (
        <Tabs
          aria-label="Changed files"
          className="min-h-0 flex-1 !gap-0"
          selectedKey={selected.id}
          variant="secondary"
          onSelectionChange={(key) => setSelectedId(String(key))}
        >
          <Tabs.List aria-label="Changed files" className="flex shrink-0 overflow-x-auto border-b border-white/10">
          {files.map((file) => (
            <Tabs.Tab
              key={file.id}
              id={file.id}
              className="min-h-10 shrink-0 border-b-2 border-transparent px-3 font-mono text-[10px] text-zinc-500 data-[selected]:border-sky-400 data-[selected]:text-zinc-100"
            >
              {file.label}
            </Tabs.Tab>
          ))}
          </Tabs.List>
          {files.map((file) => (
            <Tabs.Panel key={file.id} id={file.id} className="!m-0 min-h-0 flex-1 !p-0">
              <DiffBody file={file} />
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : <DiffBody file={selected} />}
    </section>
  );
}

export function parseUnifiedDiff(diff: string): readonly RenderedDiffFile[] {
  if (!diff) return [];
  const chunks = splitFiles(diff);
  return chunks.map((chunk, index) => ({
    id: `${index}:${chunk.label}`,
    label: chunk.label,
    lines: numberLines(chunk.text),
  }));
}

function splitFiles(diff: string): Array<{ label: string; text: string }> {
  const lines = diff.replaceAll("\r\n", "\n").split("\n");
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.startsWith("diff --git ") && current.length) {
      chunks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) chunks.push(current);
  return chunks.map((chunk, index) => ({
    label: fileLabel(chunk) ?? (chunks.length === 1 ? "Changes" : `Change ${index + 1}`),
    text: chunk.join("\n"),
  }));
}

function fileLabel(lines: readonly string[]): string | undefined {
  const next = lines.find((line) => line.startsWith("+++ "))?.slice(4).trim();
  if (next && next !== "/dev/null") return next.replace(/^b\//, "");
  const previous = lines.find((line) => line.startsWith("--- "))?.slice(4).trim();
  return previous && previous !== "/dev/null" ? previous.replace(/^a\//, "") : undefined;
}

function numberLines(diff: string): RenderedDiffLine[] {
  let oldLine: number | undefined;
  let newLine: number | undefined;
  return diff.split("\n").map((text) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      return { kind: "hunk", text };
    }
    if (text.startsWith("diff --git ") || text.startsWith("index ") || text.startsWith("--- ") || text.startsWith("+++ ")) {
      return { kind: text.startsWith("--- ") || text.startsWith("+++ ") ? "file" : "meta", text };
    }
    if (text.startsWith("+") && !text.startsWith("+++")) {
      const line = { kind: "add" as const, newLine, text };
      if (newLine !== undefined) newLine += 1;
      return line;
    }
    if (text.startsWith("-") && !text.startsWith("---")) {
      const line = { kind: "remove" as const, oldLine, text };
      if (oldLine !== undefined) oldLine += 1;
      return line;
    }
    const line = { kind: "context" as const, oldLine, newLine, text };
    if (oldLine !== undefined) oldLine += 1;
    if (newLine !== undefined) newLine += 1;
    return line;
  });
}
