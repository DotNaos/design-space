import { Button, CloseButton, SearchField } from "@heroui/react";
import { Component } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CatalogEntry } from "../CatalogPanel/CatalogPanel";

export function SlotCatalogPanel(props: {
  className?: string;
  slotLabel: string;
  targetKind?: "slot" | "root";
  entries: readonly CatalogEntry[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [props.slotLabel]);
  const entries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return props.entries;
    return props.entries.filter((entry) => `${entry.label} ${entry.group} ${entry.description ?? ""}`.toLowerCase().includes(normalized));
  }, [props.entries, query]);

  const root = props.targetKind === "root";
  return (
    <section aria-label={root ? "Choose root component" : `Add to ${props.slotLabel} slot`} className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col bg-[#141518] text-zinc-200`}>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{root ? "Root components" : "Compatible components"}</p>
          <h2 className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{root ? "Start this document" : `Insert into ${props.slotLabel}`}</h2>
        </div>
        <CloseButton aria-label="Close component picker" className="size-10 shrink-0 text-zinc-500 hover:bg-white/5 hover:text-white" onPress={props.onClose} />
      </header>
      <SearchField aria-label="Search compatible components" className="mx-3 mt-3 shrink-0" fullWidth value={query} onChange={setQuery}>
        <SearchField.Group className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-zinc-500">
          <SearchField.SearchIcon className="size-3.5 shrink-0" />
          <SearchField.Input autoComplete="off" className="min-w-0 flex-1 bg-transparent text-base text-zinc-200 outline-none placeholder:text-zinc-700 lg:text-xs" placeholder="Search components" role="textbox" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        {entries.map((entry) => (
          <Button
            key={entry.id}
            aria-label={`${entry.label}, ${entry.slotCount ? `${entry.slotCount} declared slots` : "no children"}`}
            className="min-h-14 w-full justify-start gap-3 rounded-lg px-2 text-left hover:bg-white/5 focus-visible:bg-white/5"
            fullWidth
            variant="ghost"
            onPress={() => props.onSelect(entry.id)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300"><Component size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-100">{entry.label}</span>
              <span className="block truncate text-[10px] text-zinc-600">{entry.group} · {entry.slotCount ? `${entry.slotCount} declared slots` : "No children"}</span>
            </span>
          </Button>
        ))}
        {entries.length === 0 && <p className="px-3 py-10 text-center text-xs text-zinc-500">No {root ? "root" : "compatible"} components match this search.</p>}
      </div>
    </section>
  );
}
