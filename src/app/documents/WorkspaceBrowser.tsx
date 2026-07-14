import { Boxes, Files, LayoutGrid } from "lucide-react";

import type { TargetDocumentEntry, TargetFileEntry } from "../../shared/target-module";
import type { DocumentAdapterView } from "../document/document-adapters";
import { ComponentCatalogBrowser } from "./ComponentCatalogBrowser";
import { DocumentNavigator, type ProductMode } from "./DocumentNavigator";
import { ProjectFilesWorkspace } from "./ProjectFilesWorkspace";

export type WorkspaceBrowserView = "documents" | "files" | "catalog";

export interface WorkspaceBrowserProps {
  className?: string;
  view: WorkspaceBrowserView;
  mode: ProductMode;
  entries: readonly TargetDocumentEntry[];
  files: readonly TargetFileEntry[];
  catalogEntries: readonly DocumentAdapterView[];
  activeDocumentId?: string;
  selectedComponentId?: string;
  requestedFileId?: string;
  canCreate: boolean;
  onViewChange: (view: WorkspaceBrowserView) => void;
  onModeChange: (mode: ProductMode) => void;
  onDocumentSelect: (documentId: string) => void;
  onFileSelect?: (fileId: string) => void;
  onCatalogSelect: (componentId: string) => void;
  onCreate: () => void;
  showViewNavigation?: boolean;
}

const views = [
  { id: "documents" as const, label: "Documents", shortLabel: "Docs", icon: LayoutGrid },
  { id: "files" as const, label: "Files", shortLabel: "Files", icon: Files },
  { id: "catalog" as const, label: "Catalog", shortLabel: "Catalog", icon: Boxes },
];

export function WorkspaceBrowser(props: WorkspaceBrowserProps) {
  return (
    <section
      aria-label="Project browser"
      className={`${props.className ?? "flex w-64"} min-w-0 shrink-0 flex-col border-r border-white/10 bg-[#141518]`}
    >
      {props.showViewNavigation !== false && (
        <nav aria-label="Project browser views" className="grid h-12 shrink-0 grid-cols-3 border-b border-white/10 p-1">
          {views.map(({ id, label, shortLabel, icon: Icon }) => (
            <button
              key={id}
              aria-current={props.view === id ? "page" : undefined}
              aria-label={label}
              className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-[10px] transition-colors ${props.view === id ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`}
              type="button"
              onClick={() => props.onViewChange(id)}
            >
              <Icon aria-hidden="true" size={13} />
              <span className="truncate">{shortLabel}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="min-h-0 flex-1">
        {props.view === "documents" && (
          <DocumentNavigator
            className="flex h-full w-full border-r-0!"
            mode={props.mode}
            entries={props.entries}
            activeDocumentId={props.activeDocumentId}
            canCreate={props.canCreate}
            onModeChange={props.onModeChange}
            onSelect={props.onDocumentSelect}
            onCreate={props.onCreate}
          />
        )}
        {props.view === "files" && (
          <ProjectFilesWorkspace
            className="flex h-full w-full border-r-0!"
            files={props.files}
            requestedFileId={props.requestedFileId}
            onSelect={props.onFileSelect}
          />
        )}
        {props.view === "catalog" && (
          <ComponentCatalogBrowser
            className="flex h-full w-full border-r-0!"
            entries={props.catalogEntries}
            selectedComponentId={props.selectedComponentId}
            onSelect={props.onCatalogSelect}
          />
        )}
      </div>
    </section>
  );
}
