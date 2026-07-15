import { Button, Modal } from "@heroui/react";
import { CheckCircle2, X } from "lucide-react";

type DiffSheetProps = { diff: string; onClose: () => void };

export function DiffSheet({ diff, onClose }: DiffSheetProps) {
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="blur">
      <Modal.Container className="items-end p-0 lg:p-6" placement="bottom" size="lg">
        <Modal.Dialog aria-label="Exact source diff" className="max-h-[70dvh] w-full rounded-b-none border border-white/10 bg-[#17181b] text-zinc-200 lg:rounded-xl">
          <Modal.Header className="border-b border-white/10 px-3 py-2">
            <div className="flex w-full items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <Modal.Heading className="text-xs font-medium">Exact source diff</Modal.Heading>
              <span className="hidden text-[10px] text-zinc-600 sm:inline">Prepared locally · not saved</span>
              <Button isIconOnly aria-label="Close diff" className="ml-auto size-11 lg:size-8" size="sm" variant="ghost" onPress={onClose}><X size={14} /></Button>
            </div>
          </Modal.Header>
          <Modal.Body className="p-0">
            <pre className="max-h-[56dvh] overflow-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] font-mono text-[11px] leading-5 text-zinc-400">{diff}</pre>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
