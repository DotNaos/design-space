import { useState } from "react";
import { Button } from "@heroui/react";
import { Boxes, Library } from "lucide-react";

import type { SourceWorkspaceLibrary } from "../shared/source-workspace";
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
  const entry = workspace.entries.find((candidate) => candidate.id === selection?.entryId) ?? initial.entry;
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
  const libraryState = <LibraryConnectionState library={workspace.library} />;
  const left = activity === "files" ? fileSidebar : activity === "library" ? libraryState : appSidebar;
  const canvas = activity === "library" ? libraryState : (
    <SourcePreviewFrame
      device={requestedDevice}
      entry={entry}
      runtime={workspace.runtime}
      styles={workspace.styles}
    />
  );
  const right = activity === "library" ? <LibraryEvidenceInspector library={workspace.library} /> : (
    <SourceComponentInspector className="flex h-full w-full border-l-0" entry={entry} />
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
          canReset={false}
          canStrictUi={false}
          canDiff={false}
          canSave={false}
          saving={false}
          onUndo={() => undefined}
          onRedo={() => undefined}
          onReset={() => undefined}
          onStrictUi={() => undefined}
          onDiff={() => undefined}
          onSave={() => undefined}
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
    </div>
  );
}

function LibraryConnectionState(props: { library?: SourceWorkspaceLibrary }) {
  return (
    <section aria-label="Component library evidence" className="grid h-full w-full place-items-center bg-[#141518] px-6 text-center">
      <div className="max-w-64">
        <Library aria-hidden="true" className="mx-auto text-zinc-600" size={22} />
        <h2 className="mt-3 text-sm font-semibold text-zinc-200">Component library</h2>
        {props.library ? (
          <>
            <p className="mt-2 font-mono text-[11px] text-zinc-300">{props.library.packageName}</p>
            <p className={`mt-2 text-[10px] font-medium ${props.library.mode === "development" ? "text-emerald-400" : "text-zinc-500"}`}>
              {props.library.mode === "development" ? "Development · Connected" : "Release · Read only"}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">No development or release library dependency was proven for this target yet.</p>
        )}
      </div>
    </section>
  );
}

function LibraryEvidenceInspector(props: { library?: SourceWorkspaceLibrary }) {
  return (
    <aside className="h-full w-full bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500"><Boxes size={14} /><span className="text-[10px] font-medium uppercase tracking-[0.14em]">Library evidence</span></div>
      {props.library ? (
        <dl className="mt-5 space-y-4 text-xs">
          <div><dt className="text-zinc-600">Package</dt><dd className="mt-1 font-mono text-zinc-300">{props.library.packageName}</dd></div>
          <div><dt className="text-zinc-600">Version</dt><dd className="mt-1 font-mono text-zinc-300">{props.library.version}</dd></div>
          <div><dt className="text-zinc-600">Access</dt><dd className={`mt-1 ${props.library.mode === "development" ? "text-emerald-400" : "text-zinc-300"}`}>{props.library.mode === "development" ? "Connected source · editing not enabled" : "Read-only release"}</dd></div>
        </dl>
      ) : (
        <p className="mt-4 text-xs leading-5 text-zinc-500">Design Space keeps a release library read-only. A development source is shown only when package evidence exists; write access requires a separate trusted registration.</p>
      )}
    </aside>
  );
}
