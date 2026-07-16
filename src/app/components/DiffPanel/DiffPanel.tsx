import { Button } from "@heroui/react";
import { FileDiff, LoaderCircle, Save, X } from "lucide-react";

import { RenderedDiff } from "../RenderedDiff/RenderedDiff";

export type DiffPanelProps = {
  diff: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function DiffPanel({ diff, saving, onClose, onSave }: DiffPanelProps) {
  return (
    <section aria-label="Exact source diff" className="flex h-full min-h-0 flex-col bg-[#101113] text-zinc-200">
      <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <FileDiff aria-hidden="true" className="shrink-0 text-sky-400" size={15} />
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold text-zinc-100">Source changes</h2>
          <p className="text-[10px] text-zinc-500">Ready to review · not saved</p>
        </div>
        <Button aria-label="Close diff" className="ml-auto size-8" isIconOnly size="sm" variant="ghost" onPress={onClose}>
          <X size={14} />
        </Button>
      </header>

      <RenderedDiff className="flex flex-1" diff={diff} />

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 p-3">
        <Button size="sm" variant="tertiary" onPress={onClose}>Keep editing</Button>
        <Button className="bg-sky-500 text-white hover:bg-sky-400" isDisabled={saving} size="sm" onPress={onSave}>
          {saving ? <><LoaderCircle className="animate-spin" size={14} /> Saving…</> : <><Save size={14} /> Save changes</>}
        </Button>
      </footer>
    </section>
  );
}
