import { Button, Drawer } from "@heroui/react";
import { Maximize2, Minimize2 } from "lucide-react";
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
    <Drawer.Backdrop isOpen={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }} variant="transparent">
      <Drawer.Content placement="bottom">
        <Drawer.Dialog
          aria-label={props.targetKind === "root" ? "Choose root component" : `Add to ${props.slotLabel} slot`}
          className={`max-h-none w-full overflow-hidden rounded-b-none rounded-t-2xl border border-white/10 bg-[#141518] p-0 text-zinc-200 shadow-2xl transition-[height] duration-300 ${expanded ? "h-[82dvh]" : "h-[52dvh]"}`}
          render={(dialogProps) => <section {...dialogProps} aria-modal="true" />}
        >
          <div className="relative shrink-0">
            <Drawer.Handle className="h-11 pb-0" />
            <Button
              isIconOnly
              aria-label={expanded ? "Collapse component picker" : "Expand component picker"}
              className="absolute right-1 top-0 size-11"
              size="sm"
              variant="ghost"
              onPress={() => setExpanded((value) => !value)}
            >
              {expanded ? <Minimize2 aria-hidden="true" size={14} /> : <Maximize2 aria-hidden="true" size={14} />}
            </Button>
          </div>
          <Drawer.Body className="m-0 min-h-0 p-0">
            <SlotCatalogPanel className="flex h-full" slotLabel={props.slotLabel} targetKind={props.targetKind} entries={props.entries} onClose={props.onClose} onSelect={props.onSelect} />
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
