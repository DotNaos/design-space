import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Code2, SlidersHorizontal } from "lucide-react";

import type { TargetModule } from "../shared/target-module";
import { ProjectFileBrowser } from "./documents/ProjectFileBrowser";
import { ResizableWorkspacePanels } from "./shell/ResizableWorkspacePanels";
import { MobileDock, type MobilePane } from "./shell/MobileDock";
import { WorkspaceActivityRail, type WorkspaceActivity } from "./shell/WorkspaceActivityRail";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { SourceComponentInspector } from "./source/SourceComponentInspector";
import { SourceCodeCanvas } from "./source/SourceCodeCanvas";
import { hasRequiredPreviewArguments, SourcePreviewFrame } from "./source/SourcePreviewFrame";
import {
  SourceWorkspaceSidebar,
  type SourceWorkspaceSelection,
} from "./source/SourceWorkspaceSidebar";
import {
  findSourceTreeLayer,
  initialSourceTreeSelection,
  sourceTreeNodes,
} from "./source/source-workspace-tree";
import { useSourceFileEditor } from "./source/useSourceFileEditor";
import { useSourceLayerClassEditor } from "./source/useSourceLayerClassEditor";
import { DiffSheet } from "./components/DiffSheet/DiffSheet";
import { SourceLibraryCanvas, SourceLibraryInspector, SourceLibrarySidebar } from "./source/SourceLibraryWorkspace";
import { SourceComponentCreateSheet } from "./source/SourceComponentCreateSheet";
import { useSourceComponentCreation } from "./source/useSourceComponentCreation";

