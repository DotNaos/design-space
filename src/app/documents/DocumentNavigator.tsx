import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Boxes, ChevronRight, Library, Plus, Search, Smartphone } from "lucide-react";

import type { TargetDocumentEntry } from "../../shared/target-module";

export type ProductMode = "app" | "library";

export function DocumentNavigator(props: {
  className?: string;
  mode: ProductMode;
  entries: readonly TargetDocumentEntry[];
  activeDocumentId?: string;
  canCreate: boolean;
  onModeChange: (mode: ProductMode) => void;
  onSelect: (documentId: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const expectedKind = props.mode === "app" ? "screen" : "component";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = props.entries.filter((entry) => entry.kind === expectedKind && (
    !normalizedQuery || `${entry.label} ${entry.group ?? ""}`.toLocaleLowerCase().includes(normalizedQuery)
  ));
  return (
    <aside className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}>
      <div className="grid grid-cols-2 border-b border-white/10 p-1.5">
        <ModeButton active={props.mode === "app"} icon={<Smartphone size={13} />} label="App" onPress={() => props.onModeChange("app")} />
        <ModeButton active={props.mode === "library"} icon={<Library size={13} />} label="Library" onPress={() => props.onModeChange("library")} />
      </div>
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-3">
        <TextField aria-label="Search documents" className="min-w-0 flex-1" value={query} onChange={setQuery}>
          <Label className="sr-only">Search documents</Label>
          <div className="flex items-center gap-2">
            <Search size={13} className="text-zinc-600" />
            <Input className="min-w-0 flex-1 bg-transparent text-xs text-zinc-300 outline-none" placeholder="Search" />
          </div>
        </TextField>
        <Button aria-label={`Create ${expectedKind}`} isIconOnly size="sm" variant="ghost" isDisabled={!props.canCreate} onPress={props.onCreate}><Plus size={14} /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <p className="px-3 pb-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-600">{props.mode === "app" ? "Screens" : "Components"}</p>
        {entries.map((entry) => {
          const active = entry.id === props.activeDocumentId;
          return (
            <Button
              key={entry.id}
              aria-current={active ? "page" : undefined}
              fullWidth
              className={`flex min-h-11 w-full items-center gap-2 border-l-2 px-3 text-left text-xs lg:min-h-9 ${active ? "border-sky-400 bg-sky-500/10 text-zinc-100" : "border-transparent text-zinc-400 hover:bg-white/[0.03]"}`}
              variant="ghost"
              onPress={() => props.onSelect(entry.id)}
            >
              {entry.kind === "screen" ? <Smartphone size={13} /> : <Boxes size={13} />}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              <ChevronRight size={12} className="text-zinc-700" />
            </Button>
          );
        })}
        {!entries.length && <p className="px-3 py-5 text-xs leading-5 text-zinc-600">{normalizedQuery ? `No ${expectedKind}s match “${query.trim()}”.` : `No ${expectedKind}s are registered yet.`}</p>}
      </div>
    </aside>
  );
}

function ModeButton(props: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return <Button className="min-h-9" size="sm" variant={props.active ? "secondary" : "ghost"} onPress={props.onPress}>{props.icon}{props.label}</Button>;
}
