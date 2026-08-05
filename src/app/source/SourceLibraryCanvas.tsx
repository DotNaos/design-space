
import { SourcePreviewFrame } from "./SourcePreviewFrame";
import { SourceLibraryProps, selectedCatalogWorkspace, selectedSourceLibraryComponent } from "./SourceLibraryWorkspace";
import { LibraryState } from "./LibraryState";

export function SourceLibraryCanvas(props: SourceLibraryProps) {
  const component = selectedSourceLibraryComponent(props);
  const source = selectedCatalogWorkspace(props);
  if (!component) return <LibraryState title="No component selected" message="Choose a component from the native design catalog." />;
  if (!component.entry) {
    return <LibraryState title="Design missing" message={`${component.label} is exported by the package, but this package does not include a colocated native design.`} />;
  }
  return (
    <SourcePreviewFrame
      centerContent
      boxModelPreviewStore={props.boxModelPreviewStore}
      codeAnnotations={props.codeAnnotations}
      codeContexts={props.codeContexts}
      device={props.device}
      entry={component.entry}
      entries={source?.entries}
      generateDesignError={props.generatingDesignEntryId === component.entry.id ? props.generateDesignError : undefined}
      generatingDesign={props.generatingDesignEntryId === component.entry.id}
      runtime="react"
      selectedClassCss={props.selectedClassCss}
      selectedClassName={props.selectedClassName}
      selectedDesignCase={props.selectedDesignCase}
      selectedLayer={props.selectedLayer}
      selectedText={props.selectedText}
      isolateSelectedLayer={false}
      mode={props.previewMode}
      selectionMode={props.selectionMode}
      styles={source?.styles ?? []}
      workspaceNavigation={props.workspaceNavigation}
      onGenerateDesign={(props.catalogKind === "app" || props.mode === "development") && props.onGenerateDesign
        ? () => props.onGenerateDesign?.(component.entry!)
        : undefined}
      onClearCodeFeedback={props.onClearCodeFeedback}
      onDeviceChange={props.onDeviceChange}
      onDesignCaseChange={props.onDesignCaseChange}
      onModeChange={props.onPreviewModeChange}
      onRemoveCodeAnnotation={props.onRemoveCodeAnnotation}
      onRemoveCodeContext={props.onRemoveCodeContext}
      onSelectLayer={props.onSelectLayer}
      onSelectedLayerMetrics={props.onSelectedLayerMetrics}
    />
  );
}
