import type { DesignDocument } from "../../shared/design-document";
import type { ComponentCreationRecipe } from "../../shared/target-module";
import type { useDocumentItemEditor } from "../document/use-document-item-editor";
import { DocumentInspector } from "../inspector/DocumentInspector";
import { InspectorPrompt } from "../document/WorkspaceStates";
import type { SlotState } from "../types";
import type { BindingComponentOption } from "../library/ComponentPropertyBindings";
import { DocumentDefinitionPanel } from "./DocumentDefinitionPanel";

type ItemEditor = ReturnType<typeof useDocumentItemEditor>;

export function DesktopDocumentEditingPanel(props: {
  definitionEditor: boolean;
  document: DesignDocument;
  documents: readonly DesignDocument[];
  recipe?: ComponentCreationRecipe;
  catalogComponents: readonly BindingComponentOption[];
  files: readonly { id: string; label: string }[];
  selectedNodeId: string;
  itemEditor: ItemEditor;
  onDocumentChange: (document: DesignDocument) => void;
  onDefinitionEditorChange: (open: boolean) => void;
  onOpenIsolated: (instanceId: string) => void;
  onSelectSlot: (slot: SlotState, instanceId: string) => void;
}) {
  const model = props.itemEditor.model;
  if (props.definitionEditor) {
    return (
      <DocumentDefinitionPanel
        className="flex h-full w-full border-l-0"
        document={props.document}
        documents={props.documents}
        recipe={props.recipe}
        catalogComponents={props.catalogComponents}
        onChange={props.onDocumentChange}
        onEditImplementation={() => {
          if (!props.document.root) return;
          props.onDefinitionEditorChange(false);
          props.itemEditor.open(props.document.root.instanceId);
        }}
      />
    );
  }
  if (!model) return <InspectorPrompt className="grid h-full w-full border-l-0" onEdit={() => props.itemEditor.open(props.selectedNodeId)} />;
  return (
    <DocumentInspector
      className="flex h-full w-full border-l-0"
      componentLabel={model.htmlElement ? `<${model.htmlElement.tagName}>` : model.adapter.component.label}
      htmlElement={Boolean(model.htmlElement)}
      sourceLabel={model.adapter.sourceFileId ? props.files.find((file) => file.id === model.adapter.sourceFileId)?.label : undefined}
      sourceBacked={Boolean(model.adapter.sourceFileId)}
      controls={model.controls}
      values={model.controlValues}
      slots={model.slots}
      compileError={model.compileError}
      compilePending={model.compilePending}
      canMoveUp={Boolean(model.location && model.location.index > 0)}
      canMoveDown={Boolean(model.location && model.location.index < model.location.siblingCount - 1)}
      canDuplicate={model.canDuplicate}
      canDelete={model.canDelete}
      onEditDefinition={model.htmlElement ? undefined : () => {
        props.itemEditor.close();
        props.onDefinitionEditorChange(true);
      }}
      onOpenIsolated={() => props.onOpenIsolated(model.instance.instanceId)}
      onControlChange={props.itemEditor.updateControl}
      onSelectSlot={(slot) => props.onSelectSlot(slot, model.instance.instanceId)}
      onMove={props.itemEditor.move}
      onDuplicate={props.itemEditor.duplicate}
      onDelete={props.itemEditor.remove}
      onApply={props.itemEditor.apply}
      onCancel={props.itemEditor.close}
    />
  );
}
