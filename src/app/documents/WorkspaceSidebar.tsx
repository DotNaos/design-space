import { useEffect, useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Component,
  FolderKanban,
  Library,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Tablet,
  PanelsTopLeft,
} from "lucide-react";

import type { TargetDocumentEntry } from "../../shared/target-module";
import type { ProductMode } from "./DocumentNavigator";
import type { WorkspaceBrowserView } from "./WorkspaceBrowser";

export type WorkspaceSidebarView = WorkspaceBrowserView | "tree";

export function WorkspaceSidebar(props: {
  active: WorkspaceSidebarView;
  activeDocumentId?: string;
  auxiliary?: React.ReactNode;
  canCreate: boolean;
  entries: readonly TargetDocumentEntry[];
  layers: React.ReactNode;
  mode: ProductMode;
  projectLabel: string;
  onChange: (view: WorkspaceSidebarView) => void;
  onCreate: () => void;
  onDocumentSelect: (documentId: string) => void;
  onModeChange: (mode: ProductMode) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(true);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [componentsOpen, setComponentsOpen] = useState(props.mode === "library");
  useEffect(() => {
    if (props.mode === "library") setComponentsOpen(true);
  }, [props.mode]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (entry: TargetDocumentEntry) => !normalizedQuery || `${entry.label} ${entry.group ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
  const pages = props.entries.filter((entry) => entry.kind === "screen" && matches(entry));
  const components = props.entries.filter((entry) => entry.kind === "component" && matches(entry));
  const auxiliaryTitle = props.active === "catalog" ? "Library" : "Files";

  return (
    <aside aria-label="App structure and layers" className="flex h-full min-h-0 min-w-0 flex-col bg-[#141518]">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        {props.active !== "tree" && <Button aria-label="Back to App" className="lg:hidden" isIconOnly size="sm" variant="ghost" onPress={() => props.onChange("tree")}><ArrowLeft aria-hidden="true" size={15} /></Button>}
        <FolderKanban aria-hidden="true" className="shrink-0 text-sky-400" size={16} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-zinc-100">{props.active === "tree" ? "App" : auxiliaryTitle}</h1>
          <p className="mt-0.5 truncate text-[9px] text-zinc-600">{props.projectLabel}</p>
        </div>
        {props.active === "tree" && (
          <>
            <Button aria-label="Search app documents" aria-pressed={searchOpen} isIconOnly size="sm" variant="ghost" onPress={() => setSearchOpen((current) => !current)}><Search aria-hidden="true" size={14} /></Button>
            <Button aria-label={`Create ${props.mode === "app" ? "screen" : "component"}`} isDisabled={!props.canCreate} isIconOnly size="sm" variant="ghost" onPress={props.onCreate}><Plus aria-hidden="true" size={15} /></Button>
          </>
        )}
      </header>

      {props.active !== "tree" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">{props.auxiliary}</div>
        </div>
      ) : (
        <>
          {searchOpen && (
            <TextField className="border-b border-white/10 px-3 py-2" value={query} onChange={setQuery}>
              <Label className="sr-only">Search app documents</Label>
              <div className="flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2">
                <Search aria-hidden="true" className="text-zinc-600" size={13} />
                <Input autoFocus className="min-w-0 flex-1 bg-transparent text-xs text-zinc-300 outline-none" placeholder="Search pages and components" />
              </div>
            </TextField>
          )}

          <div className="max-h-[60%] shrink-0 overflow-y-auto border-b border-white/10 px-2 py-2 lg:max-h-[48%]">
            <TreeRow icon={<PanelsTopLeft size={15} />} label="Root" />
            <TreeRow expanded={pagesOpen} icon={<PanelsTopLeft size={15} />} label="Pages" onPress={() => setPagesOpen((current) => !current)} />
            {pagesOpen && (
              <div className="pl-4">
                <TreeRow expanded={desktopOpen} icon={<Monitor size={15} />} label="Desktop" onPress={() => setDesktopOpen((current) => !current)} />
                {desktopOpen && (
                  <div aria-label="Desktop pages" className="pl-5" role="region">
                    {pages.map((entry) => <DocumentRow key={entry.id} active={entry.id === props.activeDocumentId} entry={entry} onPress={() => props.onDocumentSelect(entry.id)} />)}
                    {!pages.length && <EmptyTreeMessage query={query} kind="pages" />}
                  </div>
                )}
                <DeviceRow icon={<Tablet size={14} />} label="Tablet" />
                <DeviceRow icon={<Smartphone size={14} />} label="Mobile" />
              </div>
            )}

            <TreeRow
              expanded={componentsOpen}
              icon={<Component size={15} />}
              label="Components"
              onPress={() => {
                setComponentsOpen((current) => !current);
                props.onModeChange("library");
              }}
            />
            {componentsOpen && (
              <div aria-label="Project components" className="pl-5" role="region">
                {components.map((entry) => <DocumentRow key={entry.id} active={entry.id === props.activeDocumentId} entry={entry} onPress={() => props.onDocumentSelect(entry.id)} />)}
                {!components.length && <EmptyTreeMessage query={query} kind="components" />}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1">{props.layers}</div>
        </>
      )}

      <Button
        fullWidth
        className="flex min-h-16 shrink-0 items-center justify-start gap-2 rounded-none border-t border-white/10 px-3 text-left transition-colors hover:bg-white/[0.03]"
        variant="ghost"
        onPress={() => props.onChange("catalog")}
      >
        <Library aria-hidden="true" className="shrink-0 text-zinc-500" size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-zinc-200">Component library</span>
          <span className="mt-0.5 block truncate text-[9px] text-zinc-500">Access shown per component</span>
        </span>
        <ChevronRight aria-hidden="true" className="text-zinc-600" size={14} />
      </Button>
    </aside>
  );
}

function TreeRow(props: { expanded?: boolean; icon: React.ReactNode; label: string; onPress?: () => void }) {
  const content = <>{props.onPress ? props.expanded ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronRight aria-hidden="true" size={13} /> : <span className="w-[13px]" />}{props.icon}<span className="truncate">{props.label}</span></>;
  if (!props.onPress) return <div className="flex h-9 items-center gap-2 px-2 text-xs font-medium text-zinc-400">{content}</div>;
  return <Button fullWidth className="flex h-9 min-h-9 justify-start gap-2 rounded-lg px-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.04]" variant="ghost" onPress={props.onPress}>{content}</Button>;
}

function DocumentRow(props: { active: boolean; entry: TargetDocumentEntry; onPress: () => void }) {
  return (
    <Button
      aria-current={props.active ? "page" : undefined}
      fullWidth
      className={`relative flex h-9 min-h-9 justify-start gap-2 rounded-lg px-2 text-xs ${props.active ? "bg-sky-500/15 text-sky-100 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sky-400" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
      variant="ghost"
      onPress={props.onPress}
    >
      {props.entry.kind === "screen" ? <PanelsTopLeft aria-hidden="true" size={14} /> : <Component aria-hidden="true" size={14} />}
      <span className="truncate">{props.entry.label}</span>
    </Button>
  );
}

function DeviceRow(props: { icon: React.ReactNode; label: string }) {
  return <div className="flex min-h-10 items-center gap-2 px-2 text-xs text-zinc-500"><span className="w-[13px]" />{props.icon}<span>{props.label}</span><span className="ml-auto text-[9px] text-zinc-700">Not configured</span></div>;
}

function EmptyTreeMessage(props: { kind: "pages" | "components"; query: string }) {
  return <p className="px-2 py-2 text-[10px] leading-4 text-zinc-600">{props.query.trim() ? `No ${props.kind} match “${props.query.trim()}”.` : `No ${props.kind} are registered yet.`}</p>;
}
