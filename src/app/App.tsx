import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import target from "virtual:design-space-target";

import { createEditorState, editorReducer, isDirty } from "../editor";
import { projectPreviewSlots, type SelectionTarget } from "../model";
import type { PreparedEdit, SavedEdit, SourceSnapshot, TailwindPreview } from "../shared/contracts";
import type { ComponentFixture } from "../shared/target-module";
import { ActivityRail, type WorkspaceMode } from "./components/ActivityRail";
import { CatalogPanel } from "./components/CatalogPanel";
import { ComponentTree } from "./components/ComponentTree";
import { DiffSheet } from "./components/DiffSheet";
import { FileBrowser } from "./components/FileBrowser";
import { Inspector } from "./components/Inspector";
import { MobileItemEditor } from "./components/MobileItemEditor";
import { MobileNavigation, type MobileWorkspaceMode } from "./components/MobileNavigation";
import { PreviewCanvas } from "./components/PreviewCanvas";
import { SlotCatalogDialog } from "./components/SlotCatalogDialog";
import { TopBar } from "./components/TopBar";
import { LocalOperationError, runLocalOperation } from "./api";
import { PreviewBoundary } from "./PreviewBoundary";
import {
  appendFixtureChild,
  createTargetViewModel,
  findComponentFixture,
  findComponentInstance,
  renderTargetFixture,
  resolveFixtureProps,
  type TargetViewModel,
} from "./target-model";
import type { SlotState } from "./types";
import { useItemEditor } from "./use-item-editor";
import { DocumentWorkspace } from "./DocumentWorkspace";
import { createPortableDraftId } from "./document/design-id";
import { isLegacyPrepareCompileFailure } from "./legacy-prepare-error";
import { usesDocumentWorkspace } from "./workspace-selection";

const initialVersion = "0".repeat(64);
type TargetResult = { view: TargetViewModel; error?: never } | { view?: never; error: string };
type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
type FixtureUndo = { fixture: ComponentFixture; compositionCss: Readonly<Record<string, string>>; undoRootEdit: boolean };

export function App() {
  return usesDocumentWorkspace(target) ? <DocumentWorkspace target={target} /> : <LegacyWorkspace />;
}

