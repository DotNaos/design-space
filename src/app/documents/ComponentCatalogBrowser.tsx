import { useMemo, useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Boxes, ChevronRight, Component, Search } from "lucide-react";

import type { DocumentAdapterView } from "../document/document-adapters";

export interface ComponentCatalogBrowserProps {
  className?: string;
  entries: readonly DocumentAdapterView[];
  selectedComponentId?: string;
  onSelect: (componentId: string) => void;
}

export function ComponentCatalogBrowser(props: ComponentCatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = useMemo(
    () => groupCatalogEntries(props.entries, normalizedQuery),
    [normalizedQuery, props.entries],
  );
  const visibleCount = [...groups.values()].reduce((count, entries) => count + entries.length, 0);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <aside
      aria-label="Component catalog browser"
      className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      <header className="border-b border-white/10 px-3 py-2.5">
        <div className="flex min-h-6 items-center gap-2">
          <Boxes aria-hidden="true" className="text-sky-400" size={14} />
          <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">Component catalog</h2>
          <span className="text-[9px] tabular-nums text-zinc-600">
            {normalizedQuery ? `${visibleCount} of ${props.entries.length}` : `${props.entries.length} total`}
          </span>
        </div>
        <TextField className="mt-2" value={query} onChange={setQuery}>
          <Label className="sr-only">Search component catalog</Label>
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 lg:min-h-9">
            <Search aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
            <Input className="min-w-0 flex-1 bg-transparent text-base text-zinc-300 outline-none lg:text-xs" placeholder="Search components" />
          </div>
        </TextField>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {[...groups].map(([group, entries]) => {
          const collapsed = !normalizedQuery && collapsedGroups.has(group);
          return (
            <section key={group} aria-label={`${group} components`}>
              <Button
                aria-expanded={!collapsed}
                className="min-h-11 w-full justify-start rounded-none px-3 text-[10px] font-medium text-zinc-600 lg:min-h-9"
                fullWidth
                size="sm"
                variant="ghost"
                onPress={() => toggleGroup(group)}
              >
                <ChevronRight aria-hidden="true" className={`transition-transform ${collapsed ? "" : "rotate-90"}`} size={12} />
                <span className="min-w-0 flex-1 truncate text-left">{group}</span>
                <span className="tabular-nums">{entries.length}</span>
              </Button>
              {!collapsed && (
                <div role="list">
                  {entries.map((entry) => (
                    <CatalogEntryButton
                      key={entry.component.id}
                      entry={entry}
                      selected={props.selectedComponentId === entry.component.id}
                      onSelect={props.onSelect}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {!visibleCount && (
          <p className="px-4 py-8 text-center text-xs leading-5 text-zinc-600">
            {normalizedQuery ? `No components match “${query.trim()}”.` : "No components are registered yet."}
          </p>
        )}
      </div>
    </aside>
  );
}

function CatalogEntryButton(props: {
  entry: DocumentAdapterView;
  selected: boolean;
  onSelect: (componentId: string) => void;
}) {
  const origin = props.entry.targetAdapter ? "Target" : "Authored";
  const status = props.entry.targetAdapter ? "Read only" : "Editable";
  const slotCount = props.entry.component.slots.length;
  return (
    <Button
      aria-pressed={props.selected}
      className={`min-h-16 w-full justify-start rounded-none px-4 py-2 text-left ${props.selected ? "bg-sky-500/10" : ""}`}
      fullWidth
      size="sm"
      variant="ghost"
      onPress={() => props.onSelect(props.entry.component.id)}
    >
      <Component aria-hidden="true" className={props.entry.targetAdapter ? "text-sky-400" : "text-cyan-300"} size={14} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-zinc-300">{props.entry.component.label}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] leading-4 text-zinc-600">
          <span>{origin}</span>
          <span aria-hidden="true">·</span>
          <span>{status}</span>
          <span aria-hidden="true">·</span>
          <span>{slotCount ? `${slotCount} ${slotCount === 1 ? "slot" : "slots"}` : "No slots"}</span>
        </span>
      </span>
    </Button>
  );
}

function groupCatalogEntries(
  entries: readonly DocumentAdapterView[],
  normalizedQuery: string,
): ReadonlyMap<string, readonly DocumentAdapterView[]> {
  const groups = new Map<string, DocumentAdapterView[]>();
  for (const entry of entries) {
    const origin = entry.targetAdapter ? "target read only" : "authored editable";
    const searchable = `${entry.component.label} ${entry.component.id} ${entry.component.group} ${entry.component.description ?? ""} ${origin}`.toLocaleLowerCase();
    if (normalizedQuery && !searchable.includes(normalizedQuery)) continue;
    const group = entry.component.group;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }
  return groups;
}
