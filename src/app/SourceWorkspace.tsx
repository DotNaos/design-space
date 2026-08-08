import { useCallback, type ReactNode } from "react";
import type { TargetModule } from "../shared/target-module";
import { ProjectFileBrowser } from "./documents/ProjectFileBrowser";
import { LibraryFilesHeader } from "./documents/LibraryFilesHeader";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { SourceComponentInspector } from "./source/SourceComponentInspector";
import { SourceCodeCanvas, SourceCodeHeaderContent } from "./source/SourceCodeCanvas";
import { SourceAppCanvas } from "./source/SourceAppCanvas";
import {
  SourceWorkspaceSidebar,
  type SourceComponentOpenRequest,
  type SourceWorkspaceSelection,
} from "./source/SourceWorkspaceSidebar";
import { sourceSlotCandidates } from "./source/source-slot-composition";
import { DiffSheet } from "./components/DiffSheet/DiffSheet";
import { SourceLibraryCanvas } from "./source/SourceLibraryWorkspace";
import { SourceLibraryExplorer } from "./source/SourceLibraryExplorer";
import { SourceComponentCreateSheet } from "./source/SourceComponentCreateSheet";
import { SourceChangeReviewModal } from "./source/SourceChangeReviewModal";
import { CodeDocumentSwitch, FileEvidencePanel } from "./source/SourceWorkspaceDetails";
import { sourceCanvasSelection, sourceCanvasSelectionOccurrence } from "./source/source-canvas-selection";
import { sourceEntrySlotLayers } from "./source/source-entry-layers";
import { sourceSlotSelection } from "./source/source-slot-navigation";
import { SourceWorkspaceCodeOverlay } from "./source/SourceWorkspaceCodeOverlay";
import { SourceWorkspaceMobile } from "./source/SourceWorkspaceMobile";
import { sourceSelectionAtOffset } from "./source/source-code-selection";
import { sourceComponentSelection } from "./source/use-source-workspace-control";
import { SourceWorkspacePageNavigation } from "./source/SourceWorkspacePageNavigation";
import type { SourceCodeSelectionContext } from "./source/source-feedback";
import { SourceTargetPicker } from "./source/SourceTargetPicker";
import { SourceWorkspaceFrame } from "./source/SourceWorkspaceFrame";
import { useSourceWorkspaceController } from "./useSourceWorkspaceController";