function LegacyWorkspace() {
  const [showInternals, setShowInternals] = useState(false);
  const [fixture, setFixture] = useState<ComponentFixture>(target.defaultFixture);
  const [fixtureUndoStack, setFixtureUndoStack] = useState<FixtureUndo[]>([]);
  const targetResult = useMemo<TargetResult>(() => {
    try {
      return { view: createTargetViewModel(target, showInternals, fixture) } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The target adapter is invalid." } as const;
    }
  }, [fixture, showInternals]);
  const initialClassName = getInitialClassName();
  const [editor, dispatch] = useReducer(editorReducer, createEditorState(initialClassName, initialVersion));
  const [connected, setConnected] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>(() => initialSelection(targetResult));
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("tree");
  const [mobileMode, setMobileMode] = useState<MobileWorkspaceMode>("preview");
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>();
  const [showDiff, setShowDiff] = useState(false);
  const [slotPicker, setSlotPicker] = useState<SlotSelection>();
  const [runtimeMessage, setRuntimeMessage] = useState<string>();
  const [previewCss, setPreviewCss] = useState("");
  const [previewValue, setPreviewValue] = useState<string>();
  const [compositionCss, setCompositionCss] = useState<Readonly<Record<string, string>>>({});
  const sourceReadSequence = useRef(0);
  const editTargetId = target.defaultEditTargetId;
  const commitFixture = useCallback((next: ComponentFixture, metadata?: { undoRootEdit?: boolean }) => {
    if (next === fixture) return;
    setFixtureUndoStack((history) => [...history, {
      fixture,
      compositionCss,
      undoRootEdit: Boolean(metadata?.undoRootEdit),
    }]);
    setFixture(next);
  }, [compositionCss, fixture]);

  const readSource = useCallback(async () => {
    if (!editTargetId) {
      setConnected(true);
      return;
    }
    const readId = ++sourceReadSequence.current;
    try {
      const snapshot = await runLocalOperation<SourceSnapshot>({ type: "read-source", editTargetId });
      if (readId !== sourceReadSequence.current) return;
      dispatch({ type: "source-changed", value: snapshot.value, sourceVersion: snapshot.version });
      setConnected(true);
      setRuntimeMessage(undefined);
    } catch (error) {
      if (readId !== sourceReadSequence.current) return;
      setConnected(false);
      setRuntimeMessage(messageFor(error));
    }
  }, [editTargetId]);

  useEffect(() => {
    void readSource();
    const onFocus = () => void readSource();
    const sourceWatch = window.setInterval(() => void readSource(), 2_000);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(sourceWatch);
      window.removeEventListener("focus", onFocus);
    };
  }, [readSource]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await runLocalOperation<TailwindPreview>({ type: "compile-tailwind", value: editor.draftValue });
        if (!cancelled) {
          setPreviewCss(result.css);
          setPreviewValue(result.value);
          setRuntimeMessage(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: "compile-failed", message: messageFor(error) });
          setRuntimeMessage(messageFor(error));
        }
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connected, editor.draftValue]);


  const prepare = useCallback(async () => {
    if (!connected || !editTargetId || !isDirty(editor)) return undefined;
    const draftValue = editor.draftValue;
    try {
      const prepared = await runLocalOperation<PreparedEdit>({
        type: "prepare-edit",
        editTargetId,
        baseVersion: editor.sourceVersion,
        value: draftValue,
      });
      dispatch({
        type: "prepare-succeeded",
        preparedEditId: prepared.challengeId,
        sourceVersion: prepared.baseVersion,
        draftValue,
        exactDiff: prepared.diff,
      });
      setRuntimeMessage(undefined);
      setShowDiff(true);
      return prepared;
    } catch (error) {
      if (error instanceof LocalOperationError && error.code === "STALE_SOURCE") await readSource();
      else if (isLegacyPrepareCompileFailure(error)) dispatch({ type: "compile-failed", message: messageFor(error) });
      else dispatch({ type: "prepare-failed" });
      setRuntimeMessage(messageFor(error));
      return undefined;
    }
  }, [connected, editTargetId, editor, readSource]);

  const save = useCallback(async () => {
    const prepared = editor.preparedEdit;
    if (!prepared || editor.phase !== "diff-ready") return;
    const preparedEditId = prepared.id;
    dispatch({ type: "save-started", preparedEditId });
    try {
      const result = await runLocalOperation<SavedEdit>({ type: "save-edit", challengeId: preparedEditId });
      dispatch({ type: "save-succeeded", preparedEditId, savedValue: result.value, sourceVersion: result.version });
      setShowDiff(false);
      setRuntimeMessage(undefined);
      await readSource();
      window.setTimeout(() => dispatch({ type: "preview-ready" }), 900);
    } catch (error) {
      const staleSource = error instanceof LocalOperationError && error.code === "STALE_SOURCE";
      dispatch({
        type: "save-failed",
        preparedEditId,
        reason: staleSource ? "stale-source" : "transient",
      });
      if (staleSource) await readSource();
      setRuntimeMessage(messageFor(error));
    }
  }, [editor.phase, editor.preparedEdit, readSource]);

  const itemEditorController = useItemEditor({
    target,
    fixture,
    rootClassValue: editor.draftValue,
    connected,
    basePreviewCss: previewCss,
    compositionCss,
    createId: createPortableDraftId,
    onCommitFixture: commitFixture,
    onApplyRootClass: (value) => dispatch({ type: "edit", value }),
    onApplyCompositionCss: (instanceId, css) => setCompositionCss((current) => ({ ...current, [instanceId]: css })),
    onSelect: setSelection,
  });

  if (!targetResult.view) return <BlockedTarget message={targetResult.error ?? "The target adapter is invalid."} />;

  const { view } = targetResult;
  const selectedComponentInstanceId = selection.kind === "slot"
    ? selection.componentInstanceId
    : selection.kind === "component" ? selection.id : view.root.instanceId;
  const selectedInstance = findComponentInstance(view.root, selectedComponentInstanceId) ?? view.root;
  const selectedFixture = findComponentFixture(fixture, selectedInstance.instanceId) ?? fixture;
  const selectedAdapter = target.adapters.find((adapter) => adapter.component.id === selectedInstance.componentId)!;
  const selectedProps = resolveFixtureProps(target, selectedFixture);
  const slots: SlotState[] = projectPreviewSlots(view.catalog, selectedInstance).map((slot) => ({
    id: slot.selection.slotId,
    selectionId: slot.selection.id,
    label: slot.label,
    count: slot.childCount,
    childLabel: childLabel(selectedFixture, slot.selection.slotId),
  }));
  const catalogEntries = target.adapters.map((item) => ({ ...item.component, slotCount: item.component.slots.length }));
  const pickerParent = slotPicker ? findComponentInstance(view.root, slotPicker.componentInstanceId) : undefined;
  const pickerParentAdapter = target.adapters.find((adapter) => adapter.component.id === pickerParent?.componentId);
  const pickerSlot = pickerParentAdapter?.component.slots.find((slot) => slot.id === slotPicker?.slotId);
  const pickerEntries = catalogEntries.filter((entry) => {
    if (!pickerSlot || pickerSlot.max === 0 || pickerSlot.accepts && !pickerSlot.accepts.includes(entry.id)) return false;
    const adapter = target.adapters.find((candidate) => candidate.component.id === entry.id);
    return !adapter?.component.slots.some((slot) => (slot.min ?? 0) > 0);
  });
  const selectTarget = (next: SelectionTarget) => {
    setSelection(next);
    if (next.kind !== "slot") return;
    const parent = findComponentFixture(fixture, next.componentInstanceId);
    if ((parent?.slots[next.slotId]?.length ?? 0) === 0) setSlotPicker(next);
  };
  const editable = connected && Boolean(editTargetId) && selectedInstance.instanceId === view.root.instanceId;
  const tailwindReady = previewValue === editor.draftValue;
  const preview = renderTargetFixture(target, fixture, { className: editor.draftValue });
  const selectionLabel = selection.kind === "slot"
    ? slots.find((slot) => slot.id === selection.slotId)?.label ?? "Slot"
    : selectedAdapter.component.label;
  const inspectorProps = {
    componentLabel: selectedAdapter.component.label,
    sourceLabel: target.files.find((file) => file.id === selectedAdapter.component.sourceFileId)?.label,
    editable,
    classNameValue: selectedInstance.instanceId === view.root.instanceId
      ? editor.draftValue
      : typeof selectedProps.className === "string" ? selectedProps.className : "",
    selection,
    slots,
    onClassNameChange: (value: string) => dispatch({ type: "edit" as const, value }),
    onSelectSlot: (slot: SlotState) => selectTarget({
      kind: "slot", id: slot.selectionId, componentInstanceId: selectedInstance.instanceId, slotId: slot.id,
    }),
    onAddToSlot: (slot: SlotState) => {
      const next = { kind: "slot", id: slot.selectionId, componentInstanceId: selectedInstance.instanceId, slotId: slot.id } as const;
      setSelection(next);
      setSlotPicker(next);
    },
  };

  const insertCatalogComponent = (adapterId: string, targetSlot: SlotSelection) => {
    setSelectedCatalogId(adapterId);
    const childAdapter = target.adapters.find((adapter) => adapter.component.id === adapterId);
    const parentInstance = findComponentInstance(view.root, targetSlot.componentInstanceId);
    const parentFixture = findComponentFixture(fixture, targetSlot.componentInstanceId);
    const parentAdapter = target.adapters.find((adapter) => adapter.component.id === parentInstance?.componentId);
    const parentSlot = parentAdapter?.component.slots.find((slot) => slot.id === targetSlot.slotId);
    const currentChildren = parentFixture?.slots[targetSlot.slotId] ?? [];
    if (!childAdapter || !parentSlot || parentSlot.accepts && !parentSlot.accepts.includes(adapterId)) {
      setRuntimeMessage("That component is not accepted by the selected slot.");
      return false;
    }
    if (parentSlot.max !== undefined && currentChildren.length >= parentSlot.max) {
      setRuntimeMessage("The selected slot is already at its maximum size.");
      return false;
    }
    if (childAdapter.component.slots.some((slot) => (slot.min ?? 0) > 0)) {
      setRuntimeMessage("That component requires a target-owned fixture before it can be inserted.");
      return false;
    }
    const child: ComponentFixture = {
      instanceId: createPortableDraftId(),
      adapterId,
      props: childAdapter.defaultProps,
      slots: Object.fromEntries(childAdapter.component.slots.map((slot) => [slot.id, []])),
    };
    commitFixture(appendFixtureChild(
      fixture,
      targetSlot.componentInstanceId,
      targetSlot.slotId,
      { kind: "component", node: child },
    ));
    setRuntimeMessage(undefined);
    setWorkspaceMode("tree");
    setMobileMode("preview");
    return true;
  };
  const browseCatalogComponent = (adapterId: string) => { setSelectedCatalogId(adapterId); };
  const selectPickerComponent = (adapterId: string) => {
    if (slotPicker && insertCatalogComponent(adapterId, slotPicker)) setSlotPicker(undefined);
  };

  const status = statusLabel(editor.phase, isDirty(editor), connected, fixture !== target.defaultFixture);
  const statusDot = runtimeMessage
    ? "bg-rose-400"
    : editor.phase === "stale" ? "bg-amber-400" : connected ? "bg-emerald-400" : "bg-zinc-500";

  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#0d0e10] text-zinc-200">
      <style data-design-space-tailwind-preview>{`${previewCss}\n${Object.values(compositionCss).join("\n")}`}</style>
      <TopBar
        targetLabel={target.project.label}
        connected={connected}
        runtimeLabel={connected ? "Preview ready" : "Connecting…"}
        canUndo={fixtureUndoStack.length > 0 || editor.undoStack.length > 0}
        canDiff={editable && tailwindReady && isDirty(editor) && editor.phase !== "stale" && editor.phase !== "compile-error"}
        canSave={editable && tailwindReady && editor.phase === "diff-ready" && Boolean(editor.preparedEdit)}
        saveLabel={editor.phase === "saving" ? "Saving…" : "Save"}
        onUndo={() => {
          const previous = fixtureUndoStack.at(-1);
          if (previous) {
            setFixture(previous.fixture);
            setCompositionCss(previous.compositionCss);
            if (previous.undoRootEdit) dispatch({ type: "undo" });
            setFixtureUndoStack((history) => history.slice(0, -1));
            setSelection({ kind: "component", id: previous.fixture.instanceId });
            itemEditorController.close();
          } else dispatch({ type: "undo" });
        }}
        onReset={() => {
          if (editor.phase === "stale" && !editor.staleSource) {
            void readSource();
            return;
          }
          dispatch({ type: "reset" });
          setFixture(target.defaultFixture);
          setFixtureUndoStack([]);
          setCompositionCss({});
          setSelection(initialSelection(safeInitialView()));
          setRuntimeMessage(undefined);
          setShowDiff(false);
          setSlotPicker(undefined);
          itemEditorController.close();
        }}
        onDiff={() => void prepare()}
        onSave={() => void save()}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <ActivityRail className="hidden lg:flex" active={workspaceMode} onChange={setWorkspaceMode} />

        {mobileMode !== "preview" && (
          <div className="flex min-h-0 min-w-0 flex-1 lg:hidden">
            {mobileMode === "tree" && <ComponentTree className="flex w-full border-r-0" pageLabel={target.defaultFixture.label ?? target.project.label} rows={view.rows} selectedId={selection.id} showInternals={showInternals} onSelect={selectTarget} onToggleInternals={() => setShowInternals((value) => !value)} />}
            {mobileMode === "files" && <FileBrowser className="flex w-full border-r-0" files={target.files} selectedId={selectedFileId} onSelect={setSelectedFileId} />}
            {mobileMode === "catalog" && <CatalogPanel className="flex w-full border-r-0" entries={catalogEntries} selectedId={selectedCatalogId} onSelect={browseCatalogComponent} />}
            {mobileMode === "inspector" && <Inspector className="flex w-full border-l-0" {...inspectorProps} />}
          </div>
        )}

        {workspaceMode === "tree" && <ComponentTree className="hidden w-64 lg:flex" pageLabel={target.defaultFixture.label ?? target.project.label} rows={view.rows} selectedId={selection.id} showInternals={showInternals} onSelect={selectTarget} onToggleInternals={() => setShowInternals((value) => !value)} />}
        {workspaceMode === "files" && <FileBrowser className="hidden w-64 lg:flex" files={target.files} selectedId={selectedFileId} onSelect={setSelectedFileId} />}
        {(workspaceMode === "catalog" || workspaceMode === "search") && <CatalogPanel className="hidden w-64 lg:flex" entries={catalogEntries} selectedId={selectedCatalogId} onSelect={browseCatalogComponent} />}
        {workspaceMode === "inspector" && <Inspector className="hidden w-72 lg:flex xl:hidden" {...inspectorProps} />}
        <div className={`${mobileMode === "preview" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 lg:flex`}>
          <PreviewCanvas
            preview={<PreviewBoundary resetKey={editor.draftValue}>{preview}</PreviewBoundary>}
            rootInstanceId={view.root.instanceId}
            selectedComponentInstanceId={selectedInstance.instanceId}
            selection={selection}
            selectionLabel={selectionLabel}
            slots={slots}
            onEditComponent={(instanceId) => {
              if (isMobileWorkspace()) itemEditorController.open(instanceId);
            }}
            onSelect={selectTarget}
          />
          <Inspector className="hidden w-72 xl:flex" {...inspectorProps} />
        </div>
      </div>
      <footer aria-live="polite" className="flex h-6 shrink-0 items-center border-t border-white/10 bg-[#101113] px-3 text-[9px] text-zinc-600" role="status">
        <span className={`mr-2 size-1.5 shrink-0 rounded-full ${statusDot}`} />
        <span className="truncate">{runtimeMessage ?? status}</span>
        <span className="ml-auto hidden shrink-0 lg:block">Local runtime · writes confined to registered targets</span>
      </footer>
      <MobileNavigation
        active={mobileMode}
        onChange={(mode) => {
          if (mode === "inspector" && selection.kind === "component") itemEditorController.open(selection.id);
          else setMobileMode(mode);
        }}
      />
      {showDiff && editor.preparedEdit && (
        <DiffSheet
          diff={editor.preparedEdit.exactDiff}
          saving={editor.phase === "saving"}
          onClose={() => setShowDiff(false)}
          onSave={() => void save()}
        />
      )}
      <SlotCatalogDialog open={Boolean(slotPicker)} slotLabel={pickerSlot?.label ?? "slot"} entries={pickerEntries} onClose={() => setSlotPicker(undefined)} onSelect={selectPickerComponent} />
      {itemEditorController.model && (
        <MobileItemEditor
          componentLabel={itemEditorController.model.adapter.component.label}
          sourceLabel={target.files.find((file) => file.id === itemEditorController.model?.adapter.component.sourceFileId)?.label}
          controls={itemEditorController.model.adapter.controls ?? []}
          controlValues={itemEditorController.model.controlValues}
          preview={itemEditorController.model.preview}
          previewCss={itemEditorController.model.previewCss}
          rootInstanceId={itemEditorController.model.view.root.instanceId}
          selectedInstanceId={itemEditorController.model.instance.instanceId}
          slots={itemEditorController.model.slots}
          compileError={itemEditorController.model.compileError}
          compilePending={itemEditorController.model.compilePending}
          sourceBacked={itemEditorController.model.sourceBacked}
          canMoveUp={Boolean(itemEditorController.model.location && itemEditorController.model.location.index > 0)}
          canMoveDown={Boolean(itemEditorController.model.location && itemEditorController.model.location.index < itemEditorController.model.location.siblingCount - 1)}
          canDuplicate={itemEditorController.model.canDuplicate}
          canDelete={itemEditorController.model.canDelete}
          onControlChange={itemEditorController.updateControl}
          onSelectComponent={itemEditorController.selectComponent}
          onSelectSlot={(slot) => {
            const instanceId = itemEditorController.model?.instance.instanceId;
            if (!instanceId) return;
            itemEditorController.close();
            selectTarget({ kind: "slot", id: slot.selectionId, componentInstanceId: instanceId, slotId: slot.id });
            setMobileMode(slot.count ? "tree" : "preview");
          }}
          onMove={itemEditorController.move}
          onDuplicate={itemEditorController.duplicate}
          onDelete={itemEditorController.remove}
          onCancel={itemEditorController.close}
          onApply={itemEditorController.apply}
        />
      )}
    </div>
  );

  function childLabel(parent: ComponentFixture, slotId: string) {
    const child = parent.slots[slotId]?.[0];
    if (!child) return undefined;
    if (child.kind === "text") return "Text";
    return target.adapters.find((adapter) => adapter.component.id === child.node.adapterId)?.component.label;
  }
}

