import type { SelectionTarget } from "../../model";
import type { DesignDocument } from "../../shared/design-document";
import type { StrictUiViolation } from "../../shared/strict-ui";
import type { WorkspaceBrowserView } from "../documents/WorkspaceBrowser";
import type { MobilePane } from "../shell/MobileDock";
import { findDesignNode } from "./document-commands";
import type { useDocumentItemEditor } from "./use-document-item-editor";
import type { useDocumentSelectionInteractions } from "./use-document-selection-interactions";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
type ItemEditor = Pick<ReturnType<typeof useDocumentItemEditor>, "model" | "open" | "close" | "selectComponent">;
type SelectionInteractions = Pick<ReturnType<typeof useDocumentSelectionInteractions>, "selectTarget">;

export function createDocumentWorkspaceRouting(options: {
  document: DesignDocument;
  selection: SelectionTarget;
  selectedNodeInstanceId: string;
  definitionEditor: boolean;
  modeDocumentAvailable: boolean;
  itemEditor: ItemEditor;
  interactions: SelectionInteractions;
  setSelection: (selection: SelectionTarget) => void;
  setDefinitionEditor: (open: boolean) => void;
  setPendingEditId: (id: string | undefined) => void;
  setMobilePane: (pane: MobilePane) => void;
  setBrowserView: (view: WorkspaceBrowserView) => void;
  setInsertMode: (active: boolean) => void;
  setSlotPicker: (slot: SlotSelection | undefined) => void;
  setShowStrictUi: (open: boolean) => void;
}) {
  const selectWorkspaceTarget = (next: SelectionTarget) => {
    const editorDraft = options.itemEditor.model?.session.draft;
    const editorInstanceId = next.kind === "component"
      ? next.id
      : next.kind === "html"
        ? next.componentInstanceId
        : undefined;
    if (editorDraft && editorInstanceId && findDesignNode(editorDraft.root, editorInstanceId)) {
      options.setSelection(next);
      options.setDefinitionEditor(false);
      options.setSlotPicker(undefined);
      options.itemEditor.selectComponent(editorInstanceId);
      return;
    }
    if (options.itemEditor.model) options.itemEditor.close();
    options.interactions.selectTarget(next);
  };

  const editWorkspaceComponent = (instanceId: string) => {
    options.setSelection({ kind: "component", id: instanceId });
    options.setDefinitionEditor(false);
    if (options.itemEditor.model) options.itemEditor.selectComponent(instanceId);
    else options.itemEditor.open(instanceId);
  };

  const selectCanvasTarget = (next: SelectionTarget) => {
    selectWorkspaceTarget(next);
    if (options.itemEditor.model) return;
    const instanceId = next.kind === "component"
      ? next.id
      : next.kind === "html"
        ? next.componentInstanceId
        : undefined;
    if (!instanceId || !findDesignNode(options.document.root, instanceId)) return;
    options.setDefinitionEditor(false);
    options.itemEditor.open(instanceId);
    options.setMobilePane("canvas");
  };

  const openViolation = (violation: StrictUiViolation) => {
    options.itemEditor.close();
    const location = violation.location;
    if (location.kind === "instance" || location.kind === "control") {
      options.setSelection({ kind: "component", id: location.instanceId });
      options.setPendingEditId(location.instanceId);
      options.setDefinitionEditor(false);
      options.setMobilePane("inspect");
    } else if (location.kind === "slot") {
      options.interactions.selectTarget({
        kind: "slot",
        id: `slot:${encodeURIComponent(location.instanceId)}:${encodeURIComponent(location.slotId)}`,
        componentInstanceId: location.instanceId,
        slotId: location.slotId,
      }, false);
      options.setMobilePane("tree");
    } else if (location.kind === "slot-outlet" && location.outletId) {
      options.setSelection({ kind: "slot-outlet", id: `outlet:${location.outletId}`, outletId: location.outletId, slotId: location.slotId });
      options.setMobilePane("tree");
    } else {
      options.setBrowserView("documents");
      options.setMobilePane("documents");
    }
    options.setShowStrictUi(false);
  };

  const onMobilePaneChange = (pane: MobilePane) => {
    options.setInsertMode(false);
    if (pane === "documents" || pane === "files" || pane === "catalog") options.setBrowserView(pane);
    if (!options.modeDocumentAvailable && (pane === "tree" || pane === "canvas" || pane === "inspect")) {
      options.setMobilePane(pane);
      return;
    }
    if (pane !== "inspect") {
      options.setMobilePane(pane);
      return;
    }
    if (options.selection.kind === "slot" || options.selection.kind === "slot-outlet") {
      options.setMobilePane("inspect");
    } else if (options.definitionEditor && options.selection.kind === "component" && options.selection.id === options.document.root.instanceId) {
      options.setMobilePane("inspect");
    } else {
      options.setDefinitionEditor(false);
      options.itemEditor.open(options.selectedNodeInstanceId);
      options.setMobilePane("canvas");
    }
  };

  return { editWorkspaceComponent, onMobilePaneChange, openViolation, selectCanvasTarget, selectWorkspaceTarget };
}
