import { Button } from "@heroui/react";
import { CheckCircle2, X } from "lucide-react";

type DiffSheetProps = { diff: string; onClose: () => void };

export function DiffSheet({ diff, onClose }: DiffSheetProps) {
  return (
    <section aria-label="Exact source diff" className="absolute inset-x-6 bottom-6 z-30 max-h-[48%] overflow-hidden rounded-xl border border-white/10 bg-[#17181b] shadow-2xl">
      <header className="flex h-10 items-center border-b border-white/10 px-3">
        <CheckCircle2 size={14} className="mr-2 text-emerald-400" />
        <h2 className="text-xs font-medium text-zinc-200">Exact source diff</h2>
        <span className="ml-2 text-[10px] text-zinc-600">Prepared locally · not saved</span>
        <Button isIconOnly aria-label="Close diff" className="ml-auto" size="sm" variant="ghost" onPress={onClose}><X size={14} /></Button>
      </header>
      <pre className="max-h-72 overflow-auto p-4 font-mono text-[11px] leading-5 text-zinc-400">{diff}</pre>
    </section>
  );
}
