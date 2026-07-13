import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
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
import { PreviewCanvas } from "./components/PreviewCanvas";
import { TopBar } from "./components/TopBar";
import { LocalOperationError, runLocalOperation } from "./api";
import { PreviewBoundary } from "./PreviewBoundary";
import {
  appendFixtureChild,
  createTargetViewModel,
  findComponentFixture,
  findComponentInstance,
  renderTargetFixture,
  type TargetViewModel,
} from "./target-model";
import type { SlotState } from "./types";

const initialVersion = "0".repeat(64);
let draftInstanceSequence = 0;
type TargetResult = { view: TargetViewModel; error?: never } | { view?: never; error: string };

export function App() {
  const [showInternals, setShowInternals] = useState(false);
  const [fixture, setFixture] = useState<ComponentFixture>(target.defaultFixture);
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
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>();
  const [showDiff, setShowDiff] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState<string>();
  const [previewCss, setPreviewCss] = useState("");
  const [previewValue, setPreviewValue] = useState<string>();
  const editTargetId = target.defaultEditTargetId;

  const readSource = useCallback(async () => {
    if (!editTargetId) {
      setConnected(true);
      return;
    }
    try {
      const snapshot = await runLocalOperation<SourceSnapshot>({ type: "read-source", editTargetId });
      dispatch({ type: "source-changed", value: snapshot.value, sourceVersion: snapshot.version });
      setConnected(true);
      setRuntimeMessage(undefined);
    } catch (error) {
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
      else dispatch({ type: "compile-failed", message: messageFor(error) });
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
      window.setTimeout(() => dispatch({ type: "preview-ready" }), 900);
    } catch (error) {
      if (error instanceof LocalOperationError && error.code === "STALE_SOURCE") await readSource();
      setRuntimeMessage(messageFor(error));
    }
  }, [editor.phase, editor.preparedEdit, readSource]);

  if (!targetResult.view) return <BlockedTarget message={targetResult.error ?? "The target adapter is invalid."} />;

  const { view } = targetResult;
  const selectedComponentInstanceId = selection.kind === "slot"
    ? selection.componentInstanceId
    : selection.kind === "component" ? selection.id : view.root.instanceId;
  const selectedInstance = findComponentInstance(view.root, selectedComponentInstanceId) ?? view.root;
  const selectedFixture = findComponentFixture(fixture, selectedInstance.instanceId) ?? fixture;
  const selectedAdapter = target.adapters.find((adapter) => adapter.component.id === selectedInstance.componentId)!;
  const slots: SlotState[] = projectPreviewSlots(view.catalog, selectedInstance).map((slot) => ({
    id: slot.selection.slotId,
    selectionId: slot.selection.id,
    label: slot.label,
    count: slot.childCount,
    childLabel: childLabel(selectedFixture, slot.selection.slotId),
  }));
  const editable = connected && Boolean(editTargetId) && selectedInstance.instanceId === view.root.instanceId;
  const tailwindReady = previewValue === editor.draftValue;
  const preview = renderTargetFixture(target, fixture, { className: editor.draftValue });
  const inspectorProps = {
    componentLabel: selectedAdapter.component.label,
    sourceLabel: target.files.find((file) => file.id === selectedAdapter.component.sourceFileId)?.label,
    editable,
    classNameValue: selectedInstance.instanceId === view.root.instanceId
      ? editor.draftValue
      : typeof selectedFixture.props?.className === "string" ? selectedFixture.props.className : "",
    selection,
    slots,
    onClassNameChange: (value: string) => dispatch({ type: "edit" as const, value }),
    onSelectSlot: (slot: SlotState) => setSelection({
      kind: "slot",
      id: slot.selectionId,
      componentInstanceId: selectedInstance.instanceId,
      slotId: slot.id,
    }),
    onAddToSlot: () => setWorkspaceMode("catalog" as const),
  };

  const selectCatalogComponent = (adapterId: string) => {
    setSelectedCatalogId(adapterId);
    if (selection.kind !== "slot") return;
    const childAdapter = target.adapters.find((adapter) => adapter.component.id === adapterId);
    const parentInstance = findComponentInstance(view.root, selection.componentInstanceId);
    const parentFixture = findComponentFixture(fixture, selection.componentInstanceId);
    const parentAdapter = target.adapters.find((adapter) => adapter.component.id === parentInstance?.componentId);
    const parentSlot = parentAdapter?.component.slots.find((slot) => slot.id === selection.slotId);
    const currentChildren = parentFixture?.slots[selection.slotId] ?? [];
    if (!childAdapter || !parentSlot || parentSlot.accepts && !parentSlot.accepts.includes(adapterId)) {
      setRuntimeMessage("That component is not accepted by the selected slot.");
      return;
    }
    if (parentSlot.max !== undefined && currentChildren.length >= parentSlot.max) {
      setRuntimeMessage("The selected slot is already at its maximum size.");
      return;
    }
    if (childAdapter.component.slots.some((slot) => (slot.min ?? 0) > 0)) {
      setRuntimeMessage("That component requires a target-owned fixture before it can be inserted.");
      return;
    }
    const child: ComponentFixture = {
      instanceId: `draft-${++draftInstanceSequence}`,
      adapterId,
      slots: Object.fromEntries(childAdapter.component.slots.map((slot) => [slot.id, []])),
    };
    setFixture((current) => appendFixtureChild(
      current,
      selection.componentInstanceId,
      selection.slotId,
      { kind: "component", node: child },
    ));
    setRuntimeMessage(undefined);
    setWorkspaceMode("tree");
  };

  return (
    <div className="flex h-dvh min-w-[720px] flex-col overflow-hidden bg-[#0d0e10] text-zinc-200">
      <style data-design-space-tailwind-preview>{previewCss}</style>
      <TopBar
        targetLabel={target.project.label}
        connected={connected}
        runtimeLabel={connected ? "Preview ready" : "Connecting…"}
        canUndo={editor.undoStack.length > 0}
        canDiff={editable && tailwindReady && isDirty(editor) && editor.phase !== "stale" && editor.phase !== "compile-error"}
        canSave={editable && tailwindReady && editor.phase === "diff-ready" && Boolean(editor.preparedEdit)}
        saveLabel={editor.phase === "saving" ? "Saving…" : "Save"}
        onUndo={() => dispatch({ type: "undo" })}
        onReset={() => { dispatch({ type: "reset" }); setFixture(target.defaultFixture); setSelection(initialSelection(safeInitialView())); setRuntimeMessage(undefined); setShowDiff(false); }}
        onDiff={() => void prepare()}
        onSave={() => void save()}
      />
      <div className="flex min-h-0 flex-1">
        <ActivityRail active={workspaceMode} onChange={setWorkspaceMode} />
        {workspaceMode === "tree" && <ComponentTree pageLabel={target.defaultFixture.label ?? target.project.label} rows={view.rows} selectedId={selection.id} showInternals={showInternals} onSelect={setSelection} onToggleInternals={() => setShowInternals((value) => !value)} />}
        {workspaceMode === "files" && <FileBrowser files={target.files} selectedId={selectedFileId} onSelect={setSelectedFileId} />}
        {(workspaceMode === "catalog" || workspaceMode === "search") && <CatalogPanel entries={target.adapters.map((item) => ({ ...item.component, slotCount: item.component.slots.length }))} selectedId={selectedCatalogId} onSelect={selectCatalogComponent} />}
        {workspaceMode === "inspector" && <Inspector className="flex xl:hidden" {...inspectorProps} />}
        <div className="relative flex min-w-0 flex-1">
          <PreviewCanvas preview={<PreviewBoundary resetKey={editor.draftValue}>{preview}</PreviewBoundary>} rootInstanceId={view.root.instanceId} selectedComponentInstanceId={selectedInstance.instanceId} slots={slots} selection={selection} onSelect={setSelection} />
          <Inspector className="hidden xl:flex" {...inspectorProps} />
          {showDiff && editor.preparedEdit && <DiffSheet diff={editor.preparedEdit.exactDiff} onClose={() => setShowDiff(false)} />}
        </div>
      </div>
      <footer className="flex h-6 shrink-0 items-center border-t border-white/10 bg-[#101113] px-3 text-[9px] text-zinc-600">
        <span className={`mr-2 size-1.5 rounded-full ${runtimeMessage ? "bg-rose-400" : editor.phase === "stale" ? "bg-amber-400" : connected ? "bg-emerald-400" : "bg-zinc-500"}`} />
        <span>{runtimeMessage ?? statusLabel(editor.phase, isDirty(editor), connected, fixture !== target.defaultFixture)}</span>
        <span className="ml-auto">Local runtime · writes confined to registered targets</span>
      </footer>
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

function BlockedTarget({ message }: { message: string }) {
  return <main className="grid h-dvh place-items-center bg-[#0d0e10] p-8 text-center text-zinc-200"><div><p className="text-sm font-medium text-rose-300">Target adapter blocked</p><p className="mt-2 max-w-md text-xs text-zinc-500">{message}</p></div></main>;
}
