import { Button, Modal } from "@heroui/react";
import { CheckCircle2, LoaderCircle, Save, X } from "lucide-react";

import { RenderedDiff } from "../RenderedDiff/RenderedDiff";
import { useMobileViewport } from "../MobileNavigation/use-mobile-viewport";

type DiffSheetProps = {
  desktopHidden?: boolean;
  diff: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function DiffSheet({ desktopHidden, diff, saving, onClose, onSave }: DiffSheetProps) {
  const mobile = useMobileViewport();
  if (desktopHidden && !mobile) return null;

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="transparent">
      <Modal.Container className="items-end p-0 lg:p-6" placement="bottom" size="lg">
        <Modal.Dialog aria-label="Exact source diff" className="max-h-[70dvh] w-full rounded-b-none border border-white/10 bg-[#17181b] text-zinc-200 lg:rounded-xl">
          <Modal.Header className="border-b border-white/10 px-3 py-2">
            <div className="flex w-full items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <Modal.Heading className="text-xs font-medium">Exact source diff</Modal.Heading>
              <span className="text-[9px] text-zinc-600 sm:text-[10px]">Swipe to inspect · not saved</span>
              <Button isIconOnly aria-label="Close diff" className="ml-auto size-11 lg:size-8" size="sm" variant="ghost" onPress={onClose}><X size={14} /></Button>
            </div>
          </Modal.Header>
          <Modal.Body className="min-h-0 p-0">
            <RenderedDiff className="flex max-h-[48dvh]" diff={diff} />
          </Modal.Body>
          <footer className="grid grid-cols-2 gap-2 border-t border-white/10 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <Button className="min-h-11" variant="secondary" onPress={onClose}>Keep editing</Button>
            <Button className="min-h-11" isDisabled={saving} onPress={onSave}>
              {saving ? <><LoaderCircle className="animate-spin" size={15} /> Saving…</> : <><Save size={15} /> Save changes</>}
            </Button>
          </footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
