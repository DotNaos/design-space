import { Modal } from "@heroui/react";
import { Component, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CatalogEntry } from "./CatalogPanel";

export function SlotCatalogDialog(props: {
  open: boolean;
  slotLabel: string;
  entries: readonly CatalogEntry[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (props.open) setQuery("");
  }, [props.open]);
  const entries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return props.entries;
    return props.entries.filter((entry) => `${entry.label} ${entry.group} ${entry.description ?? ""}`.toLowerCase().includes(normalized));
  }, [props.entries, query]);

  return (
    <Modal.Backdrop isOpen={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }} variant="blur">
      <Modal.Container className="items-end p-0 lg:p-4" placement="bottom" size="lg">
        <Modal.Dialog aria-label={`Add to ${props.slotLabel} slot`} className="max-h-[86dvh] w-full overflow-hidden rounded-b-none border border-white/10 bg-[#17181b] text-zinc-200 lg:max-h-[72dvh] lg:rounded-xl">
          <Modal.Header className="border-b border-white/10 px-4 py-3">
            <div className="flex w-full items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Compatible components</p>
                <Modal.Heading className="mt-1 truncate text-base font-semibold">Add to {props.slotLabel}</Modal.Heading>
              </div>
              <button aria-label="Close component picker" className="grid size-11 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white" type="button" onClick={props.onClose}>
                <X size={18} />
              </button>
            </div>
          </Modal.Header>
          <Modal.Body className="min-h-0 p-0">
            <label className="mx-4 mt-3 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-zinc-500">
              <Search size={15} />
              <input aria-label="Search compatible components" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none" placeholder="Search compatible components" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="relative min-h-0">
              <div className="max-h-[64dvh] overflow-y-auto overscroll-contain px-2 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3 lg:max-h-[50dvh]">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                    type="button"
                    onClick={() => props.onSelect(entry.id)}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300"><Component size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{entry.label}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{entry.group} · {entry.slotCount ? `${entry.slotCount} declared slots` : "No children"}</span>
                    </span>
                  </button>
                ))}
                {entries.length === 0 && <p className="px-3 py-8 text-center text-xs text-zinc-500">No compatible components match this search.</p>}
              </div>
              {entries.length > 6 && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#17181b] to-transparent" />}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