export function SourceWorkspace({ nestedPreview = false, target }: { nestedPreview?: boolean; target: TargetModule }) {
  const workspace = target.sourceWorkspace;
  if (!workspace) return null;
  const nodes = useMemo(() => sourceTreeNodes(workspace), [workspace]);
  const initial = initialSourceTreeSelection(nodes);
  const [activity, setActivity] = useState<WorkspaceActivity>("app");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [selection, setSelection] = useState<SourceWorkspaceSelection | undefined>(initial);
  const [rightMode, setRightMode] = useState<"code" | "design">("code");
  const [selectedProjectFileId, setSelectedProjectFileId] = useState<string>();
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState(() => workspace.library?.components[0]?.name);
  const componentCreation = useSourceComponentCreation();
  const selectedNode = nodes.find((candidate) => candidate.id === selection?.nodeId) ?? nodes[0];
  const requestedDevice = selection?.device ?? initial?.device ?? "desktop";
  const entry = selectedNode?.implementations[requestedDevice].entry;
  const selectedLayer = findSourceTreeLayer(entry?.layers, selection?.layerId);
  const previewEntry = selectedLayer?.kind === "html" && hasRequiredPreviewArguments(entry)
    ? nodes.find((candidate) => candidate.area === "layout")?.implementations[requestedDevice].entry ?? entry
    : entry;
  const selectedLabel = selectedLayer?.kind === "html"
    ? `<${selectedLayer.label}>`
    : selectedLayer?.kind === "slot"
      ? `slot:${selectedLayer.label}`
      : selectedNode?.label;
  const editor = useSourceFileEditor(entry?.fileId);
  const styleEditor = useSourceLayerClassEditor({
    connected: workspace.runtime === "react",
    editor,
    layer: selectedLayer,
  });
  const fileEditor = useSourceFileEditor(selectedProjectFileId);
  const selectedProjectFile = target.files.find((file) => file.id === selectedProjectFileId && file.kind === "file");
  const activeEditor = activity === "files" ? fileEditor : editor;
  const activeEditable = activity === "files" ? Boolean(selectedProjectFile?.editable) : activity === "app" ? Boolean(entry) : false;
  const connected = workspace.runtime === "react";
  const breadcrumb = activity === "files"
    ? ["Files"]
    : activity === "library"
      ? ["Library"]
      : selectedNode
        ? ["App", selectedNode.label, ...(selectedLayer ? [selectedLabel ?? selectedLayer.label] : [])]
        : ["App"];

  const appSidebar = (
    <SourceWorkspaceSidebar
      className="flex h-full w-full border-r-0"
      selected={selection}
      workspace={workspace}
      onCreateComponent={componentCreation.open}
      onSelect={(next) => {
        setSelection(next);
        setRightMode("code");
        setActivity("app");
        setMobilePane("canvas");
      }}
    />
  );
  const fileSidebar = (
    <ProjectFileBrowser
      className="flex h-full w-full border-r-0"
      files={target.files}
      selectedFileId={selectedProjectFileId}
      onSelect={(fileId) => {
        setSelectedProjectFileId(fileId);
        setActivity("files");
        setMobilePane("canvas");
      }}
    />
  );
  const librarySidebar = <SourceLibrarySidebar library={workspace.library} selected={selectedLibraryComponent} onSelect={setSelectedLibraryComponent} />;
  const left = activity === "files" ? fileSidebar : activity === "library" ? librarySidebar : appSidebar;
  const canvas = activity === "library" ? <SourceLibraryCanvas library={workspace.library} selected={selectedLibraryComponent} /> : activity === "files" ? (
    <SourceCodeCanvas
      editable={Boolean(selectedProjectFile?.editable)}
      editor={fileEditor}
      label={selectedProjectFile?.label ?? "Select a project file"}
    />
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {nestedPreview ? (
          <SourceCodeCanvas
            editable={false}
            editor={editor}
            label={entry?.label ?? selectedNode?.label ?? "Source"}
            path={entry?.relativePath}
            selection={selectedLayer?.source ?? entry?.source}
          />
        ) : <SourcePreviewFrame
          device={requestedDevice}
          entry={previewEntry}
          node={selectedNode}
          selectedLayer={selectedLayer?.kind === "html" ? selectedLayer : undefined}
          selectedClassCss={styleEditor.css}
          selectedClassName={selectedLayer?.className ? styleEditor.value : undefined}
          selectedText={selectedLayer?.text ? styleEditor.textValue : undefined}
          runtime={workspace.runtime}
          styles={workspace.styles}
          onDeviceChange={(device) => selectedNode && setSelection({ nodeId: selectedNode.id, device })}
        />}
      </div>
    </div>
  );
  const right = activity === "library"
    ? <SourceLibraryInspector library={workspace.library} selected={selectedLibraryComponent} />
    : activity === "files"
      ? <FileEvidencePanel editable={Boolean(selectedProjectFile?.editable)} label={selectedProjectFile?.label} />
      : (
        <div className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
          <nav aria-label="Source detail" className="flex h-10 shrink-0 items-center gap-1 border-b border-white/10 px-2">
            <Button className={`h-7 min-w-0 gap-1.5 rounded-md px-2.5 text-[10px] ${rightMode === "code" ? "bg-sky-400/10 text-sky-200" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={() => setRightMode("code")}><Code2 aria-hidden="true" size={12} />Code</Button>
            <Button className={`h-7 min-w-0 gap-1.5 rounded-md px-2.5 text-[10px] ${rightMode === "design" ? "bg-sky-400/10 text-sky-200" : "text-zinc-500"}`} size="sm" variant="ghost" onPress={() => setRightMode("design")}><SlidersHorizontal aria-hidden="true" size={12} />Design</Button>
          </nav>
          <div className="min-h-0 flex-1">
            {rightMode === "code" ? (
              <SourceCodeCanvas
                editable={Boolean(entry)}
                editor={editor}
                label={entry?.label ?? selectedNode?.label ?? "Source"}
                path={entry?.relativePath}
                selection={selectedLayer?.source ?? entry?.source}
              />
            ) : (
              <SourceComponentInspector
                className="flex h-full w-full border-l-0"
                entry={entry}
                layer={selectedLayer}
                styleEditor={styleEditor}
              />
            )}
          </div>
        </div>
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
          documentLabel={activity === "files" ? selectedProjectFile?.label ?? "Project files" : selectedLabel ?? "No source entry"}
          breadcrumb={breadcrumb}
          connected={connected}
          checking={false}
          canUndo={false}
          canRedo={false}
          canReset={activeEditable && activeEditor.dirty}
          canStrictUi={false}
          canDiff={activeEditable && activeEditor.dirty && !(activity === "app" && styleEditor.error)}
          canSave={activeEditable && Boolean(activeEditor.prepared)}
          saving={activeEditor.saving}
          onUndo={() => undefined}
          onRedo={() => undefined}
          onReset={activity === "app" && (selectedLayer?.className || selectedLayer?.text) ? styleEditor.reset : activeEditor.reset}
          onStrictUi={() => undefined}
          onDiff={() => void activeEditor.prepare()}
          onSave={() => void activeEditor.save()}
        />
        <ResizableWorkspacePanels
          namespace={{ projectId: target.project.id, documentId: `${selectedNode?.id ?? "empty"}:${requestedDevice}:${selectedLayer?.id ?? "component"}` }}
          left={{ label: "TypeScript app structure", content: left, defaultWidth: 300, minWidth: 260, maxWidth: 480 }}
          right={{ label: "Source code and component design", content: right, defaultWidth: 480, minWidth: 360, maxWidth: 760 }}
          mobile={mobile}
          contentClassName="flex"
        >
          {canvas}
        </ResizableWorkspacePanels>
      </div>
      {activeEditor.prepared && (
        <DiffSheet
          diff={activeEditor.prepared.diff}
          saving={activeEditor.saving}
          onClose={activeEditor.clearPrepared}
          onSave={() => void activeEditor.save()}
        />
      )}
      <SourceComponentCreateSheet
        busy={componentCreation.preparing}
        error={componentCreation.error}
        open={componentCreation.isOpen}
        onClose={componentCreation.close}
        onPrepare={(name) => void componentCreation.prepare(name)}
      />
      {componentCreation.prepared && (
        <DiffSheet
          diff={componentCreation.prepared.diff}
          saving={componentCreation.saving}
          onClose={componentCreation.discard}
          onSave={() => void componentCreation.save()}
        />
      )}
    </div>
  );
}

function FileEvidencePanel(props: { editable: boolean; label?: string }) {
  return (
    <aside aria-label="Project file evidence" className="flex h-full w-full flex-col border-l border-white/10 bg-[#141518] p-4">
      <h2 className="truncate text-sm font-semibold text-zinc-200">{props.label ?? "Project source"}</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {props.label ? props.editable
          ? "This file is part of the trusted TypeScript component catalog and can be edited through an exact diff."
          : "This file is registered for browsing but remains read only."
          : "Choose a registered file in the tree. Its code will open in the center workspace."}
      </p>
    </aside>
  );
}
