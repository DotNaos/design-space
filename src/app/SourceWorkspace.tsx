import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Code2, SlidersHorizontal } from "lucide-react";

import type { TargetModule } from "../shared/target-module";
import type { GeneratedSourceDesign } from "../shared/contracts";
import type { SourceDesignScope } from "../shared/source-design";
import type { SourceWorkspaceLayer } from "../shared/source-workspace";
import { runLocalOperation } from "./api";
import { ProjectFileBrowser } from "./documents/ProjectFileBrowser";
import { ResizableWorkspacePanels } from "./shell/ResizableWorkspacePanels";
import { MobileDock, type MobilePane } from "./shell/MobileDock";
import { WorkspaceActivityRail, type WorkspaceActivity } from "./shell/WorkspaceActivityRail";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { SourceComponentInspector } from "./source/SourceComponentInspector";
import { SourceCodeCanvas } from "./source/SourceCodeCanvas";
import { SourcePreviewFrame } from "./source/SourcePreviewFrame";
import {
  SourceWorkspaceSidebar,
  type SourceWorkspaceSelection,
} from "./source/SourceWorkspaceSidebar";
import {
  findSourceTreeLayer,
  initialSourceTreeSelection,
  sourceTreeNodes,
} from "./source/source-workspace-tree";
import { initialFocusOccurrence, sourceFocusGraph, type SourceOccurrence } from "./source/source-focus-tree";
import { applySourceSlotCandidate, sourceSlotCandidates, type SourceComponentCandidate } from "./source/source-slot-composition";
import { useSourceDraftAnalysis } from "./source/useSourceDraftAnalysis";
import { useSourceFileEditor } from "./source/useSourceFileEditor";
import { useSourceLayerClassEditor } from "./source/useSourceLayerClassEditor";
import { DiffSheet } from "./components/DiffSheet/DiffSheet";
import {
  selectedSourceLibraryComponent,
  SourceLibraryCanvas,
  SourceLibraryInspector,
  SourceLibrarySidebar,
} from "./source/SourceLibraryWorkspace";
import { findSourceLibraryLayerOwner } from "./source/source-library-selection";
import { SourceLibraryEditorPanel } from "./source/SourceLibraryEditorPanel";
import { SourceComponentCreateSheet } from "./source/SourceComponentCreateSheet";
import { useSourceComponentCreation } from "./source/useSourceComponentCreation";
import { useSourceLibraryRuntime } from "./source/useSourceLibraryRuntime";
import { SourceChangeReviewModal } from "./source/SourceChangeReviewModal";
import { createLocalSourceDraftWorkspace } from "./source/source-draft-local";
import type { SourceDraftLocation } from "./source/source-draft-workspace";
import { useSourceDraftFile, useSourceDraftWorkspace } from "./source/useSourceDraftWorkspace";
import { useSourceChangeReview } from "./source/useSourceChangeReview";
import { CodeDocumentSwitch, FileEvidencePanel, findSourceSlotLayer } from "./source/SourceWorkspaceDetails";
import { sourceCanvasSelection, sourceCanvasVisualLayer } from "./source/source-canvas-selection";
import type { SourceLayerMetrics, SourcePreviewMode } from "./source/source-layer-design";
import { useCanvasSlotEdit } from "./source/useCanvasSlotEdit";

