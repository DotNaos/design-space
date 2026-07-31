import { useCallback, useMemo, useState } from "react";
import type { TargetModule } from "../shared/target-module";
import type { SourceWorkspaceLayer } from "../shared/source-workspace";
import { ProjectFileBrowser } from "./documents/ProjectFileBrowser";
import { ResizableWorkspacePanels } from "./shell/ResizableWorkspacePanels";
import { WorkspaceActivityRail } from "./shell/WorkspaceActivityRail";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { SourceComponentInspector } from "./source/SourceComponentInspector";
import { SourceCodeCanvas } from "./source/SourceCodeCanvas";
import { SourceAppCanvas } from "./source/SourceAppCanvas";
import {
  SourceWorkspaceSidebar,
  type SourceComponentOpenRequest,
  type SourceWorkspaceSelection,
} from "./source/SourceWorkspaceSidebar";
import { findSourceTreeLayer, initialSourceTreeSelection, sourceTreeNodes } from "./source/source-workspace-tree";
import { initialFocusOccurrence, sourceFocusGraph, type SourceOccurrence } from "./source/source-focus-tree";
import { applySourceSlotCandidate, sourceSlotCandidates, type SourceComponentCandidate } from "./source/source-slot-composition";
import { useSourceDraftAnalysis } from "./source/useSourceDraftAnalysis";
import { useSourceFileEditor } from "./source/useSourceFileEditor";
import { useSourceLayerClassEditor } from "./source/useSourceLayerClassEditor";
import { DiffSheet } from "./components/DiffSheet/DiffSheet";
import { selectedSourceLibraryComponent, SourceLibraryCanvas } from "./source/SourceLibraryWorkspace";
import { findSourceLibraryLayerOwner } from "./source/source-library-selection";
import { SourceLibraryExplorer } from "./source/SourceLibraryExplorer";
import { SourceComponentCreateSheet } from "./source/SourceComponentCreateSheet";
import { useSourceComponentCreation } from "./source/useSourceComponentCreation";
import { useSourceLibraryRuntime } from "./source/useSourceLibraryRuntime";
import { SourceChangeReviewModal } from "./source/SourceChangeReviewModal";
import { createLocalSourceDraftWorkspace } from "./source/source-draft-local";
import type { SourceDraftLocation } from "./source/source-draft-workspace";
import { useSourceDraftFile, useSourceDraftWorkspace } from "./source/useSourceDraftWorkspace";
import { useSourceChangeReview } from "./source/useSourceChangeReview";
import { CodeDocumentSwitch, FileEvidencePanel, findSourceSlotLayer } from "./source/SourceWorkspaceDetails";
import { sourceCanvasSelection, sourceCanvasSelectionOccurrence, sourceCanvasVisualLayer } from "./source/source-canvas-selection";
import type { SourceLayerMetrics } from "./source/source-layer-design";
import { useSourceWorkspaceUiState } from "./source/useSourceWorkspaceUiState";
import { sourceEntrySlotLayers } from "./source/source-entry-layers";
import { SourceWorkspaceCodeOverlay } from "./source/SourceWorkspaceCodeOverlay";
import { useSourceDraftSynchronization } from "./source/useSourceDraftSynchronization";
import { useSourceDesignGeneration } from "./source/useSourceDesignGeneration";
import { useSynchronizedSourceDesignSelection } from "./source/useSynchronizedSourceDesignSelection";
import { SourceWorkspaceMobile } from "./source/SourceWorkspaceMobile";
import { sourceSelectionAtOffset } from "./source/source-code-selection";
import {
  findSourceComponentOccurrence,
  sourceComponentSelection,
  useSourceWorkspaceControl,
} from "./source/use-source-workspace-control";