export function SourceWorkspace(props: { nestedPreview?: boolean; target: TargetModule }) {
  const controller = useSourceWorkspaceController(props);
  if (!controller) return null;
  const {
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
    ignoredFileCount,
    showIgnoredFiles,
    selection, signingEntryId, signCurrentComponent, slotEditorReady, styleEditor, target,
    targetEntries, visualLayer, workspace, workspaceFiles, workspaceMode, workspaceSurface,
    workspaceWithApprovals,
    setActivity, setAppCodeHeight, setAppCodeOpen, setApprovalReview, setCanvasMode, setCanvasRevealRequest,
    setCodeAnnotations, setCodeContexts, setCodeDocument, setDesignCases, setDesignRootId,
    setDesignSelection, setDraftSelection, setHoveredTreeSelection, setMobilePane,
    setPreviewRuntime, setPreviewSelection, setSelectedLayerMetrics,
    setSelectedLibraryComponent, setSelectedLibraryLayerId, setSelectedProjectFileId,
    setSelection, setWorkspaceMode, setWorkspaceSurface,
    setShowIgnoredFiles,
  } = controller;
  const targetPicker = selectedTarget ? (
    <SourceTargetPicker
      targetId={selectedTarget.id}
      targets={manifestTargets}
      onChange={changeTarget}
    />
  ) : undefined;
  const renderAppSidebar = (headerLeading?: ReactNode) => (
    <SourceWorkspaceSidebar
      approvalReview={approvalReview}
      className="flex h-full w-full border-r-0"
      designNavigation={workspaceMode === "design" ? {
        onExit: openAppDesign,
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
      focusGraph={graph}
      headerLeading={headerLeading ?? targetPicker}
      selected={selection}
      treeNodes={nodes}
      treeStateKey={`${target.project.id}:app:${selectedTarget?.id ?? "legacy"}:${requestedDevice}`}
      workspace={workspaceWithApprovals}
      onApprovalReviewChange={setApprovalReview}
      editingSourceOwnerId={selection?.sourceNodeId}
      slotEditorReady={slotEditorReady}
      onCreateComponent={componentCreation.open}
      onFocus={(occurrenceId, next) => {
        openDesign(occurrenceId, next);
      }}
      onOpenComponent={openComponent}
      onHover={setHoveredTreeSelection}
      onDeviceChange={changeAppDevice}
      onApplySlot={applySlot}
      onPrepareSlotEdit={prepareSlotEdit}
      onSelect={(next) => {
        if (workspaceMode === "preview") {
          const occurrenceId = next.occurrenceId ?? resolvedFocusId ?? appRootId;
          if (occurrenceId) openDesign(occurrenceId, next);
          return;
        }
        setSelection(next);
        setDesignSelection(next);
        if (next.kind === "component") setCanvasRevealRequest((current) => (current ?? 0) + 1);
        setDraftSelection(undefined);
        setWorkspaceSurface("app");
        setActivity("app");
        // Keep component rows mounted long enough for the second click of a
        // double-click to open the isolated drill-down on narrow layouts.
        setMobilePane(next.kind === "html" ? "canvas" : "tree");
      }}
    />
  );
  const appSidebar = renderAppSidebar();
  const attachCodeSelection = useCallback((codeSelection: SourceCodeSelectionContext) => {
    setCodeContexts((current) => current.some(({ id }) => id === codeSelection.id)
      ? current
      : [...current, codeSelection]);
  }, []);
  const annotateCodeSelection = useCallback((codeSelection: SourceCodeSelectionContext, comment: string) => {
    setCodeAnnotations((current) => [...current, {
      comment,
      context: codeSelection,
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    }]);
  }, []);
  const renderAppCodePanel = (showHeader = true) => (
    <SourceCodeCanvas
      editable={activeCodeDocument === "design" ? Boolean(entry?.design) : Boolean(entry)}
      editor={codeEditor}
      label={activeCodeDocument === "design" ? `${entry?.label ?? selectedNode?.label ?? "Component"} design` : entry?.label ?? selectedNode?.label ?? "Source"}
      path={activeCodeDocument === "design" ? entry?.design?.relativePath : entry?.relativePath}
      showHeader={showHeader}
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
      onAttachSelection={attachCodeSelection}
      onAnnotateSelection={annotateCodeSelection}
      onRevealInFiles={entry && (() => revealSourceFile(
        activeCodeDocument === "design" && entry.design ? entry.design.fileId : entry.fileId,
        "app",
      ))}
    />
  );
  const appCodePanel = renderAppCodePanel();
  const appCodeHeader = (
    <SourceCodeHeaderContent
      editable={activeCodeDocument === "design" ? Boolean(entry?.design) : Boolean(entry)}
      editor={codeEditor}
      label={activeCodeDocument === "design" ? `${entry?.label ?? selectedNode?.label ?? "Component"} design` : entry?.label ?? selectedNode?.label ?? "Source"}
      path={activeCodeDocument === "design" ? entry?.design?.relativePath : entry?.relativePath}
      toolbar={entry?.design ? (
        <CodeDocumentSwitch value={activeCodeDocument} onChange={setCodeDocument} />
      ) : undefined}
      onRevealInFiles={entry && (() => revealSourceFile(
        activeCodeDocument === "design" && entry.design ? entry.design.fileId : entry.fileId,
        "app",
      ))}
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
      onAttachSelection={attachCodeSelection}
      onAnnotateSelection={annotateCodeSelection}
      onRevealInFiles={libraryEntry && libraryRuntime.mode === "development" ? () => revealSourceFile(
        activeLibraryCodeDocument === "design" && libraryEntry.design
          ? libraryEntry.design.fileId
          : libraryEntry.fileId,
        libraryRuntime.catalogKind === "app" ? "app" : "library",
      ) : undefined}
    />
  );
  const fileSidebar = (
    <ProjectFileBrowser
      className="flex h-full w-full border-r-0"
      files={workspaceFiles}
      header={workspaceSurface === "library" ? (
        <LibraryFilesHeader
          fileCount={workspaceFiles.filter((file) => file.kind === "file" && !file.ignored).length}
          ignoredFileCount={ignoredFileCount}
          showIgnoredFiles={showIgnoredFiles}
          onShowIgnoredFilesChange={setShowIgnoredFiles}
        />
      ) : undefined}
      selectedFileId={selectedProjectFileId}
      showIgnored={showIgnoredFiles}
      title={workspaceSurface === "library" ? "Library files" : "Project files"}
      onSelect={(fileId) => {
        setSelectedProjectFileId(fileId);
        setActivity("files");
        setMobilePane("canvas");
      }}
    />
  );
  const librarySidebar = (
    <SourceLibraryExplorer
      appTargetId={selectedTarget?.id}
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
        setWorkspaceSurface("library");
        setActivity("library");
      }}
      onSelect={(componentId) => {
        setSelectedLibraryComponent(componentId);
        setSelectedLibraryLayerId(undefined);
        setWorkspaceSurface("library");
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
  const desktopLeft = activity === "app"
    ? (
      <SourceWorkspaceCodeOverlay
        code={renderAppCodePanel(false)}
        header={appCodeHeader}
        height={appCodeHeight}
        open={appCodeOpen}
        onHeightChange={setAppCodeHeight}
        onOpenChange={setAppCodeOpen}
      >
        {renderAppSidebar()}
      </SourceWorkspaceCodeOverlay>
    )
    : left;
  const workspacePageNavigation = (
    <SourceWorkspacePageNavigation
      mode={workspaceMode}
      onChange={(next) => next === "design" ? openDesignPage() : openPreviewPage()}
    />
  );
  const canvas = activity === "library" ? (
    <SourceLibraryCanvas
      appTargetId={selectedTarget?.id}
      appWorkspace={workspace}
      boxModelPreviewStore={boxModelPreviewStore}
      catalog={effectiveLibraryCatalog}
      catalogKind={libraryRuntime.catalogKind}
      codeAnnotations={codeAnnotations}
      codeContexts={codeContexts}
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
      workspaceNavigation={workspacePageNavigation}
      onClearCodeFeedback={() => {
        setCodeContexts([]);
        setCodeAnnotations([]);
      }}
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
      onRemoveCodeAnnotation={(id) => setCodeAnnotations((current) => current.filter((item) => item.id !== id))}
      onRemoveCodeContext={(id) => setCodeContexts((current) => current.filter((item) => item.id !== id))}
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
      label={selectedProjectFile?.label ?? (workspaceSurface === "library" ? "Select a library file" : "Select a project file")}
    />
  ) : (
    <SourceAppCanvas
      ancestry={canvasAncestry}
      boxModelPreviewStore={boxModelPreviewStore}
      centerContent={workspaceMode === "design"}
      codeAnnotations={codeAnnotations}
      codeContexts={codeContexts}
      device={requestedDevice}
      draftSelection={draftSelection}
      editor={editor}
      entry={entry}
      entries={targetEntries}
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
      reviewCheckpoint={workspaceMode === "design" && previewEntry && componentReviewIndex >= 0 ? {
        approved: approvedComponentCount,
        dirty: currentDraftChanges.some((change) => change.fileId === previewEntry.fileId),
        entry: previewEntry,
        error: approvalSigningError,
        evidence: effectiveApprovals,
        index: componentReviewIndex,
        signing: signingEntryId === previewEntry.id,
        total: componentReviewSequence.length,
        onNext: openNextReviewComponent,
        onSign: () => void signCurrentComponent(),
      } : undefined}
      runtime={activeRuntime}
      selectedClassCss={styleEditor.previewCss}
      selectedClassName={styleEditor.previewValue}
      selectedDesignCase={selectedAppDesignCase}
      selectedLayer={visualLayer}
      selectedLayerLabel={selectedLabel}
      selectedLayerOccurrence={sourceCanvasSelectionOccurrence(graph, resolvedFocusId, selection)}
      selectedText={styleEditor.previewTextValue}
      slotLayers={previewSlotLayers}
      slotScopes={previewSlotScopes}
      slotTargetLabel={selectedSlotTarget?.node.label}
      styles={activeStyles}
      workspaceMode={workspaceMode}
      workspaceNavigation={workspacePageNavigation}
      onModeChange={(mode) => setPreviewRuntime(mode === "play" ? "play" : "static")}
      onClearCodeFeedback={() => {
        setCodeContexts([]);
        setCodeAnnotations([]);
      }}
      onDesignCaseChange={(caseName) => previewEntry?.design && setDesignCases((current) => ({
        ...current,
        [previewEntry.design!.fileId]: caseName,
      }))}
      onReturnToPreview={openPreviewPage}
      onSelectedLayerMetrics={setSelectedLayerMetrics}
      onSelectLayer={(layerId, occurrence) => {
        const slot = previewSlotLayers.find((candidate) => candidate.id === layerId);
        const next = slot && focusedOccurrence
          ? sourceSlotSelection(focusedOccurrence, slot, requestedDevice)
          : sourceCanvasSelection(graph, resolvedFocusId, layerId, requestedDevice, occurrence);
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
      onOpenSlotTarget={selectedSlotTarget ? () => {
        openDesign(selectedSlotTarget.id, sourceComponentSelection(selectedSlotTarget, requestedDevice));
      } : undefined}
      onRemoveCodeAnnotation={(id) => setCodeAnnotations((current) => current.filter((item) => item.id !== id))}
      onRemoveCodeContext={(id) => setCodeContexts((current) => current.filter((item) => item.id !== id))}
      onSelectAncestry={(item) => {
        if (item.kind !== "component") return;
        const occurrence = graph.occurrences.get(item.id);
        if (!occurrence) return;
        openDesign(occurrence.id, sourceComponentSelection(occurrence, requestedDevice));
      }}
      onGenerateDesign={previewEntry ? () => void designGeneration.generate("app", previewEntry.id) : undefined}
      onDeviceChange={changeAppDevice}
    />
  );
  const right = activity === "library"
    ? (
      <SourceComponentInspector
        className="flex h-full w-full border-l-0"
        entry={libraryEntry}
        layer={libraryVisualLayer}
        layerMetrics={selectedLayerMetrics}
        openLayerComponent={libraryImportedComponentTarget && libraryVisualLayer ? {
          label: libraryVisualLayer.label,
          onOpen: () => {
            setSelectedLibraryComponent(libraryImportedComponentTarget.entry.id);
            setSelectedLibraryLayerId(libraryImportedComponentTarget.layerId);
            setWorkspaceSurface("library");
            setActivity("library");
            setCodeDocument("source");
            setAppCodeOpen(true);
            setMobilePane("inspect");
          },
        } : undefined}
        selectedDesignCase={selectedLibraryDesignCase}
        slotLayers={sourceEntrySlotLayers(libraryEntry)}
        styleEditor={libraryStyleEditor}
        onBoxModelPreviewChange={boxModelPreviewStore.set}
        onDesignCaseChange={(caseName) => libraryPreviewEntry?.design && setDesignCases((current) => ({
          ...current,
          [libraryPreviewEntry.design!.fileId]: caseName,
        }))}
      />
    )
    : activity === "files"
      ? (
        <FileEvidencePanel
          editable={Boolean(selectedProjectFile?.editable)}
          label={selectedProjectFile?.label}
          scope={fileScope}
        />
      )
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
          onBoxModelPreviewChange={boxModelPreviewStore.set}
          candidatesForSlot={(slot) => sourceSlotCandidates(workspace, nodes, slot, requestedDevice, inspectorSourceOwnerEntry?.relativePath ?? entry?.relativePath ?? "")}
          onApplySlot={(slot, candidate, action) => focusedOccurrence && applySlot(slot, focusedOccurrence, candidate, action)}
          onDesignCaseChange={(caseName) => inspectorEntry?.design && setDesignCases((current) => ({
            ...current,
            [inspectorEntry.design!.fileId]: caseName,
          }))}
          onPrepareSlotEdit={() => focusedOccurrence && prepareSlotEdit(focusedOccurrence)}
        />
      );
  const surfaceNavigation = {
    value: workspaceSurface,
    libraryLabel: target.sourceLibrary?.packageName ?? workspace.library?.packageName ?? "Component library",
    onChange: openWorkspaceArea,
  };
  const workspaceTopBar = (options?: { leadingAction?: ReactNode; trailingAction?: ReactNode }) => (
    <WorkspaceTopBar
      targetLabel={target.project.label}
      surfaceNavigation={surfaceNavigation}
      documentLabel={activity === "files"
        ? selectedProjectFile?.label ?? (workspaceSurface === "library" ? "Library files" : "Project files")
        : activity === "library"
          ? libraryEntry?.label ?? "Component library"
          : selectedLabel ?? "No source entry"}
      checking={activity === "library" ? libraryDraftAnalysis.analyzing : draftAnalysis.analyzing}
      canUndo={activeEditor.canUndo}
      canRedo={activeEditor.canRedo}
      canReset={activeEditable && activeEditor.dirty}
      canStrictUi={false}
      canDiff={activity === "files" && activeEditable && fileEditor.dirty}
      canSave={activity === "files" && activeEditable && Boolean(fileEditor.prepared)}
      saving={activity === "files" ? fileEditor.saving : review.applying}
      pendingChanges={currentDraftChanges.length}
      leadingAction={options?.leadingAction}
      trailingAction={options?.trailingAction}
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
  );
  const mobile = (
    <SourceWorkspaceMobile
      activity={activity}
      appSidebar={appSidebar}
      canvas={canvas}
      left={left}
      mobilePane={mobilePane}
      returnActivity={workspaceSurface}
      right={right}
      onActivityChange={(next) => next === "app" ? openAppDesign() : openDesignArea(next)}
      onPaneChange={setMobilePane}
    />
  );

  const dialogs = (
    <>
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
    </>
  );
  return (
    <SourceWorkspaceFrame
      activity={activity}
      canvas={canvas}
      desktopLeft={desktopLeft}
      dialogs={dialogs}
      documentId={activity === "library"
        ? `library:${selectedLibraryComponent ?? "empty"}:${requestedDevice}`
        : `${focusedOccurrence?.node.id ?? selectedNode?.id ?? "empty"}:${requestedDevice}`}
      mobile={mobile}
      mobilePane={mobilePane}
      projectId={target.project.id}
      renderTopBar={workspaceTopBar}
      returnActivity={workspaceSurface}
      right={right}
      setMobilePane={setMobilePane}
      onActivityChange={(next) => next === "app" ? openAppDesign() : openDesignArea(next)}
    />
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