function initialSelection(result: TargetResult): SelectionTarget {
  if (result.view) return result.view.slots.find((slot) => !slot.occupied)?.selection ?? { kind: "component", id: result.view.root.instanceId };
  return { kind: "component", id: "unavailable" };
}

function safeInitialView(): TargetResult {
  try { return { view: createTargetViewModel(target, false) } as const; }
  catch (error) { return { error: error instanceof Error ? error.message : "The target adapter is invalid." } as const; }
}

function getInitialClassName() {
  const fixtureClass = target.defaultFixture?.props?.className;
  return typeof fixtureClass === "string" ? fixtureClass : typeof target.defaultProps?.className === "string" ? target.defaultProps.className : "";
}

function statusLabel(phase: string, dirty: boolean, connected: boolean, compositionDraft: boolean) {
  if (!connected) return "Connecting to the registered local target";
  if (phase === "stale") return "Source changed outside Design Space · Reset to reload";
  if (phase === "compile-error") return "Preview error · edit or Reset to recover";
  if (phase === "saved") return "Saved locally";
  if (compositionDraft) return "Composition preview draft · target fixture unchanged";
  if (dirty) return "Live draft · source unchanged";
  return "Saved source · no unsaved changes";
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "The local operation failed.";
}

function isMobileWorkspace() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function BlockedTarget({ message }: { message: string }) {
  return <main className="grid h-dvh place-items-center bg-[#0d0e10] p-8 text-center text-zinc-200"><div><p className="text-sm font-medium text-rose-300">Target adapter blocked</p><p className="mt-2 max-w-md text-xs text-zinc-500">{message}</p></div></main>;
}
