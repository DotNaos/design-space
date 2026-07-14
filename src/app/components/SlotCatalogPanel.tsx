import { Component, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CatalogEntry } from "./CatalogPanel";

export function SlotCatalogPanel(props: {
  className?: string;
  slotLabel: string;
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

  return (
    <section aria-label={`Add to ${props.slotLabel} slot`} className={`${props.className ?? "flex"} min-h-0 min-w-0 flex-col bg-[#141518] text-zinc-200`}>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">Compatible components</p>
          <h2 className="mt-0.5 truncate text-sm font-semibold text-zinc-100">Insert into {props.slotLabel}</h2>
        </div>
        <button aria-label="Close component picker" className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white" type="button" onClick={props.onClose}>
          <X size={16} />
        </button>
      </header>
      <label className="mx-3 mt-3 flex h-11 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-zinc-500">
        <Search size={14} />
        <input
          aria-label="Search compatible components"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-base text-zinc-200 outline-none placeholder:text-zinc-700 lg:text-xs"
          placeholder="Search components"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        {entries.map((entry) => (
          <button
            key={entry.id}
            aria-label={`${entry.label}, ${entry.slotCount ? `${entry.slotCount} declared slots` : "no children"}`}
            className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
            type="button"
            onClick={() => props.onSelect(entry.id)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300"><Component size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-100">{entry.label}</span>
              <span className="block truncate text-[10px] text-zinc-600">{entry.group} · {entry.slotCount ? `${entry.slotCount} declared slots` : "No children"}</span>
            </span>
          </button>
        ))}
        {entries.length === 0 && <p className="px-3 py-10 text-center text-xs text-zinc-500">No compatible components match this search.</p>}
      </div>
    </section>
  );
}