export function SourceWorkspace({ nestedPreview = false, target }: { nestedPreview?: boolean; target: TargetModule }) {
  const registeredWorkspace = target.sourceWorkspace;
  if (!registeredWorkspace) return null;
  const registeredNodes = useMemo(() => sourceTreeNodes(registeredWorkspace), [registeredWorkspace]);
  const initial = initialSourceTreeSelection(registeredNodes);
  const initialGraph = useMemo(() => sourceFocusGraph(registeredNodes, initial?.device ?? "desktop"), [initial?.device, registeredNodes]);
  const initialFocusId = initialFocusOccurrence(initialGraph);
  const initialFocus = initialFocusId ? initialGraph.occurrences.get(initialFocusId) : undefined;
  const defaultSelection: SourceWorkspaceSelection | undefined = initial && initialFocusId ? {
    ...initial,
    nodeId: initialFocus?.node.id ?? initial.nodeId,
    occurrenceId: initialFocusId,
    kind: "component",
  } : initial;
  const {
    activity, appCodeHeight, appCodeOpen, canvasMode, codeDocument, designCases, designRootId, designSelection,
    focusId, mobilePane, previewRuntime, previewSelection,
    selectedLibraryComponent, selectedLibraryLayerId, selectedProjectFileId,
    selection, workspaceMode, setActivity, setAppCodeHeight, setAppCodeOpen, setCanvasMode, setCodeDocument,
    setDesignCases, setDesignRootId, setDesignSelection, setFocusId, setMobilePane, setPreviewRuntime,
    setPreviewSelection, setSelectedLibraryComponent, setSelectedLibraryLayerId,
    setSelectedProjectFileId, setSelection, setWorkspaceMode,
  } = useSourceWorkspaceUiState({
    defaultFocusId: initialFocusId,
    defaultLibraryComponent: registeredWorkspace.library?.components[0]?.name,
    defaultSelection,
    fileIds: new Set(target.files.map((file) => file.id)),
    focusIds: new Set(initialGraph.occurrences.keys()),
    nodeIds: new Set(registeredNodes.map((node) => node.id)),
    projectId: target.project.id,
  });
  const [draftSelection, setDraftSelection] = useState<{ start: number; end: number }>();
  const [hoveredTreeSelection, setHoveredTreeSelection] = useState<SourceWorkspaceSelection>();
  const [selectedLayerMetrics, setSelectedLayerMetrics] = useState<SourceLayerMetrics>();
  const [canvasRevealRequest, setCanvasRevealRequest] = useState<number>();
  const [draftWorkspace] = useState(createLocalSourceDraftWorkspace);
  const { state: draftWorkspaceState } = useSourceDraftWorkspace(draftWorkspace);
  const libraryRootId = `${target.project.id}:${target.sourceLibrary?.packageName ?? "library-development"}`;
  const componentCreation = useSourceComponentCreation();
  const requestedDevice = selection?.device ?? initial?.device ?? "desktop";
  const registeredGraph = useMemo(
    () => sourceFocusGraph(registeredNodes, requestedDevice),
    [registeredNodes, requestedDevice],
  );
  const registeredDesignOccurrence = workspaceMode === "design"
    ? registeredGraph.occurrences.get(designRootId ?? focusId ?? "")
    : undefined;
  const registeredSourceNode = registeredDesignOccurrence?.node
    ?? registeredNodes.find((candidate) => candidate.id === (selection?.sourceNodeId ?? selection?.nodeId))
    ?? registeredNodes[0];
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
  const appRootId = graph.roots[0] ?? initialFocusOccurrence(graph);
  const requestedDesignRootId = designRootId ?? focusId;
  const resolvedFocusId = workspaceMode === "design" && graph.occurrences.has(requestedDesignRootId ?? "")
    ? requestedDesignRootId
    : appRootId;
  const focusedOccurrence = useSynchronizedSourceDesignSelection({
    device: requestedDevice,
    focusId: resolvedFocusId,
    graph,
    mode: workspaceMode,
    selection,
    setDesignSelection,
    setSelection,
  });
  const parentDesignOccurrence = focusedOccurrence?.parentId
    ? graph.occurrences.get(focusedOccurrence.parentId)
    : undefined;
  const selectedOccurrence = selection?.occurrenceId ? graph.occurrences.get(selection.occurrenceId) : undefined;
  const selectedNode = nodes.find((candidate) => candidate.id === selection?.nodeId) ?? focusedOccurrence?.node ?? nodes[0];
  const sourceNode = workspaceMode === "design"
    ? focusedOccurrence?.node ?? selectedNode
    : nodes.find((candidate) => candidate.id === (selection?.sourceNodeId ?? selectedNode?.id)) ?? selectedNode;
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
  const externalInspectorEntry = selection?.kind === "component"
    && selectedOccurrence?.entry
    && previewEntry
    && selectedOccurrence.entry.fileId !== previewEntry.fileId
    ? selectedOccurrence.entry
    : undefined;
  const selectedAppDesignCase = previewEntry?.design
    ? designCases[previewEntry.design.fileId]
    : undefined;
  const selectedLayer = findSourceTreeLayer(entry?.layers, selection?.layerId)
    ?? (selection?.kind === "slot" && selection.slotName
      ? findSourceSlotLayer(entry?.layers, selection.slotName)
      : undefined);
  const visualLayer = sourceCanvasVisualLayer(previewEntry, selectedLayer);
  const hoveredSourceNode = nodes.find((candidate) => (
    candidate.id === (hoveredTreeSelection?.sourceNodeId ?? hoveredTreeSelection?.nodeId)
  ));
  const hoveredSourceEntry = hoveredSourceNode?.implementations[requestedDevice].entry;
  const hoveredSelectedLayer = findSourceTreeLayer(hoveredSourceEntry?.layers, hoveredTreeSelection?.layerId)
    ?? (hoveredTreeSelection?.kind === "slot" && hoveredTreeSelection.slotName
      ? findSourceSlotLayer(hoveredSourceEntry?.layers, hoveredTreeSelection.slotName)
      : undefined);
  const hoveredVisualLayer = hoveredTreeSelection
    ? hoveredSelectedLayer ?? (
      hoveredTreeSelection.occurrenceId === resolvedFocusId
        ? sourceCanvasVisualLayer(previewEntry, undefined)
        : undefined
    )
    : undefined;
  const appReviewLayer = findSourceTreeLayer(registeredCodeEntry?.layers, visualLayer?.id);
  const previewSlotLayers = useMemo(
    () => sourceEntrySlotLayers(previewEntry),
    [previewEntry],
  );
  const inspectorSourceOwner = focusedOccurrence?.usageOwnerId
    ? nodes.find((node) => node.id === focusedOccurrence.usageOwnerId)
    : undefined;
  const inspectorSourceOwnerEntry = inspectorSourceOwner?.implementations[requestedDevice].entry;
  const slotEditorReady = Boolean(entry && editor.snapshot?.fileId === entry.fileId && !editor.loading);
  const selectedLabel = selectedLayer?.kind === "html"
    ? `<${selectedLayer.label}>`
    : selectedLayer?.kind === "slot"
      ? `slot:${selectedLayer.label}`
      : selectedOccurrence?.node.label ?? focusedOccurrence?.node.label ?? selectedNode?.label;
  const styleEditor = useSourceLayerClassEditor({
    connected: workspace.runtime === "react",
    editor,
    layer: visualLayer,
    ready: draftAnalysis.ready,
    scope: "app",
  });
  const baseLibraryComponent = selectedSourceLibraryComponent({
    appWorkspace: workspace,
    catalog: target.sourceLibrary,
    catalogKind: libraryRuntime.catalogKind,
    device: requestedDevice,
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
    appWorkspace: workspace,
    catalog: effectiveLibraryCatalog,
    catalogKind: libraryRuntime.catalogKind,
    device: requestedDevice,
    library: workspace.library,
    mode: libraryRuntime.mode,
    selected: selectedLibraryComponent,
  });
  const libraryPreviewEntry = libraryComponent?.entry;
  const selectedLibraryDesignCase = libraryPreviewEntry?.design
    ? designCases[libraryPreviewEntry.design.fileId]
    : undefined;
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
  const activeLibraryCodeDocument = codeDocument === "design" && libraryEntry?.design ? "design" : "source";
  const libraryCodeEditor = activeLibraryCodeDocument === "design" ? libraryDesignEditor : libraryEditor;
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
      ? appCodeOpen ? libraryCodeEditor : libraryEditor
      : appCodeOpen ? codeEditor : editor;
  const activeEditable = activity === "files"
    ? Boolean(selectedProjectFile?.editable)
    : activity === "app"
      ? activeCodeDocument === "design" && appCodeOpen
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

  useSourceDraftSynchronization({
    analysis: draftAnalysis, draftWorkspace, editor, location: editorLocation,
    previewEntry, reviewLayer: appReviewLayer, styleEditor,
  });
  useSourceDraftSynchronization({
    analysis: libraryDraftAnalysis, draftWorkspace, editor: libraryEditor,
    location: libraryEditorLocation, previewEntry: libraryPreviewEntry,
    reviewLayer: libraryReviewLayer, styleEditor: libraryStyleEditor,
  });

  const designGeneration = useSourceDesignGeneration({
    onAppGenerated: () => {
      setCodeDocument("design");
      setAppCodeOpen(true);
    },
  });

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
  const openDesign = useCallback((occurrenceId: string, next: SourceWorkspaceSelection) => {
    if (workspaceMode === "preview") setPreviewSelection(selection);
    setWorkspaceMode("design");
    setPreviewRuntime("static");
    setDesignRootId(occurrenceId);
    setDesignSelection(next);
    setFocusId(occurrenceId);
    setSelection(next);
    setCanvasRevealRequest(undefined);
    setDraftSelection(undefined);
    setActivity("app");
    setMobilePane("canvas");
  }, [selection, workspaceMode]);
  const isolateComponent = useCallback((name: string) => {
    const occurrence = findSourceComponentOccurrence(graph, name);
    if (!occurrence) return;
    openDesign(occurrence.id, sourceComponentSelection(occurrence, requestedDevice));
  }, [graph, openDesign, requestedDevice]);
  useSourceWorkspaceControl(isolateComponent);
  const openComponent = (request: SourceComponentOpenRequest) => {
    if (request.designOccurrenceId) {
      openDesign(request.designOccurrenceId, request.selection);
    } else {
      setSelection(request.selection);
      if (workspaceMode === "preview") setPreviewSelection(request.selection);
      else setDesignSelection(request.selection);
      setActivity("app");
      setMobilePane("canvas");
    }
    setCodeDocument("source");
    setAppCodeOpen(true);
    setDraftSelection(request.source);
  };
  const returnToPreview = () => {
    setDesignSelection(selection);
    setWorkspaceMode("preview");
    setPreviewRuntime("static");
    setCanvasRevealRequest(undefined);
    setSelection(previewSelection ?? defaultSelection);
  };
  const appSidebar = (
    <SourceWorkspaceSidebar
      className="flex h-full w-full border-r-0"
      designNavigation={workspaceMode === "design" ? {
        onExit: returnToPreview,
        ...(parentDesignOccurrence ? {
          parentLabel: parentDesignOccurrence.node.label,
          onOpenParent: () => openDesign(parentDesignOccurrence.id, {
            nodeId: parentDesignOccurrence.node.id,
            sourceNodeId: parentDesignOccurrence.node.id,
            device: requestedDevice,
            occurrenceId: parentDesignOccurrence.id,
            kind: "component",
          }),
        } : {}),
      } : undefined}
      focusId={resolvedFocusId}
      selected={selection}
      treeStateKey={`${target.project.id}:app:${requestedDevice}`}
      workspace={workspace}
      editingSourceOwnerId={selection?.sourceNodeId}
      slotEditorReady={slotEditorReady}
      onCreateComponent={componentCreation.open}
      onFocus={(occurrenceId, next) => {
        openDesign(occurrenceId, next);
      }}
      onOpenComponent={openComponent}
      onHover={setHoveredTreeSelection}
      onApplySlot={applySlot}
      onPrepareSlotEdit={prepareSlotEdit}
      onSelect={(next) => {
        setSelection(next);
        if (workspaceMode === "preview") setPreviewSelection(next);
        else setDesignSelection(next);
        if (next.kind === "component") setCanvasRevealRequest((current) => (current ?? 0) + 1);
        setDraftSelection(undefined);
        setActivity("app");
        setMobilePane(next.kind === "slot" ? "tree" : "canvas");
      }}
    />
  );
  const appCodePanel = (
    <SourceCodeCanvas
      editable={activeCodeDocument === "design" ? Boolean(entry?.design) : Boolean(entry)}
      editor={codeEditor}
      label={activeCodeDocument === "design" ? `${entry?.label ?? selectedNode?.label ?? "Component"} design` : entry?.label ?? selectedNode?.label ?? "Source"}
      path={activeCodeDocument === "design" ? entry?.design?.relativePath : entry?.relativePath}
      selection={activeCodeDocument === "source" ? draftSelection ?? selectedLayer?.source ?? entry?.source : undefined}
      toolbar={entry?.design ? (
        <CodeDocumentSwitch value={activeCodeDocument} onChange={setCodeDocument} />
      ) : undefined}
      onCursorOffsetChange={activeCodeDocument === "source" && entry ? (offset) => {
        const next = sourceSelectionAtOffset({
          device: requestedDevice,
          entry,
          focusId: resolvedFocusId,
          graph,
          offset,
          selected: selection,
        });
        if (!next || sameSourceSelection(selection, next)) return;
        setSelection(next);
        if (workspaceMode === "preview") setPreviewSelection(next);
        else setDesignSelection(next);
        setDraftSelection(undefined);
      } : undefined}
    />
  );
  const libraryCodePanel = (
    <SourceCodeCanvas
      editable={libraryRuntime.mode === "development" && (
        activeLibraryCodeDocument === "design" ? Boolean(libraryEntry?.design) : Boolean(libraryEntry)
      )}
      editor={libraryCodeEditor}
      label={activeLibraryCodeDocument === "design"
        ? `${libraryEntry?.label ?? "Component"} design`
        : libraryEntry?.label ?? "Select a component"}
      path={activeLibraryCodeDocument === "design" ? libraryEntry?.design?.relativePath : libraryEntry?.relativePath}
      selection={activeLibraryCodeDocument === "source"
        ? librarySelectedLayer?.source ?? libraryEntry?.source
        : undefined}
      toolbar={libraryEntry?.design ? (
        <CodeDocumentSwitch value={activeLibraryCodeDocument} onChange={setCodeDocument} />
      ) : undefined}
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
    <SourceLibraryExplorer
      appWorkspace={workspace}
      catalog={effectiveLibraryCatalog}
      catalogKind={libraryRuntime.catalogKind}
      code={libraryCodePanel}
      codeHeight={appCodeHeight}
      codeOpen={appCodeOpen}
      device={requestedDevice}
      library={workspace.library}
      mode={libraryRuntime.mode}
      selected={selectedLibraryComponent}
      selectedLayer={librarySelectedLayer}
      treeStateKey={`${target.project.id}:library:${libraryRuntime.mode}:${requestedDevice}`}
      generateDesignError={designGeneration.error}
      generatingDesignEntryId={designGeneration.entryId}
      onDeviceChange={() => undefined}
      onGenerateDesign={(selectedEntry) => void designGeneration.generate(
        libraryRuntime.catalogKind === "app" ? "app" : "library-development",
        selectedEntry.id,
      )}
      onCatalogKindChange={(kind) => {
        libraryRuntime.setCatalogKind(kind);
        setSelectedLibraryComponent(undefined);
        setSelectedLibraryLayerId(undefined);
      }}
      onCodeHeightChange={setAppCodeHeight}
      onCodeOpenChange={setAppCodeOpen}
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
  const left = activity === "files"
    ? fileSidebar
    : activity === "library"
      ? librarySidebar
      : (
        <SourceWorkspaceCodeOverlay
          code={appCodePanel}
          height={appCodeHeight}
          open={appCodeOpen}
          onHeightChange={setAppCodeHeight}
          onOpenChange={setAppCodeOpen}
        >
          {appSidebar}
        </SourceWorkspaceCodeOverlay>
      );
  const canvas = activity === "library" ? (
    <SourceLibraryCanvas
      appWorkspace={workspace}
      catalog={effectiveLibraryCatalog}
      catalogKind={libraryRuntime.catalogKind}
      device={requestedDevice}
      library={workspace.library}
      mode={libraryRuntime.mode}
      selected={selectedLibraryComponent}
      selectedDesignCase={selectedLibraryDesignCase}
      selectedLayer={libraryVisualLayer}
      selectedClassCss={libraryStyleEditor.previewCss}
      selectedClassName={libraryStyleEditor.previewValue}
      selectedText={libraryStyleEditor.previewTextValue}
      previewMode={canvasMode}
      selectionMode={libraryRuntime.catalogKind === "library" && libraryRuntime.mode === "development"}
      generateDesignError={designGeneration.error}
      generatingDesignEntryId={designGeneration.entryId}
      onDeviceChange={(device) => setSelection((current) => current ? { ...current, device } : current)}
      onDesignCaseChange={(caseName) => libraryPreviewEntry?.design && setDesignCases((current) => ({
        ...current,
        [libraryPreviewEntry.design!.fileId]: caseName,
      }))}
      onGenerateDesign={(selectedEntry) => void designGeneration.generate(
        libraryRuntime.catalogKind === "app" ? "app" : "library-development",
        selectedEntry.id,
      )}
      onCatalogKindChange={(kind) => {
        libraryRuntime.setCatalogKind(kind);
        setSelectedLibraryComponent(undefined);
        setSelectedLibraryLayerId(undefined);
      }}
      onModeChange={libraryRuntime.setMode}
      onPreviewModeChange={setCanvasMode}
      onSelectLayer={(layerId) => {
        setSelectedLibraryLayerId(layerId);
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
    <SourceAppCanvas
      centerContent={workspaceMode === "design"}
      device={requestedDevice}
      draftSelection={draftSelection}
      editor={editor}
      entry={entry}
      entries={workspace.entries}
      generateDesignError={designGeneration.entryId === previewEntry?.id ? designGeneration.error : undefined}
      generatingDesign={designGeneration.entryId === previewEntry?.id}
      hoveredLayer={hoveredVisualLayer}
      hoveredLayerOccurrence={hoveredTreeSelection
        ? sourceCanvasSelectionOccurrence(graph, resolvedFocusId, hoveredTreeSelection)
        : undefined}
      mode={previewRuntime === "play" ? "play" : "design"}
      nestedPreview={nestedPreview}
      node={focusedOccurrence?.node ?? selectedNode}
      previewEntry={previewEntry}
      revealSelectedLayerKey={canvasRevealRequest}
      runtime={workspace.runtime}
      selectedClassCss={styleEditor.previewCss}
      selectedClassName={styleEditor.previewValue}
      selectedDesignCase={selectedAppDesignCase}
      selectedLayer={visualLayer}
      selectedLayerLabel={selectedLabel}
      selectedLayerOccurrence={sourceCanvasSelectionOccurrence(graph, resolvedFocusId, selection)}
      selectedText={styleEditor.previewTextValue}
      slotLayers={previewSlotLayers}
      styles={workspace.styles}
      workspaceMode={workspaceMode}
      onModeChange={(mode) => setPreviewRuntime(mode === "play" ? "play" : "static")}
      onDesignCaseChange={(caseName) => previewEntry?.design && setDesignCases((current) => ({
        ...current,
        [previewEntry.design!.fileId]: caseName,
      }))}
      onReturnToPreview={returnToPreview}
      onSelectedLayerMetrics={setSelectedLayerMetrics}
      onSelectLayer={(layerId, occurrence) => {
        const next = sourceCanvasSelection(graph, resolvedFocusId, layerId, requestedDevice, occurrence);
        if (!next) return;
        setSelection(next);
        if (workspaceMode === "preview") setPreviewSelection(next);
        else setDesignSelection(next);
        setDraftSelection(undefined);
      }}
      onOpenLayerOwner={(entryId, layerId, occurrenceIndex) => {
        const next = sourceCanvasSelection(graph, resolvedFocusId, layerId, requestedDevice, occurrenceIndex);
        const occurrence = next?.occurrenceId ? graph.occurrences.get(next.occurrenceId) : undefined;
        if (!occurrence || occurrence.entry?.id !== entryId) return;
        openDesign(occurrence.id, {
          nodeId: occurrence.node.id,
          sourceNodeId: occurrence.node.id,
          device: requestedDevice,
          occurrenceId: occurrence.id,
          kind: "component",
        });
      }}
      onGenerateDesign={previewEntry ? () => void designGeneration.generate("app", previewEntry.id) : undefined}
      onDeviceChange={(device) => selectedNode && setSelection((current) => ({
        ...(current ?? {}),
        nodeId: selectedNode.id,
        device,
      }))}
    />
  );
  const right = activity === "library"
    ? (
      <SourceComponentInspector
        className="flex h-full w-full border-l-0"
        entry={libraryEntry}
        layer={libraryVisualLayer}
        layerMetrics={selectedLayerMetrics}
        selectedDesignCase={selectedLibraryDesignCase}
        slotLayers={sourceEntrySlotLayers(libraryEntry)}
        styleEditor={libraryStyleEditor}
        onDesignCaseChange={(caseName) => libraryPreviewEntry?.design && setDesignCases((current) => ({
          ...current,
          [libraryPreviewEntry.design!.fileId]: caseName,
        }))}
      />
    )
    : activity === "files"
      ? <FileEvidencePanel editable={Boolean(selectedProjectFile?.editable)} label={selectedProjectFile?.label} />
      : (
        <SourceComponentInspector
          className="flex h-full w-full border-l-0"
          entry={inspectorEntry}
          layer={visualLayer}
          layerMetrics={selectedLayerMetrics}
          outsideCurrentFile={externalInspectorEntry && selectedOccurrence ? {
            currentRelativePath: previewEntry?.relativePath,
            onOpen: () => openComponent({
              selection: {
                nodeId: selectedOccurrence.node.id,
                sourceNodeId: selectedOccurrence.node.id,
                device: requestedDevice,
                occurrenceId: selectedOccurrence.id,
                kind: "component",
              },
              source: externalInspectorEntry.source,
              ...(externalInspectorEntry.design ? { designOccurrenceId: selectedOccurrence.id } : {}),
            }),
          } : undefined}
          selectedDesignCase={inspectorEntry?.design ? designCases[inspectorEntry.design.fileId] : undefined}
          slotLayers={sourceEntrySlotLayers(inspectorEntry)}
          slotEditorReady={selection?.sourceNodeId === focusedOccurrence?.usageOwnerId && slotEditorReady}
          styleEditor={styleEditor}
          candidatesForSlot={(slot) => sourceSlotCandidates(workspace, nodes, slot, requestedDevice, inspectorSourceOwnerEntry?.relativePath ?? entry?.relativePath ?? "")}
          onApplySlot={(slot, candidate, action) => focusedOccurrence && applySlot(slot, focusedOccurrence, candidate, action)}
          onDesignCaseChange={(caseName) => inspectorEntry?.design && setDesignCases((current) => ({
            ...current,
            [inspectorEntry.design!.fileId]: caseName,
          }))}
          onPrepareSlotEdit={() => focusedOccurrence && prepareSlotEdit(focusedOccurrence)}
        />
      );
  const mobile = (
    <SourceWorkspaceMobile
      activity={activity}
      appSidebar={appSidebar}
      canvas={canvas}
      left={left}
      mobilePane={mobilePane}
      right={right}
      onActivityChange={setActivity}
      onPaneChange={setMobilePane}
    />
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
          namespace={{
            projectId: target.project.id,
            documentId: activity === "library"
              ? `library:${selectedLibraryComponent ?? "empty"}:${requestedDevice}`
              : `${focusedOccurrence?.node.id ?? selectedNode?.id ?? "empty"}:${requestedDevice}`,
          }}
          left={{ label: "TypeScript app structure", content: left, defaultWidth: 300, minWidth: 260, maxWidth: 880 }}
          right={{ label: "Component properties", content: right, defaultWidth: 480, minWidth: 360, maxWidth: 760 }}
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

function sameSourceSelection(
  current: SourceWorkspaceSelection | undefined,
  next: SourceWorkspaceSelection,
): boolean {
  return current?.device === next.device
    && current.nodeId === next.nodeId
    && current.sourceNodeId === next.sourceNodeId
    && current.occurrenceId === next.occurrenceId
    && current.layerId === next.layerId
    && current.renderedLayerOccurrence === next.renderedLayerOccurrence
    && current.slotName === next.slotName
    && current.kind === next.kind;
}
