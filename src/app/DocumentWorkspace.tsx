import { useEffect, useMemo, useState } from "react";

import type { SelectionTarget } from "../model";
import type { TailwindPreview } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";
import type { TargetModule } from "../shared/target-module";
import { DiffPanel } from "./components/DiffPanel";
import { runLocalOperation } from "./api";
import type { ProductMode } from "./documents/DocumentNavigator";
import { DesktopDocumentEditingPanel } from "./documents/DesktopDocumentEditingPanel";
import { DocumentDefinitionPanel } from "./documents/DocumentDefinitionPanel";
import { DocumentWorkspaceDialogs } from "./documents/DocumentWorkspaceDialogs";
import { DocumentWorkspacePanels } from "./documents/DocumentWorkspacePanels";
import { EmptyModeState } from "./documents/EmptyModeState";
import type { WorkspaceBrowserView } from "./documents/WorkspaceBrowser";
import type { WorkspaceSidebarView } from "./documents/WorkspaceSidebar";
import { documentCatalog, resolveDocumentAdapter, wouldCreateAuthoredComponentCycle } from "./document/document-adapters";
import { findDesignNode } from "./document/document-commands";
import { createDesignIdFactory } from "./document/design-id";
import { createLegacyDocument, documentToFixture } from "./document/fixture-document";
import { DesignDocumentPreview } from "./document/document-runtime";
import { isDocumentDirty } from "./document/document-session";
import { buildDesignDocumentTree } from "./document/document-tree";
import { createDocumentWorkspaceRouting } from "./document/document-workspace-routing";
import { projectDocumentSlots } from "./document/document-workspace-projections";
import { buildSelectionNavigation, navigateSelection, requiredTreeDisclosures } from "./document/selection-navigation";
import type { PreviewDomSnapshot } from "./dom/dom-snapshot";
import { useDocumentCreationFlow } from "./document/use-document-creation-flow";
import { useDocumentSelectionInteractions } from "./document/use-document-selection-interactions";
import { useWorkspaceKeyboardCommands } from "./document/use-workspace-keyboard-commands";
import { collectDocumentTailwind, useDocumentItemEditor } from "./document/use-document-item-editor";
import { useDocumentWorkspace } from "./document/use-document-workspace";
import { BlockedOrLoading } from "./document/WorkspaceStates";
import { PreviewBoundary } from "./PreviewBoundary";
import { MobileDock, type MobilePane } from "./shell/MobileDock";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { createTargetViewModel, findComponentInstance } from "./target-model";
import type { SlotState } from "./types";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
export function DocumentWorkspace({ target }: { target: TargetModule }) {
  const controller = useDocumentWorkspace(target);
  const session = controller.session;
  const fallback = useMemo(() => createLegacyDocument(target), [target]);
  const document = session?.draft ?? fallback;
  const library = controller.documents;
  const fixture = useMemo(() => documentToFixture(document), [document]);
  const [mode, setMode] = useState<ProductMode>(document.kind === "component" ? "library" : "app");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [browserView, setBrowserView] = useState<WorkspaceBrowserView>("documents");
  const [sidebarView, setSidebarView] = useState<WorkspaceSidebarView>("tree");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>();
  const [revealedInternals, setRevealedInternals] = useState<ReadonlySet<string>>(() => new Set());
  const [selection, setSelection] = useState<SelectionTarget>({ kind: "component", id: document.root.instanceId });
  const [slotPicker, setSlotPicker] = useState<SlotSelection>();
  const [insertMode, setInsertMode] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showStrictUi, setShowStrictUi] = useState(false);
  const [definitionEditor, setDefinitionEditor] = useState(true);
  const [pendingEditId, setPendingEditId] = useState<string>();
  const [previewCss, setPreviewCss] = useState("");
  const [compiledTailwind, setCompiledTailwind] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [observedDom, setObservedDom] = useState<PreviewDomSnapshot>({});
  const [hoveredSelection, setHoveredSelection] = useState<SelectionTarget>();
  const [highlightedInternalHtmlComponentId, setHighlightedInternalHtmlComponentId] = useState<string>();
  const [requestedFileId, setRequestedFileId] = useState<string>();
  const creation = useDocumentCreationFlow({
    prepareCreate: controller.prepareCreate,
    saveCreate: controller.saveCreate,
    onCreated: (createdDocument) => {
      setMode(createdDocument.kind === "screen" ? "app" : "library");
      setMobilePane("canvas");
    },
  });
  const modeDocumentKind = mode === "app" ? "screen" : "component";
  const modeDocumentAvailable = Boolean(session && document.kind === modeDocumentKind);
  const canCreateInMode = controller.creationRecipes.some((recipe) => recipe.kind === modeDocumentKind);
  const componentDocuments = library.filter((candidate) => candidate.kind === "component");
  const viewResult = useMemo(() => {
    try {
      return { view: createTargetViewModel(target, revealedInternals, fixture, componentDocuments, { contractValidation: "tolerant" }) } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The target adapter is invalid." } as const;
    }
  }, [componentDocuments, fixture, revealedInternals, target]);
  const view = viewResult.view;
  const selectedComponentId = selection.kind === "component"
    ? selection.id
    : selection.kind === "slot" || selection.kind === "html" ? selection.componentInstanceId : document.root.instanceId;
  const selectedNode = findDesignNode(document.root, selectedComponentId) ?? document.root;
  const selectedInstance = view ? findComponentInstance(view.root, selectedNode.instanceId) ?? view.root : undefined;
  const selectedAdapter = resolveDocumentAdapter(target, library, selectedNode.adapterId);
  const slots: SlotState[] = view && selectedInstance
    ? projectDocumentSlots(target, library, selectedNode, view.catalog, selectedInstance)
    : [];
  const rows = useMemo(() => buildDesignDocumentTree(target, document, library, revealedInternals, observedDom), [document, library, observedDom, revealedInternals, target]);
  const allRows = useMemo(() => buildDesignDocumentTree(target, document, library, true, observedDom), [document, library, observedDom, target]);
  const selectionNavigation = useMemo(() => buildSelectionNavigation(allRows), [allRows]);
  const internalTreeIds = useMemo(() => {
    const implementationIds = rows.flatMap((row) => row.kind === "internals-summary" ? [row.disclosureId] : []);
    if (implementationIds.length > 0) return implementationIds;
    return [...new Set(rows.flatMap((row) => (
      row.kind === "component" && row.internalHtml ? [row.selection.id] : []
    )))];
  }, [rows]);
  const showInternals = internalTreeIds.length > 0 && internalTreeIds.every((id) => revealedInternals.has(id));
  const selectedHtmlRow = selection.kind === "html" ? rows.find((row) => row.kind === "html" && row.selection.id === selection.id) : undefined;
  const catalog = useMemo(() => documentCatalog(target, library), [library, target]);
  const catalogEntries = catalog.map((entry) => ({ ...entry.component, slotCount: entry.component.slots.length }));
  const catalogComponents = catalog.map((entry) => ({ id: entry.component.id, label: entry.component.label, group: entry.component.group, controls: entry.controls }));
  const createId = useMemo(() => createDesignIdFactory(document.root), [document.root]);
  const pickerParent = slotPicker ? findDesignNode(document.root, slotPicker.componentInstanceId) : undefined;
  const pickerAdapter = pickerParent ? resolveDocumentAdapter(target, library, pickerParent.adapterId) : undefined;
  const pickerSlot = pickerAdapter?.component.slots.find((slot) => slot.id === slotPicker?.slotId);
  const pickerEntries = catalogEntries.filter((entry) => (
    Boolean(pickerSlot?.accepts?.includes(entry.id)) &&
    !wouldCreateAuthoredComponentCycle(document, library, entry.id)
  ));
  const sourceSnapshotKey = session?.staleSnapshot?.documentDigest
    ?? session?.baseDocumentDigest
    ?? document.id;
  const itemEditor = useDocumentItemEditor({
    target,
    document,
    library,
    connected: controller.connected,
    sourceSnapshotKey,
    createId,
    onCommit: controller.edit,
    onSelect: setSelection,
  });
  useEffect(() => {
    const loadedKind = session?.draft.kind;
    if (loadedKind) setMode(loadedKind === "component" ? "library" : "app");
  }, [controller.activeDocumentId, session?.draft.kind]);
  useEffect(() => {
    setSelection({ kind: "component", id: document.root.instanceId });
    setSelectedCatalogId(document.component?.id);
    setDefinitionEditor(true);
    setObservedDom({});
    setRevealedInternals(new Set());
    setHoveredSelection(undefined);
    setHighlightedInternalHtmlComponentId(undefined);
    setRequestedFileId(undefined);
    itemEditor.close();
  }, [document.id, document.kind, document.root.instanceId, sourceSnapshotKey]);
  useEffect(() => {
    const required = requiredTreeDisclosures(selectionNavigation, selection.id);
    if (!required.size) return;
    setRevealedInternals((current) => {
      const next = new Set(current);
      for (const id of required) next.add(id);
      return next.size === current.size ? current : next;
    });
  }, [selection.id, selectionNavigation]);
  useEffect(() => {
    if (!pendingEditId || !findDesignNode(document.root, pendingEditId)) return;
    itemEditor.open(pendingEditId);
    setPendingEditId(undefined);
  }, [document, pendingEditId]);

  const tailwindInput = useMemo(() => collectDocumentTailwind(target, library, document), [document, library, target]);
  useEffect(() => {
    if (!controller.connected || !session) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({ type: "compile-tailwind", value: tailwindInput });
        if (!cancelled) {
          setPreviewCss(result.css);
          setCompiledTailwind(result.value);
          setPreviewError(undefined);
        }
      } catch (error) {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : "The preview did not compile.");
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [controller.connected, session?.draft.id, tailwindInput]);
  const preview = itemEditor.model?.preview ?? <DesignDocumentPreview target={target} document={document} library={library} />;
  const selectionLabel = selection.kind === "slot"
    ? slots.find((slot) => slot.id === selection.slotId)?.label ?? "Slot"
    : selection.kind === "html"
      ? selectedHtmlRow ? `<${selectedHtmlRow.label}>` : "HTML element"
    : selection.kind === "slot-outlet"
      ? `${document.component?.slots.find((slot) => slot.id === selection.slotId)?.label ?? "Slot"} outlet`
      : document.kind === "component" && selection.id === document.root.instanceId
        ? document.component?.label ?? document.label
        : selectedAdapter?.component.label ?? document.label;
  const activeSession = modeDocumentAvailable ? session : undefined;
  const preparedSave = activeSession?.prepared;
  const dirty = Boolean(activeSession && isDocumentDirty(activeSession));
  const tailwindReady = compiledTailwind === tailwindInput && !previewError;
  const selectedRecipe = target.componentRecipes?.find((recipe) => recipe.id === document.component?.recipeId);
  const editorSelectionMatches = itemEditor.model && (
    selection.kind === "html" && selection.componentInstanceId === itemEditor.model.instance.instanceId
  );
  const canvasSelection = editorSelectionMatches
    ? selection
    : itemEditor.model
      ? { kind: "component" as const, id: itemEditor.model.instance.instanceId }
      : selection;
  const canvasSlots = itemEditor.model?.slots ?? slots;
  const canvasRootId = itemEditor.model?.view.root.instanceId ?? view?.root.instanceId ?? document.root.instanceId;
  const canvasSelectedId = itemEditor.model?.instance.instanceId ?? selectedNode.instanceId;
  const canvasSelectionLabel = itemEditor.model?.adapter.component.label ?? selectionLabel;
  const outletSlotDefinition = selection.kind === "slot-outlet"
    ? document.component?.slots.find((slot) => slot.id === selection.slotId)
    : undefined;
  const selectedSlot = selection.kind === "slot"
    ? slots.find((slot) => slot.id === selection.slotId)
    : outletSlotDefinition
      ? {
          ...outletSlotDefinition,
          selectionId: selection.id,
          count: 0,
          acceptedLabels: outletSlotDefinition.accepts?.map((adapterId) => resolveDocumentAdapter(target, library, adapterId)?.component.label ?? adapterId),
        }
      : undefined;

  const switchMode = (next: ProductMode) => {
    setMode(next);
    itemEditor.close();
    setDefinitionEditor(true); setPendingEditId(undefined);
    setSlotPicker(undefined); setInsertMode(false);
    setShowDiff(false); setShowStrictUi(false);
    const kind = next === "app" ? "screen" : "component";
    const entry = controller.entries.find((candidate) => candidate.kind === kind);
    if (entry) controller.selectDocument(entry.id);
    setBrowserView("documents");
    setMobilePane("documents");
  };

  const selectCatalogEntry = (componentId: string) => {
    setSelectedCatalogId(componentId);
    const entry = catalog.find((candidate) => candidate.component.id === componentId);
    if (!entry || entry.targetAdapter) return;
    const authoredDocument = library.find((candidate) => (
      candidate.kind === "component" && candidate.component?.id === componentId
    ));
    if (!authoredDocument) return;
    itemEditor.close();
    setDefinitionEditor(true);
    setMode("library");
    controller.selectDocument(authoredDocument.id);
    setMobilePane("inspect");
  };

  const interactions = useDocumentSelectionInteractions({
    target,
    document,
    library,
    files: controller.files,
    slots,
    selection,
    insertMode,
    createId,
    itemEditor,
    edit: controller.edit,
    onSelect: setSelection,
    onEdit: (instanceId) => {
      setSelection({ kind: "component", id: instanceId });
      setDefinitionEditor(false);
      itemEditor.open(instanceId);
      setMobilePane("canvas");
    },
    onOpenPicker: (slot) => {
      setInsertMode(false);
      setSlotPicker(slot);
      setMobilePane("canvas");
    },
    onInserted: (instanceId) => {
      setDefinitionEditor(false);
      setPendingEditId(instanceId);
      setMobilePane("inspect");
      setSlotPicker(undefined);
    },
    onOpenSource: (fileId) => {
      setRequestedFileId(fileId);
      setBrowserView("files");
      setSidebarView("files");
      setMobilePane("files");
    },
    onReveal: () => {
      setSidebarView("tree");
      setMobilePane("tree");
    },
  });

  const routing = createDocumentWorkspaceRouting({
    document, selection, selectedNodeInstanceId: selectedNode.instanceId,
    definitionEditor, modeDocumentAvailable, itemEditor, interactions,
    setSelection, setDefinitionEditor, setPendingEditId, setMobilePane,
    setBrowserView, setInsertMode, setSlotPicker, setShowStrictUi,
  });

  useWorkspaceKeyboardCommands({
    enabled: modeDocumentAvailable && !interactions.contextMenu && !slotPicker && !showDiff && !creation.isOpen && !showStrictUi,
    onDelete: () => itemEditor.model ? itemEditor.remove() : interactions.deleteSelection(selection),
  });

  if (controller.loading || (!session && !controller.connected) || (session && !view)) {
    return <BlockedOrLoading loading={controller.loading} message={viewResult.error ?? controller.message} />;
  }

  const desktopEditor = modeDocumentAvailable ? (
    <DesktopDocumentEditingPanel
      definitionEditor={definitionEditor}
      document={document}
      documents={library}
      recipe={selectedRecipe}
      catalogComponents={catalogComponents}
      files={controller.files}
      selectedNodeId={selectedNode.instanceId}
      itemEditor={itemEditor}
      onDocumentChange={controller.edit}
      onDefinitionEditorChange={setDefinitionEditor}
      onSelectSlot={(slot, instanceId) => interactions.selectTarget({ kind: "slot", id: slot.selectionId, componentInstanceId: instanceId, slotId: slot.id })}
    />
  ) : (
    <EmptyModeState className="flex h-full w-full" mode={mode} canCreate={canCreateInMode} onCreate={creation.open} />
  );
  const mobileDefinition = definitionEditor && modeDocumentAvailable ? (
    <DocumentDefinitionPanel
      className="flex h-full w-full border-l-0"
      document={document}
      documents={library}
      recipe={selectedRecipe}
      catalogComponents={catalogComponents}
      onChange={controller.edit}
      onEditImplementation={() => {
        setDefinitionEditor(false);
        itemEditor.open(document.root.instanceId);
        setMobilePane("canvas");
      }}
    />
  ) : desktopEditor;

  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#0d0e10] text-zinc-200">
      <style data-design-space-document-preview>{itemEditor.model?.previewCss ?? previewCss}</style>
      <WorkspaceTopBar
        targetLabel={target.project.label}
        documentLabel={modeDocumentAvailable ? document.label : `No ${modeDocumentKind} selected`}
        mode={mode}
        connected={controller.connected}
        strictUi={activeSession?.strictUi}
        checking={activeSession?.phase === "checking"}
        canUndo={!itemEditor.model && Boolean(activeSession?.past.length)} canRedo={!itemEditor.model && Boolean(activeSession?.future.length)}
        canReset={modeDocumentAvailable && !itemEditor.model}
        canStrictUi={modeDocumentAvailable && !itemEditor.model}
        canDiff={Boolean(!itemEditor.model && activeSession && dirty && controller.connected && activeSession.phase !== "stale" && tailwindReady)}
        canSave={!itemEditor.model && activeSession?.phase === "diff-ready" && Boolean(preparedSave)}
        saving={activeSession?.phase === "saving"}
        onModeChange={switchMode}
        onUndo={controller.undo}
        onRedo={controller.redo}
        onReset={() => { if (modeDocumentAvailable) controller.reset(); }}
        onStrictUi={() => { if (modeDocumentAvailable) setShowStrictUi(true); }}
        onDiff={() => void controller.prepare().then((result) => {
          if (result?.state === "ready") setShowDiff(true);
          else if (result) setShowStrictUi(true);
        })}
        onSave={() => void controller.save().then((result) => result && setShowDiff(false))}
      />
      <DocumentWorkspacePanels
        projectId={target.project.id}
        documentId={document.id}
        documentLabel={document.label}
        documentKind={document.kind}
        mode={mode}
        mobilePane={mobilePane}
        mobileEditorOpen={Boolean(itemEditor.model)}
        sidebarView={sidebarView}
        browserView={browserView}
        modeDocumentAvailable={modeDocumentAvailable}
        canCreate={canCreateInMode}
        entries={controller.entries}
        files={controller.files}
        catalog={catalog}
        activeDocumentId={controller.activeDocumentId}
        selectedCatalogId={selectedCatalogId}
        requestedFileId={requestedFileId}
        rows={rows}
        selection={selection}
        hoveredSelection={hoveredSelection}
        highlightedInternalHtmlComponentId={highlightedInternalHtmlComponentId}
        showInternals={showInternals}
        insertMode={insertMode}
        strictUiViolations={controller.liveViolations}
        preview={<PreviewBoundary resetKey={`${document.id}:${itemEditor.model?.tailwindInput ?? tailwindInput}`}>{preview}</PreviewBoundary>}
        canvasRootId={canvasRootId}
        canvasSelectedId={canvasSelectedId}
        canvasSelection={canvasSelection}
        canvasSelectionLabel={canvasSelectionLabel}
        canvasSlots={canvasSlots}
        selectedSlot={selectedSlot}
        slotPicker={slotPicker}
        pickerLabel={pickerSlot?.label ?? "slot"}
        pickerEntries={pickerEntries}
        actionMessage={interactions.actionError ?? controller.message ?? previewError}
        slotDependencyMessage={interactions.slotDependencyMessage}
        rightOverride={showDiff && preparedSave ? (
          <DiffPanel
            diff={preparedSave.exactDiff}
            saving={activeSession?.phase === "saving"}
            onClose={() => setShowDiff(false)}
            onSave={() => void controller.save().then((result) => result && setShowDiff(false))}
          />
        ) : undefined}
        desktopEditor={desktopEditor}
        mobileDefinition={mobileDefinition}
        onBrowserViewChange={(next) => {
          setBrowserView(next);
          setSidebarView(next);
        }}
        onSidebarViewChange={(next) => {
          setSidebarView(next);
          if (next !== "tree") setBrowserView(next);
        }}
        onModeChange={switchMode}
        onDocumentSelect={(id) => {
          itemEditor.close();
          controller.selectDocument(id);
          setMobilePane("canvas");
        }}
        onFileOpened={() => setRequestedFileId(undefined)}
        onCatalogSelect={selectCatalogEntry}
        onCreate={creation.open}
        onSelect={routing.selectWorkspaceTarget}
        onCanvasSelect={routing.selectCanvasTarget}
        onHover={setHoveredSelection}
        onHoverInternals={setHighlightedInternalHtmlComponentId}
        onNavigate={(command) => {
          const next = navigateSelection(selectionNavigation, selection.id, command);
          if (next) routing.navigateWorkspaceTarget(next);
        }}
        onCollapseAll={() => setRevealedInternals(requiredTreeDisclosures(selectionNavigation, selection.id))}
        onToggleInsert={() => {
          setInsertMode((current) => !current);
          setSlotPicker(undefined);
        }}
        onToggleInternals={(componentInstanceId) => setRevealedInternals((current) => {
          if (componentInstanceId) {
            const next = new Set(current);
            if (next.has(componentInstanceId)) next.delete(componentInstanceId);
            else next.add(componentInstanceId);
            return next;
          }
          return showInternals ? new Set() : new Set(internalTreeIds);
        })}
        onOpenSlot={interactions.openSlotCatalog}
        onClearSlot={interactions.clearSlot}
        onRemoveOutlet={interactions.removeOutlet}
        onRemoveSlotDefinition={interactions.removeSlotDefinition}
        onClosePicker={() => {
          setInsertMode(false);
          setSlotPicker(undefined);
        }}
        onInsertComponent={(id) => slotPicker && interactions.insertComponent(id, slotPicker)}
        onContextMenu={(request) => {
          if (itemEditor.model) {
            if (request.selection.kind === "component") routing.selectWorkspaceTarget(request.selection);
            return;
          }
          interactions.openContextMenu(request);
        }}
        onEditComponent={routing.editWorkspaceComponent}
        onDomSnapshot={setObservedDom}
        onMobileDrawerClose={() => setMobilePane("canvas")}
      />
      <MobileDock active={mobilePane} onChange={routing.onMobilePaneChange} />
      <DocumentWorkspaceDialogs
        workspace={{ controller, activeSession, creation, interactions, itemEditor, mode, modeDocumentAvailable, slotPicker, pickerLabel: pickerSlot?.label ?? "slot", pickerEntries, showDiff, showStrictUi }}
        actions={{
          setShowDiff, setShowStrictUi,
          closeSlotPicker: () => { setInsertMode(false); setSlotPicker(undefined); },
          openViolation: routing.openViolation,
          editDefinition: () => { itemEditor.close(); setDefinitionEditor(true); setMobilePane("inspect"); },
          selectSlot: (slot, occupied) => { itemEditor.close(); interactions.selectTarget(slot); setMobilePane(occupied ? "tree" : "canvas"); },
          closeItemEditor: () => { itemEditor.close(); setMobilePane("canvas"); },
          applyItemEditor: () => { itemEditor.apply(); setMobilePane("canvas"); },
        }}
      />
    </div>
  );
}
