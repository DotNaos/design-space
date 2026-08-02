import { Button, Disclosure, SearchField } from "@heroui/react";
import { ChevronDown, Component } from "lucide-react";
import { useMemo, useState } from "react";

export type CatalogEntry = { id: string; label: string; group: string; description?: string; slotCount: number };

export function CatalogPanel(props: { className?: string; entries: readonly CatalogEntry[]; selectedId?: string; onSelect: (id: string) => void }) {
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
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-zinc-300">Component catalog</h2>
          <span className="text-[10px] text-zinc-600">{props.entries.length} total</span>
        </div>
        <SearchField aria-label="Search components" className="mt-2" fullWidth value={query} onChange={setQuery}>
          <SearchField.Group className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 text-zinc-600 lg:h-8">
            <SearchField.SearchIcon className="size-3.5 shrink-0" />
            <SearchField.Input className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-300 outline-none" placeholder="Search all adapters" role="textbox" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {[...groups].map(([group, entries]) => (
          <Disclosure
            key={group}
            isExpanded={!collapsed.has(group)}
            onExpandedChange={(expanded) => setCollapsed((current) => {
              const next = new Set(current);
              if (expanded) next.delete(group); else next.add(group);
              return next;
            })}
          >
            <Disclosure.Heading>
              <Disclosure.Trigger className="flex h-11 w-full items-center gap-2 px-3 text-left text-[10px] font-mediumr text-zinc-600 hover:text-zinc-300 lg:h-8">
                <ChevronDown size={12} className={`transition-transform ${collapsed.has(group) ? "-rotate-90" : ""}`} />
                {group}
                <span className="ml-auto">{entries.length}</span>
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body className="p-0">
                {entries.map((entry) => (
                  <Button
                    key={entry.id}
                    aria-pressed={props.selectedId === entry.id}
                    className={`min-h-11 w-full justify-start rounded-none px-5 text-left lg:min-h-10 ${props.selectedId === entry.id ? "bg-sky-500/10" : ""}`}
                    fullWidth
                    size="sm"
                    variant="ghost"
                    onPress={() => props.onSelect(entry.id)}
                  >
                    <Component size={13} className="text-sky-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-zinc-300">{entry.label}</span>
                      <span className="block truncate text-[9px] text-zinc-600">{entry.slotCount ? `${entry.slotCount} declared slots` : "No children"}</span>
                    </span>
                  </Button>
                ))}
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        ))}
        {groups.size === 0 && <p className="px-4 py-6 text-center text-[10px] text-zinc-600">No adapters match “{query}”.</p>}
      </div>
    </aside>
  );
}
