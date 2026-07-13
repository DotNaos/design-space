import { ChevronDown, Component, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type CatalogEntry = { id: string; label: string; group: string; description?: string; slotCount: number };

export function CatalogPanel(props: { entries: readonly CatalogEntry[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(() => {
    const result = new Map<string, CatalogEntry[]>();
    const normalizedQuery = query.trim().toLowerCase();
    for (const entry of props.entries) {
      if (normalizedQuery && !`${entry.label} ${entry.group} ${entry.description ?? ""}`.toLowerCase().includes(normalizedQuery)) continue;
      result.set(entry.group, [...(result.get(entry.group) ?? []), entry]);
    }
    return result;
  }, [props.entries, query]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#141518]">
      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-zinc-300">Component catalog</h2>
          <span className="text-[10px] text-zinc-600">{props.entries.length} total</span>
        </div>
        <label className="mt-2 flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 text-zinc-600">
          <Search size={13} />
          <input aria-label="Search components" className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-300 outline-none" placeholder="Search all adapters" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {[...groups].map(([group, entries]) => (
          <section key={group}>
            <button
              className="flex h-8 w-full items-center gap-2 px-3 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600 hover:text-zinc-300"
              type="button"
              onClick={() => setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(group)) next.delete(group); else next.add(group);
                return next;
              })}
            >
              <ChevronDown size={12} className={collapsed.has(group) ? "-rotate-90" : ""} /> {group} <span className="ml-auto">{entries.length}</span>
            </button>
            {!collapsed.has(group) && entries.map((entry) => (
              <button key={entry.id} className={`flex min-h-10 w-full items-center gap-2 px-5 text-left hover:bg-white/[0.03] ${props.selectedId === entry.id ? "bg-indigo-500/10" : ""}`} type="button" onClick={() => props.onSelect(entry.id)}>
                <Component size={13} className="text-indigo-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-zinc-300">{entry.label}</span>
                  <span className="block truncate text-[9px] text-zinc-600">{entry.slotCount ? `${entry.slotCount} declared slots` : "No children"}</span>
                </span>
              </button>
            ))}
          </section>
        ))}
        {groups.size === 0 && <p className="px-4 py-6 text-center text-[10px] text-zinc-600">No adapters match “{query}”.</p>}
      </div>
    </aside>
  );
}
