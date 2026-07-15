import { useState } from "react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { Boxes, ChevronLeft, Component, Files, FolderKanban, Plus, Search, Smartphone } from "lucide-react";

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
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const expectedKind = props.mode === "app" ? "screen" : "component";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const pages = props.entries.filter((entry) => entry.kind === expectedKind && (
    !normalizedQuery || `${entry.label} ${entry.group ?? ""}`.toLocaleLowerCase().includes(normalizedQuery)
  ));
  const auxiliaryView = props.active === "files" || props.active === "catalog" ? props.active : undefined;

  return (
    <aside aria-label="Project, pages, and layers" className="flex h-full min-h-0 min-w-0 flex-col bg-[#141518]">
      <ProjectHeader
        active={auxiliaryView}
        mode={props.mode}
        projectLabel={props.projectLabel}
        onChange={props.onChange}
      />

      {auxiliaryView ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-2">
            <Button aria-label="Back to pages and layers" isIconOnly size="sm" variant="ghost" onPress={() => props.onChange("tree")}>
              <ChevronLeft aria-hidden="true" size={14} />
            </Button>
            <span className="text-xs font-semibold text-zinc-200">{auxiliaryView === "files" ? "Project files" : "Component catalog"}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{props.auxiliary}</div>
        </div>
      ) : (
        <>
          <section aria-label={props.mode === "app" ? "Pages" : "Components"} className="shrink-0 border-b border-white/10">
            <header className="flex h-10 items-center gap-1 px-3">
              <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">
                {props.mode === "app" ? "Pages" : "Components"}
              </h2>
              <Button
                aria-label={`Search ${expectedKind}s`}
                aria-pressed={searchOpen}
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setSearchOpen((current) => !current)}
              >
                <Search aria-hidden="true" size={14} />
              </Button>
              <Button aria-label={`Create ${expectedKind}`} isDisabled={!props.canCreate} isIconOnly size="sm" variant="ghost" onPress={props.onCreate}>
                <Plus aria-hidden="true" size={15} />
              </Button>
            </header>

            {searchOpen && (
              <TextField className="px-3 pb-2" value={query} onChange={setQuery}>
                <Label className="sr-only">Search {expectedKind}s</Label>
                <div className="flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2">
                  <Search aria-hidden="true" className="text-zinc-600" size={13} />
                  <Input autoFocus className="min-w-0 flex-1 bg-transparent text-xs text-zinc-300 outline-none" placeholder={`Search ${expectedKind}s`} />
                </div>
              </TextField>
            )}

            <div className="max-h-44 overflow-y-auto pb-2">
              {pages.map((entry) => {
                const active = entry.id === props.activeDocumentId;
                return (
                  <button
                    key={entry.id}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-xs transition-colors ${active ? "bg-white/[0.09] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}
                    type="button"
                    onClick={() => props.onDocumentSelect(entry.id)}
                  >
                    {entry.kind === "screen" ? <Smartphone aria-hidden="true" size={13} /> : <Component aria-hidden="true" size={13} />}
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  </button>
                );
              })}
              {!pages.length && (
                <p className="px-3 py-3 text-[11px] leading-4 text-zinc-600">
                  {normalizedQuery ? `No ${expectedKind}s match “${query.trim()}”.` : `No ${expectedKind}s are registered yet.`}
                </p>
              )}
            </div>
          </section>

          <div className="flex min-h-0 flex-1">{props.layers}</div>
        </>
      )}
    </aside>
  );
}

function ProjectHeader(props: {
  active?: "files" | "catalog";
  mode: ProductMode;
  projectLabel: string;
  onChange: (view: WorkspaceSidebarView) => void;
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3">
      <FolderKanban aria-hidden="true" className="shrink-0 text-sky-400" size={16} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xs font-semibold text-zinc-100">{props.projectLabel}</h1>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-zinc-600">{props.mode === "app" ? "App project" : "Component library"}</p>
      </div>
      <Button
        aria-label="Project files"
        aria-pressed={props.active === "files"}
        isIconOnly
        size="sm"
        variant={props.active === "files" ? "secondary" : "ghost"}
        onPress={() => props.onChange(props.active === "files" ? "tree" : "files")}
      >
        <Files aria-hidden="true" size={14} />
      </Button>
      <Button
        aria-label="Component catalog"
        aria-pressed={props.active === "catalog"}
        isIconOnly
        size="sm"
        variant={props.active === "catalog" ? "secondary" : "ghost"}
        onPress={() => props.onChange(props.active === "catalog" ? "tree" : "catalog")}
      >
        <Boxes aria-hidden="true" size={14} />
      </Button>
    </header>
  );
}
