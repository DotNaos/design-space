import { Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import type { CatalogEntry } from "./CatalogPanel";
import { SlotCatalogPanel } from "./SlotCatalogPanel";
import { useMobileViewport } from "./use-mobile-viewport";

export function SlotCatalogDialog(props: {
  open: boolean;
  slotLabel: string;
  targetKind?: "slot" | "root";
  entries: readonly CatalogEntry[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mobile = useMobileViewport();
  useEffect(() => { if (props.open) setExpanded(false); }, [props.open, props.slotLabel]);

  if (!mobile) return null;

  return (
    <Modal.Backdrop isOpen={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }} variant="transparent">
      <Modal.Container className="items-end p-0" placement="bottom" size="lg">
        <Modal.Dialog aria-label={props.targetKind === "root" ? "Choose root component" : `Add to ${props.slotLabel} slot`} className={`mt-auto w-full overflow-hidden rounded-b-none rounded-t-2xl border border-white/10 bg-[#141518] text-zinc-200 shadow-2xl transition-[height] duration-300 ${expanded ? "h-[82dvh]" : "h-[52dvh]"}`}>
          <button aria-label={expanded ? "Collapse component picker" : "Expand component picker"} className="grid h-7 w-full place-items-center" type="button" onClick={() => setExpanded((value) => !value)}>
            <span className="h-1 w-10 rounded-full bg-zinc-700" />
          </button>
          <Modal.Body className="min-h-0 p-0">
            <SlotCatalogPanel className="flex h-full" slotLabel={props.slotLabel} targetKind={props.targetKind} entries={props.entries} onClose={props.onClose} onSelect={props.onSelect} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
