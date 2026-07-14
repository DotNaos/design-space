import { useEffect, useMemo, useState } from "react";

import { projectPreviewSlots, type SelectionTarget } from "../model";
import type { TailwindPreview } from "../shared/contracts";
import type { DesignDocument } from "../shared/design-document";
import type { PreparedDocumentCreate } from "../shared/document-transactions";
import type { StrictUiViolation } from "../shared/strict-ui";
import type { TargetModule } from "../shared/target-module";
import { ComponentTree } from "./components/ComponentTree";
import { DiffSheet } from "./components/DiffSheet";
import { MobileItemEditor } from "./components/MobileItemEditor";
import { PreviewCanvas } from "./components/PreviewCanvas";
import { SlotCatalogDialog } from "./components/SlotCatalogDialog";
import { runLocalOperation } from "./api";
import type { ProductMode } from "./documents/DocumentNavigator";
import { CreateDocumentSheet } from "./documents/CreateDocumentSheet";
import { DocumentDefinitionPanel } from "./documents/DocumentDefinitionPanel";
import { WorkspaceBrowser, type WorkspaceBrowserView } from "./documents/WorkspaceBrowser";
import { documentCatalog, resolveDocumentAdapter, wouldCreateAuthoredComponentCycle } from "./document/document-adapters";
import { findDesignNode, insertDesignChild } from "./document/document-commands";
import { createDesignIdFactory } from "./document/design-id";
import { createLegacyDocument, documentToFixture } from "./document/fixture-document";
import { DesignDocumentPreview } from "./document/document-runtime";
import { isDocumentDirty } from "./document/document-session";
import { buildDesignDocumentTree } from "./document/document-tree";
import type { PreviewDomSnapshot } from "./dom/dom-snapshot";
import { shouldOpenSlotPicker, slotHasCapacity } from "./document/slot-capacity";
import { collectDocumentTailwind, useDocumentItemEditor } from "./document/use-document-item-editor";
import { useDocumentWorkspace } from "./document/use-document-workspace";
import {
  BlockedOrLoading,
  InspectorPrompt,
  workspaceStatusText,
  workspaceStatusTone,
} from "./document/WorkspaceStates";
import { DocumentInspector } from "./inspector/DocumentInspector";
import { PreviewBoundary } from "./PreviewBoundary";
import { MobileDock, type MobilePane } from "./shell/MobileDock";
import { WorkspaceTopBar } from "./shell/WorkspaceTopBar";
import { StrictUiSheet } from "./strict-ui/StrictUiSheet";
import { createTargetViewModel, findComponentInstance } from "./target-model";
import type { SlotState } from "./types";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
type ReadyDocumentCreate = Extract<PreparedDocumentCreate, { state: "create-ready" }>;
export function DocumentWorkspace({ target }: { target: TargetModule }) {
  const controller = useDocumentWorkspace(target);
  const fallback = useMemo(() => createLegacyDocument(target), [target]);
  const document = controller.session?.draft ?? fallback;
  const library = controller.documents;
  const fixture = useMemo(() => documentToFixture(document), [document]);
  const [mode, setMode] = useState<ProductMode>(document.kind === "component" ? "library" : "app");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [browserView, setBrowserView] = useState<WorkspaceBrowserView>("documents");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>();
  const [showInternals, setShowInternals] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>({ kind: "component", id: document.root.instanceId });
  const [slotPicker, setSlotPicker] = useState<SlotSelection>();
  const [insertMode, setInsertMode] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showStrictUi, setShowStrictUi] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [preparedCreate, setPreparedCreate] = useState<ReadyDocumentCreate>();
  const [definitionEditor, setDefinitionEditor] = useState(true);
  const [pendingEditId, setPendingEditId] = useState<string>();
  const [previewCss, setPreviewCss] = useState("");
  const [compiledTailwind, setCompiledTailwind] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [observedDom, setObservedDom] = useState<PreviewDomSnapshot>({});
  const componentDocuments = library.filter((candidate) => candidate.kind === "component");
  const viewResult = useMemo(() => {
    try {
      return { view: createTargetViewModel(target, showInternals, fixture, componentDocuments, { contractValidation: "tolerant" }) } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The target adapter is invalid." } as const;
    }
  }, [componentDocuments, fixture, showInternals, target]);
  const view = viewResult.view;
  const selectedComponentId = selection.kind === "component"
    ? selection.id
    : selection.kind === "slot" || selection.kind === "html" ? selection.componentInstanceId : document.root.instanceId;
  const selectedNode = findDesignNode(document.root, selectedComponentId) ?? document.root;
  const selectedInstance = view ? findComponentInstance(view.root, selectedNode.instanceId) ?? view.root : undefined;
  const selectedAdapter = resolveDocumentAdapter(target, library, selectedNode.adapterId);
  const slots: SlotState[] = view && selectedInstance ? projectPreviewSlots(view.catalog, selectedInstance, { contractValidation: "tolerant" }).map((slot) => ({
    id: slot.selection.slotId,
    selectionId: slot.selection.id,
    label: slot.label,
    count: slot.childCount,
    childLabel: childLabel(target, library, selectedNode, slot.selection.slotId),
  })) : [];
  const rows = useMemo(() => buildDesignDocumentTree(target, document, library, showInternals, observedDom), [document, library, observedDom, showInternals, target]);
  const selectedHtmlRow = selection.kind === "html" ? rows.find((row) => row.kind === "html" && row.selection.id === selection.id) : undefined;
  const catalog = useMemo(() => documentCatalog(target, library), [library, target]);
  const catalogEntries = catalog.map((entry) => ({ ...entry.component, slotCount: entry.component.slots.length }));
  const catalogComponents = catalog.map((entry) => ({ id: entry.component.id, label: entry.component.label, group: entry.component.group, controls: entry.controls }));
  const createId = useMemo(() => createDesignIdFactory(document.root), [document.root]);
  const pickerParent = slotPicker ? findDesignNode(document.root, slotPicker.componentInstanceId) : undefined;
  const pickerAdapter = pickerParent ? resolveDocumentAdapter(target, library, pickerParent.adapterId) : undefined;
  const pickerSlot = pickerAdapter?.component.slots.find((slot) => slot.id === slotPicker?.slotId);
  const pickerEntries = catalogEntries.filter((entry) => (
    (!pickerSlot?.accepts || pickerSlot.accepts.includes(entry.id)) &&
    !wouldCreateAuthoredComponentCycle(document, library, entry.id)
  ));
  const sourceSnapshotKey = controller.session?.staleSnapshot?.documentDigest
    ?? controller.session?.baseDocumentDigest
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
    setSelection({ kind: "component", id: document.root.instanceId });
    setSelectedCatalogId(document.component?.id);
    setDefinitionEditor(true);
    setObservedDom({});
    itemEditor.close();
  }, [document.id, document.root.instanceId, sourceSnapshotKey]);
  useEffect(() => {
    if (!pendingEditId || !findDesignNode(document.root, pendingEditId)) return;
    itemEditor.open(pendingEditId);
    setPendingEditId(undefined);
  }, [document, pendingEditId]);

  const tailwindInput = useMemo(() => collectDocumentTailwind(target, library, document.root), [document, library, target]);
  useEffect(() => {
    if (!controller.connected) return;
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
  }, [controller.connected, tailwindInput]);
  if (controller.loading || !view) {
    return <BlockedOrLoading loading={controller.loading} message={viewResult.error ?? controller.message} />;
  }

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
  const dirty = Boolean(controller.session && isDocumentDirty(controller.session));
  const tailwindReady = compiledTailwind === tailwindInput && !previewError;
  const selectedRecipe = target.componentRecipes?.find((recipe) => recipe.id === document.component?.recipeId);
  const canvasSelection = itemEditor.model
    ? { kind: "component" as const, id: itemEditor.model.instance.instanceId }
    : selection;
  const canvasSlots = itemEditor.model?.slots ?? slots;
  const canvasRootId = itemEditor.model?.view.root.instanceId ?? view.root.instanceId;
  const canvasSelectedId = itemEditor.model?.instance.instanceId ?? selectedNode.instanceId;
  const canvasSelectionLabel = itemEditor.model?.adapter.component.label ?? selectionLabel;

  const selectTarget = (next: SelectionTarget, openEmptySlot = true) => {
    setSelection(next);
    if (next.kind === "slot" && openEmptySlot) {
      const parent = findDesignNode(document.root, next.componentInstanceId);
      const adapter = parent ? resolveDocumentAdapter(target, library, parent.adapterId) : undefined;
      const slot = adapter?.component.slots.find((candidate) => candidate.id === next.slotId);
      const childCount = parent?.slots[next.slotId]?.length ?? 0;
      if (slot && shouldOpenSlotPicker(slot, childCount, insertMode)) {
        setInsertMode(false);
        setSlotPicker(next);
      }
    }
  };

  const insertComponent = (adapterId: string, targetSlot: SlotSelection): boolean => {
    if (wouldCreateAuthoredComponentCycle(document, library, adapterId)) return false;
    const parent = findDesignNode(document.root, targetSlot.componentInstanceId);
    const parentAdapter = parent ? resolveDocumentAdapter(target, library, parent.adapterId) : undefined;
    const slot = parentAdapter?.component.slots.find((candidate) => candidate.id === targetSlot.slotId);
    const childAdapter = resolveDocumentAdapter(target, library, adapterId);
    const children = parent?.slots[targetSlot.slotId] ?? [];
    if (!parent || !slot || !childAdapter || (slot.accepts && !slot.accepts.includes(adapterId))) return false;
    if (!slotHasCapacity(slot, children.length)) return false;
    const instanceId = createId();
    controller.edit(insertDesignChild(document, parent.instanceId, slot.id, {
      kind: "component",
      node: {
        instanceId,
        adapterId,
        props: { ...childAdapter.defaultProps },
        slots: Object.fromEntries(childAdapter.component.slots.map((childSlot) => [childSlot.id, []])),
      },
    }));
    setSelection({ kind: "component", id: instanceId });
    setDefinitionEditor(false);
    setPendingEditId(instanceId);
    setMobilePane("inspect");
    setSlotPicker(undefined);
    return true;
  };

  const switchMode = (next: ProductMode) => {
    setMode(next);
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

  const prepareCreate = async (recipeId: string, label: string) => {
    setCreateBusy(true);
    setCreateError(undefined);
    const result = await controller.prepareCreate(recipeId, label);
    setCreateBusy(false);
    if (!result) {
      setCreateError("The local target could not prepare this document.");
      return;
    }
    if (result.state === "strict-blocked") {
      setCreateError(result.strictUi.violations[0]?.message ?? "Strict UI blocked this starting structure.");
      return;
    }
    if (result.state === "compile-blocked") {
      setCreateError(result.compile.message ?? "The target could not compile this starting structure.");
      return;
    }
    setShowCreate(false);
    setPreparedCreate(result);
  };

  const saveCreate = async () => {
    if (!preparedCreate) return;
    setCreateSaving(true);
    const saved = await controller.saveCreate(preparedCreate.challengeId, preparedCreate.documentId);
    setCreateSaving(false);
    if (!saved) return;
    setPreparedCreate(undefined);
    setMode(preparedCreate.createdDocument.kind === "screen" ? "app" : "library");
    setMobilePane("canvas");
  };

  const openViolation = (violation: StrictUiViolation) => {
    const location = violation.location;
    if (location.kind === "instance" || location.kind === "control") {
      setSelection({ kind: "component", id: location.instanceId });
      setPendingEditId(location.instanceId);
      setDefinitionEditor(false);
      setMobilePane("inspect");
    } else if (location.kind === "slot") {
      selectTarget({
        kind: "slot",
        id: `slot:${encodeURIComponent(location.instanceId)}:${encodeURIComponent(location.slotId)}`,
        componentInstanceId: location.instanceId,
        slotId: location.slotId,
      }, false);
      setMobilePane("tree");
    } else if (location.kind === "slot-outlet" && location.outletId) {
      setSelection({ kind: "slot-outlet", id: `outlet:${location.outletId}`, outletId: location.outletId, slotId: location.slotId });
      setMobilePane("tree");
    } else {
      setBrowserView("documents");
      setMobilePane("documents");
    }
    setShowStrictUi(false);
  };

  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#0d0e10] text-zinc-200">
      <style data-design-space-document-preview>{itemEditor.model?.previewCss ?? previewCss}</style>
      <WorkspaceTopBar
        targetLabel={target.project.label}
        documentLabel={document.label}
        mode={mode}
        connected={controller.connected}
        strictUi={controller.session?.strictUi}
        checking={controller.session?.phase === "checking"}
        canUndo={Boolean(controller.session?.past.length)}
        canRedo={Boolean(controller.session?.future.length)}
        canDiff={dirty && controller.connected && controller.session?.phase !== "stale" && tailwindReady}
        canSave={controller.session?.phase === "diff-ready" && Boolean(controller.session.prepared)}
        saving={controller.session?.phase === "saving"}
        onModeChange={switchMode}
        onUndo={controller.undo}
        onRedo={controller.redo}
        onReset={controller.reset}
        onStrictUi={() => setShowStrictUi(true)}
        onDiff={() => void controller.prepare().then((result) => {
          if (result?.state === "ready") setShowDiff(true);
          else if (result) setShowStrictUi(true);
        })}
        onSave={() => void controller.save().then((result) => result && setShowDiff(false))}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <WorkspaceBrowser
          className={`${mobilePane === "documents" || mobilePane === "files" || mobilePane === "catalog" ? "flex w-full" : "hidden"} lg:flex lg:w-60`}
          view={browserView}
          mode={mode}
          entries={controller.entries}
          files={controller.files}
          catalogEntries={catalog}
          activeDocumentId={controller.activeDocumentId}
          selectedComponentId={selectedCatalogId}
          canCreate={controller.creationRecipes.some((recipe) => recipe.kind === (mode === "app" ? "screen" : "component"))}
          onViewChange={(next) => {
            setBrowserView(next);
            if (mobilePane === "documents" || mobilePane === "files" || mobilePane === "catalog") setMobilePane(next);
          }}
          onModeChange={switchMode}
          onDocumentSelect={(id) => { controller.selectDocument(id); setMobilePane("canvas"); }}
          onCatalogSelect={selectCatalogEntry}
          onCreate={() => { setCreateError(undefined); setShowCreate(true); }}
        />
        <ComponentTree
          className={`${mobilePane === "tree" ? "flex w-full" : "hidden"} border-r-0 lg:flex lg:w-60 lg:border-r`}
          pageLabel={document.label}
          rows={rows}
          selectedId={selection.id}
          showInternals={showInternals}
          insertMode={insertMode}
          prompt={insertMode ? "Choose a slot with room, then pick a compatible component." : undefined}
          toggleLabel={document.kind === "component" ? "Show implementation" : undefined}
          toggleHint={document.kind === "component" ? "Public slots stay visible while internals collapse" : undefined}
          strictUiViolations={controller.liveViolations}
          onInsert={() => {
            setInsertMode((current) => !current);
            setSlotPicker(undefined);
            setMobilePane("tree");
          }}
          onSelect={selectTarget}
          onToggleInternals={() => setShowInternals((current) => !current)}
        />
        <div className={`${mobilePane === "canvas" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 lg:flex`}>
          <PreviewCanvas
            cameraKey={document.id}
            preview={<PreviewBoundary resetKey={`${document.id}:${itemEditor.model?.tailwindInput ?? tailwindInput}`}>{preview}</PreviewBoundary>}
            rootInstanceId={canvasRootId}
            selectedComponentInstanceId={canvasSelectedId}
            selection={canvasSelection}
            selectionLabel={canvasSelectionLabel}
            slots={canvasSlots}
            strictUiViolations={controller.liveViolations}
            onEditComponent={(instanceId) => {
              setSelection({ kind: "component", id: instanceId });
              setDefinitionEditor(false);
              itemEditor.open(instanceId);
            }}
            onDomSnapshot={setObservedDom}
            onSelect={selectTarget}
          />
          {definitionEditor ? (
            <DocumentDefinitionPanel className="hidden w-80 lg:flex" document={document} recipe={selectedRecipe} catalogComponents={catalogComponents} onChange={controller.edit} onEditImplementation={() => { setDefinitionEditor(false); itemEditor.open(document.root.instanceId); }} />
          ) : itemEditor.model ? (
            <DocumentInspector
              className="hidden w-80 lg:flex"
              componentLabel={itemEditor.model.adapter.component.label}
              sourceLabel={itemEditor.model.adapter.sourceFileId ? controller.files.find((file) => file.id === itemEditor.model?.adapter.sourceFileId)?.label : undefined}
              controls={itemEditor.model.adapter.controls}
              values={itemEditor.model.controlValues}
              slots={itemEditor.model.slots}
              compileError={itemEditor.model.compileError}
              compilePending={itemEditor.model.compilePending}
              canMoveUp={Boolean(itemEditor.model.location && itemEditor.model.location.index > 0)}
              canMoveDown={Boolean(itemEditor.model.location && itemEditor.model.location.index < itemEditor.model.location.siblingCount - 1)}
              canDuplicate={itemEditor.model.canDuplicate}
              canDelete={itemEditor.model.canDelete}
              onEditDefinition={() => { itemEditor.close(); setDefinitionEditor(true); }}
              onControlChange={itemEditor.updateControl}
              onSelectSlot={(slot) => selectTarget({ kind: "slot", id: slot.selectionId, componentInstanceId: itemEditor.model!.instance.instanceId, slotId: slot.id })}
              onMove={itemEditor.move}
              onDuplicate={itemEditor.duplicate}
              onDelete={itemEditor.remove}
              onApply={itemEditor.apply}
              onCancel={itemEditor.close}
            />
          ) : <InspectorPrompt onEdit={() => itemEditor.open(selectedNode.instanceId)} />}
        </div>
        {mobilePane === "inspect" && definitionEditor && <DocumentDefinitionPanel className="flex w-full border-l-0 lg:hidden" document={document} recipe={selectedRecipe} catalogComponents={catalogComponents} onChange={controller.edit} onEditImplementation={() => { setDefinitionEditor(false); itemEditor.open(document.root.instanceId); }} />}
      </div>
      <footer aria-live="polite" className="flex h-6 shrink-0 items-center border-t border-white/10 bg-[#101113] px-3 text-[9px] text-zinc-600" role="status"><span className={`mr-2 size-1.5 rounded-full ${workspaceStatusTone(controller.session?.phase, controller.connected, previewError)}`} /><span className="truncate">{previewError ?? controller.message ?? workspaceStatusText(controller.session?.phase, dirty)}</span><span className="ml-auto hidden lg:block">Local only · registered targets · current evidence required</span></footer>
      <MobileDock active={mobilePane} onChange={(pane) => {
        setInsertMode(false);
        if (pane === "documents" || pane === "files" || pane === "catalog") setBrowserView(pane);
        if (pane === "inspect") {
          if (definitionEditor && selection.kind === "component" && selection.id === document.root.instanceId) {
            setMobilePane("inspect");
          } else {
            setDefinitionEditor(false);
            itemEditor.open(selectedNode.instanceId);
          }
        } else setMobilePane(pane);
      }} />
      {showDiff && controller.session?.prepared && (
        <DiffSheet
          diff={controller.session.prepared.exactDiff}
          saving={controller.session.phase === "saving"}
          onClose={() => setShowDiff(false)}
          onSave={() => void controller.save().then((result) => result && setShowDiff(false))}
        />
      )}
      <SlotCatalogDialog open={Boolean(slotPicker)} slotLabel={pickerSlot?.label ?? "slot"} entries={pickerEntries} onClose={() => { setInsertMode(false); setSlotPicker(undefined); }} onSelect={(id) => slotPicker && insertComponent(id, slotPicker)} />
      <CreateDocumentSheet open={showCreate} mode={mode} recipes={controller.creationRecipes} busy={createBusy} error={createError} onClose={() => setShowCreate(false)} onPrepare={(recipeId, label) => void prepareCreate(recipeId, label)} />
      {preparedCreate && <DiffSheet diff={preparedCreate.diff} saving={createSaving} onClose={() => setPreparedCreate(undefined)} onSave={() => void saveCreate()} />}
      <StrictUiSheet open={showStrictUi} evidence={controller.session?.strictUi} liveViolations={controller.liveViolations} checking={controller.session?.phase === "checking"} onClose={() => setShowStrictUi(false)} onSelect={openViolation} onRecheck={() => void controller.prepare()} />
      {itemEditor.model && (
        <MobileItemEditor
          componentLabel={itemEditor.model.adapter.component.label}
          sourceLabel={itemEditor.model.adapter.sourceFileId ? controller.files.find((file) => file.id === itemEditor.model?.adapter.sourceFileId)?.label : undefined}
          controls={itemEditor.model.adapter.controls}
          controlValues={itemEditor.model.controlValues}
          preview={<PreviewBoundary resetKey={`${itemEditor.model.session.draft.id}:${itemEditor.model.tailwindInput}`}>{itemEditor.model.preview}</PreviewBoundary>}
          previewCss={itemEditor.model.previewCss}
          rootInstanceId={itemEditor.model.view.root.instanceId}
          selectedInstanceId={itemEditor.model.instance.instanceId}
          slots={itemEditor.model.slots}
          compileError={itemEditor.model.compileError}
          compilePending={itemEditor.model.compilePending}
          sourceBacked
          canMoveUp={Boolean(itemEditor.model.location && itemEditor.model.location.index > 0)}
          canMoveDown={Boolean(itemEditor.model.location && itemEditor.model.location.index < itemEditor.model.location.siblingCount - 1)}
          canDuplicate={itemEditor.model.canDuplicate}
          canDelete={itemEditor.model.canDelete}
          onControlChange={itemEditor.updateControl}
          onSelectComponent={itemEditor.selectComponent}
          onEditDefinition={() => {
            itemEditor.close();
            setDefinitionEditor(true);
            setMobilePane("inspect");
          }}
          onSelectSlot={(slot) => {
            const instanceId = itemEditor.model?.instance.instanceId;
            if (!instanceId) return;
            itemEditor.close();
            selectTarget({ kind: "slot", id: slot.selectionId, componentInstanceId: instanceId, slotId: slot.id });
            setMobilePane(slot.count ? "tree" : "canvas");
          }}
          onMove={itemEditor.move}
          onDuplicate={itemEditor.duplicate}
          onDelete={itemEditor.remove}
          onCancel={() => {
            itemEditor.close();
            setMobilePane("canvas");
          }}
          onApply={() => {
            itemEditor.apply();
            setMobilePane("canvas");
          }}
        />
      )}
    </div>
  );
}

function childLabel(target: TargetModule, library: readonly DesignDocument[], parent: DesignDocument["root"], slotId: string) {
  const child = parent.slots[slotId]?.[0];
  if (!child) return undefined;
  if (child.kind === "text") return "Text";
  if (child.kind === "slot-outlet") return "Slot outlet";
  return resolveDocumentAdapter(target, library, child.node.adapterId)?.component.label;
}
