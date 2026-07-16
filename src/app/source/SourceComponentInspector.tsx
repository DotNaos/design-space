import { useEffect, useState } from "react";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { Braces, Code2, Component, FileCode2, LoaderCircle } from "lucide-react";

import type { SourceComponentProp, SourceWorkspaceEntry } from "../../shared/source-workspace";
import type { SourceFileEditor } from "./useSourceFileEditor";

export interface SourceComponentInspectorProps {
  className?: string;
  entry?: SourceWorkspaceEntry;
  editor?: SourceFileEditor;
}

export function SourceComponentInspector(props: SourceComponentInspectorProps) {
  const hasEditor = Boolean(props.editor);
  const [tab, setTab] = useState<"contract" | "code">(hasEditor ? "code" : "contract");
  useEffect(() => setTab(hasEditor ? "code" : "contract"), [hasEditor, props.entry?.id]);
  if (!props.entry) {
    return (
      <aside
        aria-label="TypeScript component contract"
        className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 items-center justify-center border-l border-white/10 bg-[#141518] px-6 text-center`}
      >
        <p className="text-xs leading-5 text-zinc-600">Select an exported component to inspect its TypeScript contract.</p>
      </aside>
    );
  }

  const regularProps = props.entry.props.filter((property) => !property.slot);
  const slots = props.entry.props.filter((property) => property.slot);

  return (
    <aside
      aria-label="TypeScript component contract"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-l border-white/10 bg-[#141518]`}
    >
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={15} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{props.entry.label}</h2>
        </div>
        <p className="mt-1 truncate text-[10px] text-zinc-600" title={props.entry.relativePath}>{props.entry.relativePath}</p>
        <p className="mt-0.5 text-[9px] text-zinc-700">Export: {props.entry.exportName}</p>
      </header>

      <nav aria-label="Inspector views" className="grid h-10 shrink-0 grid-cols-2 border-b border-white/10 p-1">
        <Button className={`rounded-md text-[10px] ${tab === "contract" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={() => setTab("contract")}><Braces size={12} /> Contract</Button>
        <Button className={`rounded-md text-[10px] ${tab === "code" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={() => setTab("code")}><Code2 size={12} /> Code</Button>
      </nav>

      {tab === "contract" ? <div className="min-h-0 flex-1 overflow-y-auto">
        <ContractSection
          emptyMessage="No non-slot props are declared."
          icon={<Braces aria-hidden="true" size={14} />}
          properties={regularProps}
          title="Props"
        />
        <ContractSection
          emptyMessage="No slot props are declared."
          icon={<Component aria-hidden="true" size={14} />}
          properties={slots}
          title="Slots"
        />
      </div> : <SourceCodeEditor editor={props.editor} />}
    </aside>
  );
}

function SourceCodeEditor(props: { editor?: SourceFileEditor }) {
  const editor = props.editor;
  if (!editor || editor.loading) {
    return <div className="grid min-h-0 flex-1 place-items-center text-xs text-zinc-600">{editor?.loading ? <><LoaderCircle className="animate-spin" size={14} /> Opening source…</> : "Source editor unavailable."}</div>;
  }
  if (!editor.snapshot) {
    return <div className="min-h-0 flex-1 p-4 text-xs leading-5 text-amber-300">{editor.error ?? "The selected source could not be opened."}</div>;
  }
  return (
    <section aria-label="TypeScript source editor" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-8 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 text-[9px]">
        <span className={editor.dirty ? "text-amber-300" : "text-emerald-400"}>{editor.dirty ? "Unsaved changes" : "Saved source"}</span>
        <span className="ml-auto text-zinc-700">Diff required before save</span>
      </div>
      <TextField className="flex min-h-0 flex-1" value={editor.draft} onChange={editor.setDraft}>
        <Label className="sr-only">Edit TypeScript source</Label>
        <TextArea
          aria-label="Edit TypeScript source"
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-[#101113] p-3 font-mono text-[11px] leading-5 text-zinc-300 outline-none selection:bg-sky-500/30"
          spellCheck={false}
        />
      </TextField>
      {editor.error && <p className="shrink-0 border-t border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[10px] leading-4 text-amber-300">{editor.error}</p>}
    </section>
  );
}

function ContractSection(props: {
  emptyMessage: string;
  icon: React.ReactNode;
  properties: readonly SourceComponentProp[];
  title: "Props" | "Slots";
}) {
  return (
    <section aria-labelledby={`source-contract-${props.title.toLowerCase()}`} className="border-b border-white/10">
      <header className="flex min-h-10 items-center gap-2 px-4 text-zinc-500">
        {props.icon}
        <h3 id={`source-contract-${props.title.toLowerCase()}`} className="text-[10px] font-medium uppercase tracking-[0.14em]">
          {props.title}
        </h3>
        <span className="ml-auto text-[9px] tabular-nums text-zinc-700">{props.properties.length}</span>
      </header>
      {props.properties.length ? (
        <dl>
          {props.properties.map((property) => <ContractProperty key={property.name} property={property} />)}
        </dl>
      ) : (
        <p className="px-4 pb-4 text-[10px] leading-4 text-zinc-600">{props.emptyMessage}</p>
      )}
    </section>
  );
}

function ContractProperty(props: { property: SourceComponentProp }) {
  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      <dt className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{props.property.name}</span>
        {props.property.multiple && (
          <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-zinc-500">Multiple</span>
        )}
        <span className={`text-[9px] font-medium ${props.property.required ? "text-amber-300" : "text-zinc-600"}`}>
          {props.property.required ? "Required" : "Optional"}
        </span>
      </dt>
      <dd className="mt-1.5">
        <code className="block whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-sky-300/80">
          {props.property.type}
        </code>
      </dd>
    </div>
  );
}
