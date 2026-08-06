import { useCallback, useEffect, useMemo, useState } from "react";
import type { TargetModule } from "../shared/target-module";
import type { DesignSpaceDevice, SourceApprovalEvidence, SourceWorkspaceLayer } from "../shared/source-workspace";
import type { SignedSourceComponent } from "../shared/contracts";
import { runLocalOperation } from "./api";
import type { SourceComponentOpenRequest, SourceWorkspaceSelection } from "./source/SourceWorkspaceSidebar";
import { findSourceTreeLayer, initialSourceTreeSelection, sourceTargetRootNodeId, sourceTreeNodes } from "./source/source-workspace-tree";
import { initialFocusOccurrence, sourceFocusGraph, type SourceOccurrence } from "./source/source-focus-tree";
import { applySourceSlotCandidate, sourceSlotCandidates, type SourceComponentCandidate } from "./source/source-slot-composition";
import { useSourceDraftAnalysis } from "./source/useSourceDraftAnalysis";
import { useSourceFileEditor } from "./source/useSourceFileEditor";
import { useSourceLayerClassEditor } from "./source/useSourceLayerClassEditor";
import { selectedSourceLibraryComponent } from "./source/SourceLibraryWorkspace";
import { findSourceLibraryLayerOwner } from "./source/source-library-selection";
import { useSourceComponentCreation } from "./source/useSourceComponentCreation";
import { useSourceLibraryRuntime } from "./source/useSourceLibraryRuntime";
import { createLocalSourceDraftWorkspace } from "./source/source-draft-local";
import type { SourceDraftLocation } from "./source/source-draft-workspace";
import { useSourceDraftFile, useSourceDraftWorkspace } from "./source/useSourceDraftWorkspace";
import { useSourceChangeReview } from "./source/useSourceChangeReview";
import { findSourceSlotLayer } from "./source/SourceWorkspaceDetails";
import { sourceCanvasVisualLayer } from "./source/source-canvas-selection";
import type { SourceLayerMetrics } from "./source/source-layer-design";
import { useSourceWorkspaceUiState } from "./source/useSourceWorkspaceUiState";
import { useSourceWorkspaceFiles } from "./source/useSourceWorkspaceFiles";
import { sourceEntrySlotLayers } from "./source/source-entry-layers";
import { sourceSlotNavigationTarget, sourceSlotScope } from "./source/source-slot-navigation";
import { useSourceDraftSynchronization } from "./source/useSourceDraftSynchronization";
import { useSourceDesignGeneration } from "./source/useSourceDesignGeneration";
import { useSynchronizedSourceDesignSelection } from "./source/useSynchronizedSourceDesignSelection";
import {
  findSourceComponentOccurrence,
  sourceComponentSelection,
  useSourceWorkspaceControl,
} from "./source/use-source-workspace-control";
import { sourceCanvasAncestry } from "./source/source-canvas-ancestry";
import { sourceCanvasApprovalStatus } from "./source/SourceApprovalStatus";
import { approvedSourceComponentCount, sourceComponentReviewSequence } from "./source/source-component-review";
import type { SourceCodeAnnotation, SourceCodeSelectionContext } from "./source/source-feedback";
import { sourceImportedComponentTarget } from "./source/source-import-component-target";
import { createSourceBoxModelPreviewStore } from "./source/source-box-model-preview";
import { useSourceTargetDeviceController } from "./source/useSourceTargetDeviceController";
import { sourceDeviceTransition, sourceTargetScopedInteractionReset } from "./source/source-workspace-transition";

