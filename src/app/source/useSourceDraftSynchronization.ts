import { useEffect } from "react";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourceCodeEditor } from "./SourceCodeCanvas";
import type { SourceDraftLocation, SourceDraftWorkspaceStore } from "./source-draft-workspace";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

export function useSourceDraftSynchronization(options: {
  analysis: { analyzing: boolean; error?: string };
  draftWorkspace: SourceDraftWorkspaceStore;
  editor: Pick<SourceCodeEditor, "dirty">;
  location?: SourceDraftLocation;
  previewEntry?: Pick<SourceWorkspaceEntry, "id">;
  reviewLayer?: SourceWorkspaceLayer;
  styleEditor: Pick<SourceLayerClassEditor, "css" | "textValue" | "value">;
}) {
  useEffect(() => {
    if (!options.location || !options.editor.dirty) return;
    options.draftWorkspace.setValidation(
      options.location,
      options.analysis.analyzing ? "validating" : options.analysis.error ? "invalid" : "valid",
      options.analysis.error,
    );
  }, [
    options.analysis.analyzing,
    options.analysis.error,
    options.draftWorkspace,
    options.editor.dirty,
    options.location,
  ]);

  useEffect(() => {
    const layer = options.reviewLayer;
    const changed = Boolean(layer && (
      (layer.className && options.styleEditor.value !== layer.className.value)
      || (layer.text && options.styleEditor.textValue !== layer.text.value)
    ));
    if (!options.location || !options.editor.dirty || !layer || !changed) return;
    options.draftWorkspace.setVisualReview(options.location, {
      layerId: layer.id,
      ...(options.previewEntry ? { previewEntryId: options.previewEntry.id } : {}),
      ...(layer.className ? { className: options.styleEditor.value, css: options.styleEditor.css } : {}),
      ...(layer.text ? { text: options.styleEditor.textValue } : {}),
    });
  }, [
    options.draftWorkspace,
    options.editor.dirty,
    options.location,
    options.previewEntry,
    options.reviewLayer,
    options.styleEditor.css,
    options.styleEditor.textValue,
    options.styleEditor.value,
  ]);
}
