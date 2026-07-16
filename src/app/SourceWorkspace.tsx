import { useState } from "react";
import { Button } from "@heroui/react";

import type { TargetModule } from "../shared/target-module";
import { ProjectFilesWorkspace } from "./documents/ProjectFilesWorkspace";
import { ResizableWorkspacePanels } from "./shell/ResizableWorkspacePanels";
import { MobileDock, type MobilePane } from "./shell/MobileDock";
import { WorkspaceActivityRail, type WorkspaceActivity } from "./shell/WorkspaceActivityRail";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { SourceComponentInspector } from "./source/SourceComponentInspector";
import { SourcePreviewFrame } from "./source/SourcePreviewFrame";
import {
  SourceWorkspaceSidebar,
  type SourceWorkspaceSelection,
} from "./source/SourceWorkspaceSidebar";
import { initialSourceSelection } from "./source/source-workspace-selection";
import { useSourceFileEditor } from "./source/useSourceFileEditor";
import { DiffSheet } from "./components/DiffSheet";
import { SourceLibraryCanvas, SourceLibraryInspector, SourceLibrarySidebar } from "./source/SourceLibraryWorkspace";

const areaLabels = { root: "Root", pages: "Pages", components: "Components" } as const;
const deviceLabels = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" } as const;

export function SourceWorkspace({ target }: { target: TargetModule }) {
  const workspace = target.sourceWorkspace;
  if (!workspace) return null;
  const initial = initialSourceSelection(workspace);
  const [activity, setActivity] = useState<WorkspaceActivity>("app");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [selection, setSelection] = useState<SourceWorkspaceSelection | undefined>(() => (
    initial.entry ? { entryId: initial.entry.id, device: initial.device } : undefined
  ));
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState(() => workspace.library?.components[0]?.name);
  const entry = workspace.entries.find((candidate) => candidate.id === selection?.entryId) ?? initial.entry;
  const editor = useSourceFileEditor(entry?.fileId);
  const requestedDevice = selection?.device ?? initial.device;
  const connected = workspace.runtime === "react" && Boolean(entry);
  const breadcrumb = activity === "files"
    ? ["Files"]
    : activity === "library"
      ? ["Library"]
      : entry
        ? ["App", areaLabels[entry.area], deviceLabels[requestedDevice], entry.label]
        : ["App"];

  const appSidebar = (
    <SourceWorkspaceSidebar
      className="flex h-full w-full border-r-0"
      selected={selection}
      workspace={workspace}
      onSelect={(next) => {
        setSelection(next);
        setActivity("app");
        setMobilePane("canvas");
      }}
    />
  );
  const fileSidebar = (
    <ProjectFilesWorkspace className="flex h-full w-full border-r-0" files={target.files} />
  );
  const librarySidebar = <SourceLibrarySidebar library={workspace.library} selected={selectedLibraryComponent} onSelect={setSelectedLibraryComponent} />;
  const left = activity === "files" ? fileSidebar : activity === "library" ? librarySidebar : appSidebar;
  const canvas = activity === "library" ? <SourceLibraryCanvas library={workspace.library} selected={selectedLibraryComponent} /> : (
    <SourcePreviewFrame
      device={requestedDevice}
      entry={entry}
      runtime={workspace.runtime}
      styles={workspace.styles}
    />
  );
  const right = activity === "library" ? <SourceLibraryInspector library={workspace.library} selected={selectedLibraryComponent} /> : (
    <SourceComponentInspector className="flex h-full w-full border-l-0" editor={editor} entry={entry} />
  );
  const mobile = (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 flex min-h-0 min-w-0">{canvas}</div>
      {mobilePane !== "canvas" && (
        <section aria-label="Source workspace drawer" className="absolute inset-x-2 bottom-0 z-40 flex h-[72dvh] min-h-72 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] shadow-2xl">
          {mobilePane === "inspect" ? right : mobilePane === "tree" ? appSidebar : (
            <>
              <nav aria-label="Mobile source areas" className="grid h-12 shrink-0 grid-cols-3 gap-1 border-b border-white/10 p-1">
                {(["app", "files", "library"] as const).map((next) => (
                  <Button key={next} className={`rounded-lg text-[10px] capitalize ${activity === next ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`} variant="ghost" onPress={() => setActivity(next)}>{next}</Button>
                ))}
              </nav>
              <div className="flex min-h-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">{left}</div>
            </>
          )}
        </section>
      )}
      <MobileDock active={mobilePane} onChange={setMobilePane} />
    </div>
  );

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-[#0d0e10] text-zinc-200">
      <WorkspaceActivityRail
        active={activity}
        strictUiChecking={false}
        canStrictUi={false}
        onApp={() => setActivity("app")}
        onLibrary={() => setActivity("library")}
        onFiles={() => setActivity("files")}
        onStrictUi={() => undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceTopBar
          targetLabel={target.project.label}
          documentLabel={entry?.label ?? "No source entry"}
          breadcrumb={breadcrumb}
          connected={connected}
          checking={false}
          canUndo={false}
          canRedo={false}
          canReset={activity === "app" && editor.dirty}
          canStrictUi={false}
          canDiff={activity === "app" && editor.dirty}
          canSave={activity === "app" && Boolean(editor.prepared)}
          saving={editor.saving}
          onUndo={() => undefined}
          onRedo={() => undefined}
          onReset={editor.reset}
          onStrictUi={() => undefined}
          onDiff={() => void editor.prepare()}
          onSave={() => void editor.save()}
        />
        <ResizableWorkspacePanels
          namespace={{ projectId: target.project.id, documentId: `${entry?.id ?? "empty"}:${requestedDevice}` }}
          left={{ label: "TypeScript app structure", content: left, defaultWidth: 300, minWidth: 260, maxWidth: 480 }}
          right={{ label: "TypeScript component contract", content: right, defaultWidth: 340, minWidth: 280, maxWidth: 560 }}
          mobile={mobile}
          contentClassName="flex"
        >
          {canvas}
        </ResizableWorkspacePanels>
      </div>
      {editor.prepared && (
        <DiffSheet
          diff={editor.prepared.diff}
          saving={editor.saving}
          onClose={editor.clearPrepared}
          onSave={() => void editor.save()}
        />
      )}
    </div>
  );
}
