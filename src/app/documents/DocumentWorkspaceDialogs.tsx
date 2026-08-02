import type { SelectionTarget } from "../../model";
import { DiffSheet } from "../components/DiffSheet/DiffSheet";
import { SlotCatalogDialog } from "../components/SlotCatalogDialog/SlotCatalogDialog";
import { WorkspaceContextMenu } from "../components/WorkspaceContextMenu/WorkspaceContextMenu";
import type { useDocumentCreationFlow } from "../document/use-document-creation-flow";
import type { useDocumentSelectionInteractions } from "../document/use-document-selection-interactions";
import type { useDocumentItemEditor } from "../document/use-document-item-editor";
import type { useDocumentWorkspace } from "../document/use-document-workspace";
import { StrictUiSheet } from "../strict-ui/StrictUiSheet";
import { CreateDocumentSheet } from "./CreateDocumentSheet";
import { DocumentMobileItemEditor } from "./DocumentMobileItemEditor";
import type { ProductMode } from "./DocumentNavigator";

type SlotSelection = Extract<SelectionTarget, { kind: "slot" }>;
type Controller = ReturnType<typeof useDocumentWorkspace>;
type Creation = ReturnType<typeof useDocumentCreationFlow>;
type Interactions = ReturnType<typeof useDocumentSelectionInteractions>;
type ItemEditor = ReturnType<typeof useDocumentItemEditor>;

export function DocumentWorkspaceDialogs(props: {
  workspace: {
    controller: Controller;
    activeSession: Controller["session"];
    creation: Creation;
    interactions: Interactions;
    itemEditor: ItemEditor;
    mode: ProductMode;
    modeDocumentAvailable: boolean;
    slotPicker?: SlotSelection;
    rootPicker: boolean;
    pickerLabel: string;
    pickerEntries: Parameters<typeof SlotCatalogDialog>[0]["entries"];
    showDiff: boolean;
    showStrictUi: boolean;
  };
  actions: {
    setShowDiff: (open: boolean) => void;
    setShowStrictUi: (open: boolean) => void;
    closeSlotPicker: () => void;
    openViolation: Parameters<typeof StrictUiSheet>[0]["onSelect"];
    editDefinition: () => void;
    selectSlot: (slot: SlotSelection, occupied: boolean) => void;
    closeItemEditor: () => void;
    applyItemEditor: () => void;
    openIsolated: (instanceId: string) => void;
  };
}) {
  const { activeSession, controller, creation, interactions, itemEditor } = props.workspace;
  const preparedSave = activeSession?.prepared;
  return (
    <>
      {interactions.contextMenu && <WorkspaceContextMenu menu={{ x: interactions.contextMenu.clientPosition.x, y: interactions.contextMenu.clientPosition.y, label: interactions.contextMenu.label }} actions={interactions.contextActions} onClose={interactions.closeContextMenu} />}
      {props.workspace.showDiff && preparedSave && <DiffSheet desktopHidden diff={preparedSave.exactDiff} saving={activeSession?.phase === "saving"} onClose={() => props.actions.setShowDiff(false)} onSave={() => void controller.save().then((result) => result && props.actions.setShowDiff(false))} />}
      <SlotCatalogDialog
        open={props.workspace.modeDocumentAvailable && (props.workspace.rootPicker || Boolean(props.workspace.slotPicker))}
        slotLabel={props.workspace.rootPicker ? "document" : props.workspace.pickerLabel}
        targetKind={props.workspace.rootPicker ? "root" : "slot"}
        entries={props.workspace.pickerEntries}
        onClose={props.actions.closeSlotPicker}
        onSelect={(id) => {
          if (props.workspace.rootPicker) interactions.insertRootComponent(id);
          else if (props.workspace.slotPicker) interactions.insertComponent(id, props.workspace.slotPicker);
        }}
      />
      <CreateDocumentSheet open={creation.isOpen} mode={props.workspace.mode} recipes={controller.creationRecipes} busy={creation.preparing} error={creation.error} onClose={creation.close} onPrepare={(recipeId, label) => void creation.prepare(recipeId, label)} />
      {creation.prepared && <DiffSheet diff={creation.prepared.diff} saving={creation.saving} onClose={creation.discard} onSave={() => void creation.save()} />}
      <StrictUiSheet open={Boolean(activeSession) && props.workspace.showStrictUi} evidence={activeSession?.strictUi} liveViolations={activeSession ? controller.liveViolations : []} checking={activeSession?.phase === "checking"} onClose={() => props.actions.setShowStrictUi(false)} onSelect={props.actions.openViolation} onRecheck={() => void controller.prepare()} />
      {props.workspace.modeDocumentAvailable && <DocumentMobileItemEditor itemEditor={itemEditor} files={controller.files} onEditDefinition={props.actions.editDefinition} onOpenIsolated={props.actions.openIsolated} onSelectSlot={props.actions.selectSlot} onClose={props.actions.closeItemEditor} onApply={props.actions.applyItemEditor} />}
    </>
  );
}