export function SourceWorkspace({ nestedPreview = false, target }: { nestedPreview?: boolean; target: TargetModule }) {
  const registeredWorkspace = target.sourceWorkspace;
  if (!registeredWorkspace) return null;
  const registeredNodes = useMemo(() => sourceTreeNodes(registeredWorkspace), [registeredWorkspace]);
  const initial = initialSourceTreeSelection(registeredNodes);
  const initialGraph = useMemo(() => sourceFocusGraph(registeredNodes, initial?.device ?? "desktop"), [initial?.device, registeredNodes]);
  const initialFocusId = initialFocusOccurrence(initialGraph);
  const initialFocus = initialFocusId ? initialGraph.occurrences.get(initialFocusId) : undefined;
  const [activity, setActivity] = useState<WorkspaceActivity>("app");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [selection, setSelection] = useState<SourceWorkspaceSelection | undefined>(() => initial && initialFocusId ? {
    ...initial,
    nodeId: initialFocus?.node.id ?? initial.nodeId,
    occurrenceId: initialFocusId,
    kind: "component",
  } : initial);
  const [focusId, setFocusId] = useState<string | undefined>(initialFocusId);
  const [draftSelection, setDraftSelection] = useState<{ start: number; end: number }>();
  const [rightMode, setRightMode] = useState<"code" | "design">("code");
  const [codeDocument, setCodeDocument] = useState<"source" | "design">("source");
  const [canvasMode, setCanvasMode] = useState<SourcePreviewMode>("design");
  const [selectedLayerMetrics, setSelectedLayerMetrics] = useState<SourceLayerMetrics>();
  const [selectedProjectFileId, setSelectedProjectFileId] = useState<string>();
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState(() => registeredWorkspace.library?.components[0]?.name);
  const [selectedLibraryLayerId, setSelectedLibraryLayerId] = useState<string>();
  const [designGeneration, setDesignGeneration] = useState<{ entryId?: string; error?: string }>({});
  const [draftWorkspace] = useState(createLocalSourceDraftWorkspace);
  const { state: draftWorkspaceState } = useSourceDraftWorkspace(draftWorkspace);
  const libraryRootId = `${target.project.id}:${target.sourceLibrary?.packageName ?? "library-development"}`;
  const componentCreation = useSourceComponentCreation();
  const registeredSourceNode = registeredNodes.find((candidate) => candidate.id === (selection?.sourceNodeId ?? selection?.nodeId)) ?? registeredNodes[0];
  const requestedDevice = selection?.device ?? initial?.device ?? "desktop";
  const registeredCodeEntry = registeredSourceNode?.implementations[requestedDevice].entry;
  const editorLocation = useMemo<SourceDraftLocation | undefined>(() => registeredCodeEntry ? ({
    scope: "app",
    rootId: target.project.id,
    fileId: registeredCodeEntry.fileId,
  }) : undefined, [registeredCodeEntry?.fileId, target.project.id]);
  const editor = useSourceDraftFile(draftWorkspace, editorLocation);
  const draftAnalysis = useSourceDraftAnalysis(registeredWorkspace, editor);
  const workspace = draftAnalysis.workspace;
  const libraryRuntime = useSourceLibraryRuntime(target.sourceLibrary);
  const nodes = useMemo(() => sourceTreeNodes(workspace), [workspace]);
  const graph = useMemo(() => sourceFocusGraph(nodes, requestedDevice), [nodes, requestedDevice]);
  const definitionSelected = selection?.kind === "component" && !selection.occurrenceId;
  const resolvedFocusId = definitionSelected
    ? undefined
    : graph.occurrences.has(focusId ?? "") ? focusId : initialFocusOccurrence(graph);
  const focusedOccurrence = resolvedFocusId ? graph.occurrences.get(resolvedFocusId) : undefined;
  const selectedOccurrence = selection?.occurrenceId ? graph.occurrences.get(selection.occurrenceId) : undefined;
  const selectedNode = nodes.find((candidate) => candidate.id === selection?.nodeId) ?? focusedOccurrence?.node ?? nodes[0];
  const sourceNode = nodes.find((candidate) => candidate.id === (selection?.sourceNodeId ?? selectedNode?.id)) ?? selectedNode;
  const entry = sourceNode?.implementations[requestedDevice].entry;
  const designEditorLocation = useMemo<SourceDraftLocation | undefined>(() => entry?.design ? ({
    scope: "app",
    rootId: target.project.id,
    fileId: entry.design.fileId,
  }) : undefined, [entry?.design?.fileId, target.project.id]);
  const designEditor = useSourceDraftFile(draftWorkspace, designEditorLocation);
  const activeCodeDocument = codeDocument === "design" && entry?.design ? "design" : "source";
  const codeEditor = activeCodeDocument === "design" ? designEditor : editor;
  const inspectorEntry = selectedOccurrence?.entry ?? focusedOccurrence?.entry ?? selectedNode?.implementations[requestedDevice].entry;
  const previewEntry = focusedOccurrence?.entry ?? selectedNode?.implementations[requestedDevice].entry;
  const selectedLayer = findSourceTreeLayer(entry?.layers, selection?.layerId)
    ?? (selection?.kind === "slot" && selection.slotName
      ? findSourceSlotLayer(entry?.layers, selection.slotName)
      : undefined);
  const visualLayer = sourceCanvasVisualLayer(previewEntry, selectedLayer);
  const appReviewLayer = findSourceTreeLayer(registeredCodeEntry?.layers, visualLayer?.id);
  const inspectorSlotLayers = focusedOccurrence?.usageLayer?.children.filter((layer) => layer.kind === "slot" && layer.slot) ?? [];
  const inspectorSourceOwner = focusedOccurrence?.usageOwnerId
    ? nodes.find((node) => node.id === focusedOccurrence.usageOwnerId)
    : undefined;
  const inspectorSourceOwnerEntry = inspectorSourceOwner?.implementations[requestedDevice].entry;
  const slotEditorReady = Boolean(entry && editor.snapshot?.fileId === entry.fileId && !editor.loading);
  const selectedLabel = selectedLayer?.kind === "html"
    ? `<${selectedLayer.label}>`
    : selectedLayer?.kind === "slot"
      ? `slot:${selectedLayer.label}`
      : focusedOccurrence?.node.label ?? selectedNode?.label;
  const styleEditor = useSourceLayerClassEditor({
    connected: workspace.runtime === "react",
    editor,
    layer: visualLayer,
    ready: draftAnalysis.ready,
    scope: "app",
  });
  const baseLibraryComponent = selectedSourceLibraryComponent({
    catalog: target.sourceLibrary,
    library: workspace.library,
    mode: libraryRuntime.mode,
    selected: selectedLibraryComponent,
  });
  const baseLibraryPreviewEntry = baseLibraryComponent?.entry;
  const baseLibraryEditEntry = libraryRuntime.mode === "development"
    ? findSourceLibraryLayerOwner(target.sourceLibrary?.development, selectedLibraryLayerId) ?? baseLibraryPreviewEntry
    : baseLibraryPreviewEntry;
  const baseLibrarySelectedLayer = findSourceTreeLayer(baseLibraryEditEntry?.layers, selectedLibraryLayerId);
  const libraryEditorLocation = useMemo<SourceDraftLocation | undefined>(() => (
    libraryRuntime.mode === "development" && baseLibraryEditEntry ? {
      scope: "library-development",
      rootId: libraryRootId,
      fileId: baseLibraryEditEntry.fileId,
    } : undefined
  ), [baseLibraryEditEntry?.fileId, libraryRootId, libraryRuntime.mode]);
  const libraryEditor = useSourceDraftFile(draftWorkspace, libraryEditorLocation);
  const libraryDraftAnalysis = useSourceDraftAnalysis(
    target.sourceLibrary?.development ?? registeredWorkspace,
    libraryEditor,
    "library-development",
  );
  const effectiveLibraryCatalog = useMemo(() => target.sourceLibrary ? ({
    ...target.sourceLibrary,
    ...(target.sourceLibrary.development ? { development: libraryDraftAnalysis.workspace } : {}),
  }) : undefined, [libraryDraftAnalysis.workspace, target.sourceLibrary]);
  const libraryComponent = selectedSourceLibraryComponent({
    catalog: effectiveLibraryCatalog,
    library: workspace.library,
    mode: libraryRuntime.mode,
    selected: selectedLibraryComponent,
  });
  const libraryPreviewEntry = libraryComponent?.entry;
  const libraryEntry = libraryRuntime.mode === "development"
    ? findSourceLibraryLayerOwner(effectiveLibraryCatalog?.development, selectedLibraryLayerId) ?? libraryPreviewEntry
    : libraryPreviewEntry;
  const libraryDesignEditorLocation = useMemo<SourceDraftLocation | undefined>(() => (
    libraryRuntime.mode === "development" && libraryEntry?.design ? {
      scope: "library-development",
      rootId: libraryRootId,
      fileId: libraryEntry.design.fileId,
    } : undefined
  ), [libraryEntry?.design?.fileId, libraryRootId, libraryRuntime.mode]);
  const libraryDesignEditor = useSourceDraftFile(draftWorkspace, libraryDesignEditorLocation);
  const librarySelectedLayer = findSourceTreeLayer(libraryEntry?.layers, selectedLibraryLayerId) ?? baseLibrarySelectedLayer;
  const libraryVisualLayer = sourceCanvasVisualLayer(libraryEntry, librarySelectedLayer);
  const libraryReviewLayer = sourceCanvasVisualLayer(baseLibraryEditEntry, baseLibrarySelectedLayer);
  const libraryStyleEditor = useSourceLayerClassEditor({
    connected: libraryDraftAnalysis.workspace.runtime === "react",
    editor: libraryEditor,
    layer: libraryVisualLayer,
    ready: libraryDraftAnalysis.ready,
    scope: "library-development",
  });
  const fileEditor = useSourceFileEditor(selectedProjectFileId);
  const selectedProjectFile = target.files.find((file) => file.id === selectedProjectFileId && file.kind === "file");
  const activeEditor = activity === "files"
    ? fileEditor
    : activity === "library"
      ? rightMode === "code" && codeDocument === "design" && libraryEntry?.design ? libraryDesignEditor : libraryEditor
      : rightMode === "code" ? codeEditor : editor;
  const activeEditable = activity === "files"
    ? Boolean(selectedProjectFile?.editable)
    : activity === "app"
      ? activeCodeDocument === "design" && rightMode === "code"
        ? Boolean(entry?.design)
        : Boolean(entry)
      : libraryRuntime.mode === "development" && Boolean(libraryEntry);
  const connected = workspace.runtime === "react";
  const breadcrumb = activity === "files"
    ? ["Files"]
    : activity === "library"
      ? [
        "Library",
        ...(libraryPreviewEntry ? [libraryPreviewEntry.label] : []),
        ...(libraryEntry && libraryEntry.id !== libraryPreviewEntry?.id ? [libraryEntry.label] : []),
        ...(librarySelectedLayer ? [`<${librarySelectedLayer.label}>`] : []),
      ]
      : selectedNode
        ? ["App", selectedNode.label, ...(selectedLayer ? [selectedLabel ?? selectedLayer.label] : [])]
        : ["App"];

  useEffect(() => {
    if (!editorLocation || !editor.dirty) return;
    draftWorkspace.setValidation(
      editorLocation,
      draftAnalysis.analyzing ? "validating" : draftAnalysis.error ? "invalid" : "valid",
      draftAnalysis.error,
    );
  }, [draftAnalysis.analyzing, draftAnalysis.error, draftWorkspace, editor.dirty, editor.draft, editorLocation]);

  useEffect(() => {
    if (!libraryEditorLocation || !libraryEditor.dirty) return;
    draftWorkspace.setValidation(
      libraryEditorLocation,
      libraryDraftAnalysis.analyzing ? "validating" : libraryDraftAnalysis.error ? "invalid" : "valid",
      libraryDraftAnalysis.error,
    );
  }, [draftWorkspace, libraryDraftAnalysis.analyzing, libraryDraftAnalysis.error, libraryEditor.dirty, libraryEditor.draft, libraryEditorLocation]);

  useEffect(() => {
    const changed = Boolean(appReviewLayer && (
      (appReviewLayer.className && styleEditor.value !== appReviewLayer.className.value)
      || (appReviewLayer.text && styleEditor.textValue !== appReviewLayer.text.value)
    ));
    if (!editorLocation || !editor.dirty || !appReviewLayer || !changed) return;
    draftWorkspace.setVisualReview(editorLocation, {
      layerId: appReviewLayer.id,
      ...(previewEntry ? { previewEntryId: previewEntry.id } : {}),
      ...(appReviewLayer.className ? { className: styleEditor.value, css: styleEditor.css } : {}),
      ...(appReviewLayer.text ? { text: styleEditor.textValue } : {}),
    });
  }, [appReviewLayer, draftWorkspace, editor.dirty, editorLocation, previewEntry, styleEditor.css, styleEditor.textValue, styleEditor.value]);

  useEffect(() => {
    const changed = Boolean(libraryReviewLayer && (
      (libraryReviewLayer.className && libraryStyleEditor.value !== libraryReviewLayer.className.value)
      || (libraryReviewLayer.text && libraryStyleEditor.textValue !== libraryReviewLayer.text.value)
    ));
    if (!libraryEditorLocation || !libraryEditor.dirty || !libraryReviewLayer || !changed) return;
    draftWorkspace.setVisualReview(libraryEditorLocation, {
      layerId: libraryReviewLayer.id,
      ...(libraryPreviewEntry ? { previewEntryId: libraryPreviewEntry.id } : {}),
      ...(libraryReviewLayer.className ? { className: libraryStyleEditor.value, css: libraryStyleEditor.css } : {}),
      ...(libraryReviewLayer.text ? { text: libraryStyleEditor.textValue } : {}),
    });
  }, [draftWorkspace, libraryEditor.dirty, libraryEditorLocation, libraryPreviewEntry, libraryReviewLayer, libraryStyleEditor.css, libraryStyleEditor.textValue, libraryStyleEditor.value]);

  const currentDraftChanges = useMemo(() => draftWorkspaceState.changes.filter((change) => (
    (change.scope === "app" && change.rootId === target.project.id)
    || (change.scope === "library-development" && change.rootId === libraryRootId)
  )), [draftWorkspaceState.changes, libraryRootId, target.project.id]);
  const review = useSourceChangeReview({
    appLabel: target.project.label,
    appVisual: {
      currentFileId: editor.snapshot?.fileId,
      css: styleEditor.css,
      layer: appReviewLayer,
      textValue: styleEditor.textValue,
      value: styleEditor.value,
    },
    appWorkspace: registeredWorkspace,
    changes: currentDraftChanges,
    draftWorkspace,
    libraryLabel: target.sourceLibrary?.packageName ?? "Component library",
    libraryVisual: {
      currentFileId: libraryEditor.snapshot?.fileId,
      css: libraryStyleEditor.css,
      layer: libraryReviewLayer,
      textValue: libraryStyleEditor.textValue,
      value: libraryStyleEditor.value,
    },
    libraryWorkspace: target.sourceLibrary?.development ?? registeredWorkspace,
  });

  const generateDesign = async (scope: SourceDesignScope, entryId: string) => {
    if (designGeneration.entryId && !designGeneration.error) return;
    setDesignGeneration({ entryId });
    try {
      await runLocalOperation<GeneratedSourceDesign>({ type: "generate-source-design", scope, entryId });
      setDesignGeneration({});
    } catch (error) {
      setDesignGeneration({ entryId, error: error instanceof Error ? error.message : "The design file could not be generated." });
    }
  };

  const prepareSlotEdit = (occurrence: SourceOccurrence) => {
    const sourceOwnerId = occurrence.usageOwnerId ?? occurrence.node.id;
    setSelection((current) => current ? { ...current, sourceNodeId: sourceOwnerId } : {
      nodeId: occurrence.node.id,
      sourceNodeId: sourceOwnerId,
      device: requestedDevice,
      occurrenceId: occurrence.id,
      kind: "component",
    });
  };
  const applySlot = (
    slot: SourceWorkspaceLayer,
    _occurrence: SourceOccurrence,
    candidate: SourceComponentCandidate,
    action: "add" | "replace",
  ) => {
    if (!entry || !editor.snapshot || editor.snapshot.fileId !== entry.fileId) return;
    try {
      const result = applySourceSlotCandidate(editor.draft, entry.relativePath, slot, candidate, action);
      editor.setDraft(result.source);
      setDraftSelection(result.selection);
    } catch {
      return;
    }
  };
  const canvasSlotEdit = useCanvasSlotEdit({
    graph,
    sourceNodeId: selection?.sourceNodeId,
    slotEditorReady,
    onApply: applySlot,
    onPrepare: prepareSlotEdit,
  });

  const appSidebar = (
    <SourceWorkspaceSidebar
      className="flex h-full w-full border-r-0"
      focusId={resolvedFocusId}
      selected={selection}
      workspace={workspace}
      editingSourceOwnerId={selection?.sourceNodeId}
      slotEditorReady={slotEditorReady}
      onCreateComponent={componentCreation.open}
      onFocus={(occurrenceId, next) => {
        setFocusId(occurrenceId);
        setSelection(next);
        setDraftSelection(undefined);
        setActivity("app");
        setMobilePane("canvas");
      }}
      onApplySlot={applySlot}
      onPrepareSlotEdit={prepareSlotEdit}
      onSelect={(next) => {
        setSelection(next);
        setDraftSelection(undefined);
        setActivity("app");
        setMobilePane(next.kind === "slot" ? "tree" : "canvas");
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
  const librarySidebar = (
    <SourceLibrarySidebar
      catalog={effectiveLibraryCatalog}
      device={requestedDevice}
      library={workspace.library}
      mode={libraryRuntime.mode}
      selected={selectedLibraryComponent}
      selectedLayer={librarySelectedLayer}
      generateDesignError={designGeneration.error}
      generatingDesignEntryId={designGeneration.entryId}
      onDeviceChange={() => undefined}
      onGenerateDesign={(selectedEntry) => void generateDesign("library-development", selectedEntry.id)}
      onModeChange={libraryRuntime.setMode}
      onSelectLayer={(layerId) => {
        setSelectedLibraryLayerId(layerId);
        setActivity("library");
      }}
      onSelect={(componentId) => {
        setSelectedLibraryComponent(componentId);
        setSelectedLibraryLayerId(undefined);
        setActivity("library");
      }}
    />
  );
  const left = activity === "files" ? fileSidebar : activity === "library" ? librarySidebar : appSidebar;
  const canvas = activity === "library" ? (
    <SourceLibraryCanvas
      catalog={effectiveLibraryCatalog}
      device={requestedDevice}
      library={workspace.library}
      mode={libraryRuntime.mode}
      selected={selectedLibraryComponent}
      selectedLayer={libraryVisualLayer}
      selectedClassCss={libraryStyleEditor.css}
      selectedClassName={libraryVisualLayer?.className ? libraryStyleEditor.value : undefined}
      selectedText={libraryVisualLayer?.text ? libraryStyleEditor.textValue : undefined}
      previewMode={canvasMode}
      selectionMode={libraryRuntime.mode === "development"}
      generateDesignError={designGeneration.error}
      generatingDesignEntryId={designGeneration.entryId}
      onDeviceChange={(device) => setSelection((current) => current ? { ...current, device } : current)}
      onGenerateDesign={(selectedEntry) => void generateDesign("library-development", selectedEntry.id)}
      onModeChange={libraryRuntime.setMode}
      onPreviewModeChange={setCanvasMode}
      onSelectLayer={(layerId) => {
        setSelectedLibraryLayerId(layerId);
        setRightMode("design");
        setMobilePane("inspect");
      }}
      onSelectedLayerMetrics={setSelectedLayerMetrics}
    />
  ) : activity === "files" ? (
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
            selection={draftSelection ?? selectedLayer?.source ?? entry?.source}
          />
        ) : <SourcePreviewFrame
          device={requestedDevice}
          entry={previewEntry}
          entries={workspace.entries}
          isolateSelectedLayer={false}
          mode={canvasMode}
          node={focusedOccurrence?.node ?? selectedNode}
          selectedLayer={visualLayer}
          selectedClassCss={styleEditor.css}
          selectedClassName={visualLayer?.className ? styleEditor.value : undefined}
          selectedText={visualLayer?.text ? styleEditor.textValue : undefined}
          slotEditorReady={!canvasSlotEdit.busy}
          slotLayers={inspectorSlotLayers}
          generateDesignError={designGeneration.entryId === previewEntry?.id ? designGeneration.error : undefined}
          generatingDesign={designGeneration.entryId === previewEntry?.id}
          runtime={workspace.runtime}
          styles={workspace.styles}
          candidatesForSlot={(slot) => sourceSlotCandidates(workspace, nodes, slot, requestedDevice, inspectorSourceOwnerEntry?.relativePath ?? entry?.relativePath ?? "")}
          onApplySlot={(slot, candidate, action) => focusedOccurrence && canvasSlotEdit.applySlot(slot, focusedOccurrence, candidate, action)}
          onModeChange={setCanvasMode}
          onSelectedLayerMetrics={setSelectedLayerMetrics}
          onSelectLayer={(layerId) => {
            const next = sourceCanvasSelection(graph, resolvedFocusId, layerId, requestedDevice);
            if (!next) return;
            setSelection(next);
            setDraftSelection(undefined);
            setRightMode("design");
          }}
          onGenerateDesign={previewEntry ? () => void generateDesign("app", previewEntry.id) : undefined}
          onDeviceChange={(device) => selectedNode && setSelection((current) => ({
            ...(current ?? {}),
            nodeId: selectedNode.id,
            device,
          }))}
        />}
      </div>
    </div>
  );
  const right = activity === "library"
    ? (
      <SourceLibraryEditorPanel
        activeTab={rightMode}
        codeDocument={codeDocument}
        designEditor={libraryDesignEditor}
        entry={libraryEntry}
        mode={libraryRuntime.mode}
        releaseFallback={<SourceLibraryInspector
          catalog={effectiveLibraryCatalog}
          device={requestedDevice}
          library={workspace.library}
          mode={libraryRuntime.mode}
          selected={selectedLibraryComponent}
          onDeviceChange={() => undefined}
          onModeChange={libraryRuntime.setMode}
        />}
        selectedLayer={librarySelectedLayer}
        designLayer={libraryVisualLayer}
        selectedLayerMetrics={selectedLayerMetrics}
        sourceEditor={libraryEditor}
        styleEditor={libraryStyleEditor}
        onActiveTabChange={setRightMode}
        onCodeDocumentChange={setCodeDocument}
      />
    )
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
                editable={activeCodeDocument === "design" ? Boolean(entry?.design) : Boolean(entry)}
                editor={codeEditor}
                label={activeCodeDocument === "design" ? `${entry?.label ?? selectedNode?.label ?? "Component"} design` : entry?.label ?? selectedNode?.label ?? "Source"}
                path={activeCodeDocument === "design" ? entry?.design?.relativePath : entry?.relativePath}
                selection={activeCodeDocument === "source" ? draftSelection ?? selectedLayer?.source ?? entry?.source : undefined}
                toolbar={entry?.design ? (
                  <CodeDocumentSwitch value={activeCodeDocument} onChange={setCodeDocument} />
                ) : undefined}
              />
            ) : (
              <SourceComponentInspector
                className="flex h-full w-full border-l-0"
                entry={inspectorEntry}
                layer={visualLayer}
                layerMetrics={selectedLayerMetrics}
                slotLayers={inspectorSlotLayers}
                slotEditorReady={selection?.sourceNodeId === focusedOccurrence?.usageOwnerId && slotEditorReady}
                styleEditor={styleEditor}
                candidatesForSlot={(slot) => sourceSlotCandidates(workspace, nodes, slot, requestedDevice, inspectorSourceOwnerEntry?.relativePath ?? entry?.relativePath ?? "")}
                onApplySlot={(slot, candidate, action) => focusedOccurrence && applySlot(slot, focusedOccurrence, candidate, action)}
                onPrepareSlotEdit={() => focusedOccurrence && prepareSlotEdit(focusedOccurrence)}
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
          documentLabel={activity === "files"
            ? selectedProjectFile?.label ?? "Project files"
            : activity === "library"
              ? libraryEntry?.label ?? "Component library"
              : selectedLabel ?? "No source entry"}
          breadcrumb={breadcrumb}
          connected={connected}
          checking={activity === "library" ? libraryDraftAnalysis.analyzing : draftAnalysis.analyzing}
          canUndo={activeEditor.canUndo}
          canRedo={activeEditor.canRedo}
          canReset={activeEditable && activeEditor.dirty}
          canStrictUi={false}
          canDiff={activity === "files" && activeEditable && fileEditor.dirty}
          canSave={activity === "files" && activeEditable && Boolean(fileEditor.prepared)}
          saving={activity === "files" ? fileEditor.saving : review.applying}
          pendingChanges={currentDraftChanges.length}
          onUndo={() => {
            activeEditor.undo();
            setDraftSelection(undefined);
          }}
          onRedo={() => {
            activeEditor.redo();
            setDraftSelection(undefined);
          }}
          onReset={activity === "app" && activeEditor === editor && (visualLayer?.className || visualLayer?.text)
            ? styleEditor.reset
            : activity === "library" && activeEditor === libraryEditor && (libraryVisualLayer?.className || libraryVisualLayer?.text)
              ? libraryStyleEditor.reset
              : activeEditor.reset}
          onStrictUi={() => undefined}
          onDiff={() => void fileEditor.prepare()}
          onSave={() => void fileEditor.save()}
          onReviewChanges={activity === "files" ? undefined : review.show}
        />
        <ResizableWorkspacePanels
          namespace={{ projectId: target.project.id, documentId: `${focusedOccurrence?.node.id ?? selectedNode?.id ?? "empty"}:${requestedDevice}` }}
          left={{ label: "TypeScript app structure", content: left, defaultWidth: 300, minWidth: 260, maxWidth: 480 }}
          right={{ label: "Source code and component design", content: right, defaultWidth: 480, minWidth: 360, maxWidth: 760 }}
          mobile={mobile}
          contentClassName="flex"
        >
          {canvas}
        </ResizableWorkspacePanels>
      </div>
      {activity === "files" && fileEditor.prepared && (
        <DiffSheet
          diff={fileEditor.prepared.diff}
          saving={fileEditor.saving}
          onClose={fileEditor.clearPrepared}
          onSave={() => void fileEditor.save()}
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
      <SourceChangeReviewModal
        applying={review.applying}
        changes={review.items}
        error={review.error}
        initialState={review.state}
        open={review.open}
        onApply={(changes) => void review.apply(changes)}
        onClose={review.close}
        onDiscard={review.discard}
        onReviewStateChange={review.synchronize}
      />
    </div>
  );
}