export function useSourceWorkspaceController({ nestedPreview = false, target }: { nestedPreview?: boolean; target: TargetModule }) {
  const registeredWorkspace = target.sourceWorkspace;
  if (!registeredWorkspace) return null;
  const boxModelPreviewStore = useMemo(createSourceBoxModelPreviewStore, []);
  const {
    defaultSelection,
    initial,
    initialFocusId,
    initialGraph,
    registeredNodes,
    selectedTarget,
    selectTarget,
    targets: manifestTargets,
  } = useSourceTargetDeviceController(registeredWorkspace, target.project.id);
  const {
    activity, appCodeHeight, appCodeOpen, canvasMode, codeDocument, designCases, designRootId, designSelection,
    focusId, mobilePane, previewRuntime, previewSelection,
    selectedLibraryComponent, selectedLibraryLayerId, selectedProjectFileId,
    selection, workspaceMode, workspaceSurface, setActivity, setAppCodeHeight, setAppCodeOpen, setCanvasMode, setCodeDocument,
    setDesignCases, setDesignRootId, setDesignSelection, setFocusId, setMobilePane, setPreviewRuntime,
    setPreviewSelection, setSelectedLibraryComponent, setSelectedLibraryLayerId,
    setSelectedProjectFileId, setSelection, setWorkspaceMode, setWorkspaceSurface,
  } = useSourceWorkspaceUiState({
    defaultFocusId: initialFocusId,
    defaultLibraryComponent: registeredWorkspace.library?.components[0]?.name,
    defaultSelection,
    fileIds: new Set([
      ...target.files.map((file) => file.id),
      ...(target.sourceLibrary?.development?.files ?? []).map((file) => file.id),
    ]),
    focusIds: new Set(initialGraph.occurrences.keys()),
    nodeIds: new Set(registeredNodes.map((node) => node.id)),
    projectId: target.project.id,
    targetId: selectedTarget?.id,
  });
  const [draftSelection, setDraftSelection] = useState<{ start: number; end: number }>();
  const [codeContexts, setCodeContexts] = useState<readonly SourceCodeSelectionContext[]>([]);
  const [codeAnnotations, setCodeAnnotations] = useState<readonly SourceCodeAnnotation[]>([]);
  const [hoveredTreeSelection, setHoveredTreeSelection] = useState<SourceWorkspaceSelection>();
  const [selectedLayerMetrics, setSelectedLayerMetrics] = useState<SourceLayerMetrics>();
  const [canvasRevealRequest, setCanvasRevealRequest] = useState<number>();
  const [approvalReview, setApprovalReview] = useState(false);
  const [approvalEvidence, setApprovalEvidence] = useState<SourceApprovalEvidence>();
  const [signingEntryId, setSigningEntryId] = useState<string>();
  const [approvalSigningError, setApprovalSigningError] = useState<string>();
  const [draftWorkspace] = useState(createLocalSourceDraftWorkspace);
  const { state: draftWorkspaceState } = useSourceDraftWorkspace(draftWorkspace);
  const libraryRootId = `${target.project.id}:${target.sourceLibrary?.packageName ?? "library-development"}`;
  const componentCreation = useSourceComponentCreation();
  const requestedDevice = selection?.device ?? initial?.device ?? "desktop";
  useEffect(() => {
    if (!selectedTarget || selectedTarget.devices.some((candidate) => candidate.id === requestedDevice)) return;
    if (!defaultSelection) return;
    setSelection(defaultSelection);
    setPreviewSelection(defaultSelection);
    setDesignSelection(undefined);
    setFocusId(defaultSelection.occurrenceId);
    setDesignRootId(undefined);
  }, [defaultSelection, requestedDevice, selectedTarget]);
  const registeredRootNodeId = sourceTargetRootNodeId(registeredNodes, selectedTarget, requestedDevice);
  const registeredGraph = useMemo(
    () => sourceFocusGraph(registeredNodes, requestedDevice, registeredRootNodeId ? [registeredRootNodeId] : undefined),
    [registeredNodes, registeredRootNodeId, requestedDevice],
  );
  const registeredDesignOccurrence = workspaceMode === "design"
    ? registeredGraph.occurrences.get(designRootId ?? focusId ?? "")
    : undefined;
  const registeredLayerSourceNode = selection?.kind === "html"
    ? registeredNodes.find((candidate) => candidate.id === selection.sourceNodeId)
    : undefined;
  const registeredSourceNode = registeredLayerSourceNode ?? registeredDesignOccurrence?.node
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
  const nodes = useMemo(() => sourceTreeNodes(workspace, selectedTarget?.id), [selectedTarget?.id, workspace]);
  const rootNodeId = sourceTargetRootNodeId(nodes, selectedTarget, requestedDevice);
  const graph = useMemo(
    () => sourceFocusGraph(nodes, requestedDevice, rootNodeId ? [rootNodeId] : undefined),
    [nodes, requestedDevice, rootNodeId],
  );
  const targetEntries = useMemo(
    () => selectedTarget ? workspace.entries.filter((candidate) => candidate.targetId === selectedTarget.id) : workspace.entries,
    [selectedTarget, workspace.entries],
  );
  const activeRuntime = selectedTarget?.runtime ?? workspace.runtime;
  const activeStyles = selectedTarget?.styles ?? workspace.styles;
  const componentReviewSequence = useMemo(() => sourceComponentReviewSequence(graph), [graph]);
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
  const selectedLayerSourceNode = selection?.kind === "html"
    ? nodes.find((candidate) => candidate.id === selection.sourceNodeId)
    : undefined;
  const sourceNode = selectedLayerSourceNode ?? (workspaceMode === "design"
    ? focusedOccurrence?.node ?? selectedNode
    : nodes.find((candidate) => candidate.id === (selection?.sourceNodeId ?? selectedNode?.id)) ?? selectedNode);
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
  const effectiveApprovals = approvalEvidence ?? workspace.approvals;
  const workspaceWithApprovals = useMemo(
    () => effectiveApprovals === workspace.approvals ? workspace : { ...workspace, approvals: effectiveApprovals },
    [effectiveApprovals, workspace],
  );
  const componentReviewIndex = previewEntry
    ? componentReviewSequence.findIndex(({ entry: candidate }) => candidate.id === previewEntry.id)
    : -1;
  const approvedComponentCount = approvedSourceComponentCount(effectiveApprovals, componentReviewSequence);
  const previewSlotLayers = useMemo(
    () => sourceEntrySlotLayers(previewEntry),
    [previewEntry],
  );
  const externalInspectorEntry = selection?.kind === "component"
    && selectedOccurrence?.entry
    && previewEntry
    && selectedOccurrence.entry.fileId !== previewEntry.fileId
    ? selectedOccurrence.entry
    : undefined;
  const selectedAppDesignCase = previewEntry?.design
    ? designCases[previewEntry.design.fileId]
    : undefined;
  const selectedLayer = previewSlotLayers.find((slot) => slot.id === selection?.layerId)
    ?? findSourceTreeLayer(entry?.layers, selection?.layerId)
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
  const selectedCanvasSlot = selection?.kind === "slot" && selectedLayer?.kind === "slot"
    ? selectedLayer
    : undefined;
  const previewSlotNavigation = useMemo(() => previewSlotLayers.map((slot) => {
    const target = sourceSlotNavigationTarget(graph, resolvedFocusId, slot);
    return { id: slot.id, scope: sourceSlotScope(slot, target), target };
  }), [graph, previewSlotLayers, resolvedFocusId]);
  const selectedSlotTarget = previewSlotNavigation.find((slot) => slot.id === selectedCanvasSlot?.id)?.target;
  const previewSlotScopes = useMemo(
    () => Object.fromEntries(previewSlotNavigation.map((slot) => [slot.id, slot.scope])),
    [previewSlotNavigation],
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
  const canvasAncestry = useMemo(() => {
    const items = sourceCanvasAncestry(
      graph,
      selectedOccurrence?.id ?? resolvedFocusId,
      selection?.kind === "component" ? undefined : selectedLayer,
    );
    if (!approvalReview) return items;
    return items.map((item) => {
      if (item.kind !== "component") return item;
      const entryId = graph.occurrences.get(item.id)?.entry?.id;
      return entryId
        ? { ...item, approval: sourceCanvasApprovalStatus(effectiveApprovals, entryId) }
        : item;
    });
  }, [approvalReview, effectiveApprovals, graph, resolvedFocusId, selectedLayer, selectedOccurrence?.id, selection?.kind]);
  const styleEditor = useSourceLayerClassEditor({
    connected: activeRuntime !== "react-native",
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
  const libraryImportedComponentTarget = useMemo(() => sourceImportedComponentTarget({
    currentEntry: libraryEntry,
    entries: effectiveLibraryCatalog?.development?.entries ?? [],
    layer: libraryVisualLayer,
    source: libraryEditor.draft || libraryEditor.snapshot?.source || "",
  }), [
    effectiveLibraryCatalog?.development?.entries,
    libraryEditor.draft,
    libraryEditor.snapshot?.source,
    libraryEntry,
    libraryVisualLayer,
  ]);
  const libraryStyleEditor = useSourceLayerClassEditor({
    connected: libraryDraftAnalysis.workspace.runtime === "react",
    editor: libraryEditor,
    layer: libraryVisualLayer,
    ready: libraryDraftAnalysis.ready,
    scope: "library-development",
  });
  const fileScope = workspaceSurface === "library" ? "library-development" : "app";
  const workspaceFiles = useSourceWorkspaceFiles(fileScope, target.files, target.sourceLibrary?.development);
  const selectedProjectFile = workspaceFiles.find((file) => file.id === selectedProjectFileId && file.kind === "file");
  const fileEditor = useSourceFileEditor(selectedProjectFile?.id, fileScope);
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
  const connected = activeRuntime !== "react-native";

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
    setApprovalSigningError(undefined);
    setWorkspaceSurface("app");
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
      if (workspaceMode === "preview") setPreviewSelection(selection);
      setWorkspaceMode("design");
      setPreviewRuntime("static");
      setSelection(request.selection);
      setDesignSelection(request.selection);
      setWorkspaceSurface("app");
      setActivity("app");
      setMobilePane("canvas");
    }
    setCodeDocument("source");
    setAppCodeOpen(true);
    setDraftSelection(request.source);
  };
  const openPreviewPage = () => {
    if (workspaceMode === "design") setDesignSelection(selection);
    setWorkspaceMode("preview");
    setPreviewRuntime("static");
    setCanvasRevealRequest(undefined);
    setSelection(previewSelection ?? defaultSelection);
    setWorkspaceSurface("app");
    setActivity("app");
    setMobilePane("canvas");
  };
  const openDesignPage = () => {
    const occurrenceId = designRootId && graph.occurrences.has(designRootId) ? designRootId : appRootId;
    const occurrence = occurrenceId ? graph.occurrences.get(occurrenceId) : undefined;
    const next = designSelection ?? (occurrence ? sourceComponentSelection(occurrence, requestedDevice) : defaultSelection);
    if (occurrenceId && next) openDesign(occurrenceId, next);
  };
  const openAppDesign = () => {
    const occurrence = appRootId ? graph.occurrences.get(appRootId) : undefined;
    if (appRootId && occurrence) openDesign(appRootId, sourceComponentSelection(occurrence, requestedDevice));
  };
  const openDesignArea = (next: "files" | "library") => {
    if (workspaceMode === "preview") setPreviewSelection(selection);
    setWorkspaceMode("design");
    setPreviewRuntime("static");
    if (next === "library") setWorkspaceSurface("library");
    setActivity(next);
    setMobilePane("documents");
  };
  const revealSourceFile = (fileId: string, surface: "app" | "library") => {
    if (workspaceMode === "preview") setPreviewSelection(selection);
    setWorkspaceMode("design");
    setPreviewRuntime("static");
    setWorkspaceSurface(surface);
    setSelectedProjectFileId(fileId);
    setActivity("files");
    setMobilePane("documents");
  };
  const openWorkspaceArea = (next: "app" | "library") => {
    if (next === "app") {
      openAppDesign();
      return;
    }
    libraryRuntime.setCatalogKind("library");
    openDesignArea("library");
  };
  const nextReviewItem = componentReviewIndex >= 0
    ? componentReviewSequence[componentReviewIndex + 1]
    : componentReviewSequence[0];
  const openNextReviewComponent = nextReviewItem ? () => {
    openDesign(
      nextReviewItem.occurrence.id,
      sourceComponentSelection(nextReviewItem.occurrence, requestedDevice),
    );
  } : undefined;
  const signCurrentComponent = async () => {
    if (!previewEntry || signingEntryId) return;
    setSigningEntryId(previewEntry.id);
    setApprovalSigningError(undefined);
    try {
      const result = await runLocalOperation<SignedSourceComponent>({
        type: "sign-source-component",
        entryId: previewEntry.id,
      });
      setApprovalEvidence(result.approvals);
      setApprovalReview(true);
    } catch (error) {
      setApprovalSigningError(error instanceof Error ? error.message : "This component could not be signed.");
    } finally {
      setSigningEntryId(undefined);
    }
  };
  const clearTargetScopedInteraction = () => {
    const reset = sourceTargetScopedInteractionReset();
    setHoveredTreeSelection(reset.hoveredSelection);
    setSelectedLayerMetrics(reset.layerMetrics);
    setCanvasRevealRequest(reset.canvasRevealRequest);
    setCodeContexts(reset.codeContexts);
    setCodeAnnotations(reset.codeAnnotations);
  };
  const changeAppDevice = (device: DesignSpaceDevice) => {
    const next = sourceDeviceTransition(nodes, selectedTarget, device, selectedNode?.id);
    if (!next) return;
    setSelection(next.selection);
    if (workspaceMode === "preview") setPreviewSelection(next.selection);
    else setDesignSelection(next.selection);
    setFocusId(next.focusId);
    if (workspaceMode === "design") setDesignRootId(next.focusId);
    setDraftSelection(undefined);
    clearTargetScopedInteraction();
  };
  const changeTarget = (nextTargetId: string) => {
    const next = selectTarget(nextTargetId);
    if (!next) return;
    setSelection(next.selection);
    setPreviewSelection(next.selection);
    setDesignSelection(undefined);
    setFocusId(next.focusId);
    setDesignRootId(undefined);
    setPreviewRuntime("static");
    setWorkspaceSurface("app");
    setActivity("app");
    setDraftSelection(undefined);
    clearTargetScopedInteraction();
  };

  return {
    activeCodeDocument, activeEditable, activeEditor, activeLibraryCodeDocument, activeRuntime, activeStyles,
    activity, appCodeHeight, appCodeOpen, appRootId, applySlot, approvalReview, approvalSigningError,
    approvedComponentCount, baseLibraryEditEntry, boxModelPreviewStore, canvasAncestry,
    canvasMode, canvasRevealRequest, changeAppDevice, changeTarget, codeAnnotations,
    codeDocument, codeContexts, codeEditor, componentCreation,
    componentReviewIndex, componentReviewSequence, currentDraftChanges, designCases,
    designGeneration, draftAnalysis, draftSelection, effectiveApprovals, effectiveLibraryCatalog,
    editor, entry, externalInspectorEntry, fileEditor, fileScope, focusedOccurrence, graph,
    hoveredTreeSelection, hoveredVisualLayer, inspectorEntry, inspectorSourceOwnerEntry,
    libraryCodeEditor, libraryDraftAnalysis, libraryEditor, libraryEntry,
    libraryImportedComponentTarget, libraryPreviewEntry, libraryRuntime, librarySelectedLayer,
    libraryStyleEditor, libraryVisualLayer, manifestTargets, mobilePane, nestedPreview, nodes,
    openAppDesign, openComponent, openDesign, openDesignArea, openDesignPage,
    openNextReviewComponent, openPreviewPage, openWorkspaceArea, parentDesignOccurrence,
    prepareSlotEdit, previewEntry, previewRuntime, previewSlotLayers, previewSlotScopes, requestedDevice,
    resolvedFocusId, revealSourceFile, review, selectedAppDesignCase, selectedCanvasSlot,
    selectedLabel, selectedLayer, selectedLayerMetrics, selectedLibraryComponent,
    selectedLibraryDesignCase, selectedLibraryLayerId, selectedNode, selectedOccurrence,
    selectedProjectFile, selectedProjectFileId, selectedSlotTarget, selectedTarget,
    selection, signingEntryId, signCurrentComponent, slotEditorReady, styleEditor, target,
    targetEntries, visualLayer, workspace, workspaceFiles, workspaceMode, workspaceSurface,
    workspaceWithApprovals,
    setActivity, setAppCodeHeight, setAppCodeOpen, setApprovalReview, setCanvasMode, setCanvasRevealRequest,
    setCodeAnnotations, setCodeContexts, setCodeDocument, setDesignCases, setDesignRootId,
    setDesignSelection, setDraftSelection, setHoveredTreeSelection, setMobilePane,
    setPreviewRuntime, setPreviewSelection, setSelectedLayerMetrics,
    setSelectedLibraryComponent, setSelectedLibraryLayerId, setSelectedProjectFileId,
    setSelection, setWorkspaceMode, setWorkspaceSurface,
  } as const;
}
