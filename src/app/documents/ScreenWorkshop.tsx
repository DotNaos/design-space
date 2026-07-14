import { Button, Input, Label, TextField } from "@heroui/react";
import { LayoutTemplate, Smartphone } from "lucide-react";

import type { DesignDocument } from "../../shared/design-document";
import { updateDocumentLabel } from "../document/document-commands";

export function ScreenWorkshop(props: {
  className?: string;
  document: DesignDocument;
  onChange: (document: DesignDocument) => void;
  onEditRoot: () => void;
}) {
  return (
    <aside className={`${props.className ?? "flex w-80"} h-full min-h-0 min-w-0 shrink-0 flex-col overflow-y-auto overscroll-contain border-l border-white/10 bg-[#141518]`}>
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#141518]/95 px-4 py-3 backdrop-blur">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-indigo-400">Screen settings</p>
        <h2 className="mt-1 truncate text-sm font-semibold text-zinc-100">{props.document.label}</h2>
        <p className="mt-1 text-[10px] text-zinc-600">Source-backed app document</p>
      </header>

      <section className="border-b border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-zinc-300"><Smartphone size={14} /><h3 className="text-xs font-semibold">Identity</h3></div>
        <TextField
          fullWidth
          isInvalid={!props.document.label.trim()}
          value={props.document.label}
          onChange={(label) => props.onChange(updateDocumentLabel(props.document, label))}
        >
          <Label className="text-[10px] text-zinc-500">Screen name</Label>
          <Input aria-label="Screen name" className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-zinc-200 lg:text-sm" maxLength={120} />
        </TextField>
        {!props.document.label.trim() && <p className="mt-2 text-[10px] text-rose-300">A screen name is required before review.</p>}
        <p className="mt-2 text-[10px] leading-4 text-zinc-600">The name is part of the reviewed document diff and follows the same undo, reset, and stale-source checks.</p>
      </section>

      <section className="border-b border-white/10 px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold text-zinc-300">Root layout</h3>
        <Button className="w-full" variant="secondary" onPress={props.onEditRoot}><LayoutTemplate size={14} /> Edit root component</Button>
        <p className="mt-2 text-[10px] leading-4 text-zinc-600">Edit layout, Tailwind classes, content, and child slots in the item editor.</p>
      </section>
    </aside>
  );
}
