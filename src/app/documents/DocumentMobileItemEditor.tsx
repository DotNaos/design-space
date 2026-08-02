import type { SelectionTarget } from "../../model";
import type { TargetFileEntry } from "../../shared/target-module";
import { MobileItemEditor } from "../components/MobileItemEditor/MobileItemEditor";
import type { useDocumentItemEditor } from "../document/use-document-item-editor";
import type { SlotState } from "../types";

type ItemEditor = ReturnType<typeof useDocumentItemEditor>;

export function DocumentMobileItemEditor(props: {
  itemEditor: ItemEditor;
  files: readonly TargetFileEntry[];
  onEditDefinition: () => void;
  onOpenIsolated: (instanceId: string) => void;
  onSelectSlot: (selection: Extract<SelectionTarget, { kind: "slot" }>, occupied: boolean) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const model = props.itemEditor.model;
  if (!model) return null;
  return (
    <MobileItemEditor
      componentLabel={model.htmlElement ? `<${model.htmlElement.tagName}>` : model.adapter.component.label}
      htmlElement={Boolean(model.htmlElement)}
      sourceLabel={model.adapter.sourceFileId ? props.files.find((file) => file.id === model.adapter.sourceFileId)?.label : undefined}
      controls={model.controls}
      controlValues={model.controlValues}
      previewCss={model.previewCss}
      slots={model.slots}
      compileError={model.compileError}
      compilePending={model.compilePending}
      sourceBacked={Boolean(model.adapter.sourceFileId)}
      canMoveUp={Boolean(model.location && model.location.index > 0)}
      canMoveDown={Boolean(model.location && model.location.index < model.location.siblingCount - 1)}
      canDuplicate={model.canDuplicate}
      canDelete={model.canDelete}
      onControlChange={props.itemEditor.updateControl}
      onEditDefinition={model.htmlElement ? undefined : props.onEditDefinition}
      onOpenIsolated={() => props.onOpenIsolated(model.instance.instanceId)}
      onSelectSlot={(slot: SlotState) => props.onSelectSlot({
        kind: "slot",
        id: slot.selectionId,
        componentInstanceId: model.instance.instanceId,
        slotId: slot.id,
      }, slot.count > 0)}
      onMove={props.itemEditor.move}
      onDuplicate={props.itemEditor.duplicate}
      onDelete={props.itemEditor.remove}
      onCancel={props.onClose}
      onApply={props.onApply}
    />
  );
}
