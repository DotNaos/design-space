
import { Code2, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceCodeCanvas, type SourceCodeEditor } from "./SourceCodeCanvas";
import { SourceComponentInspector } from "./SourceComponentInspector";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";
import type { SourceLayerMetrics } from "./source-layer-design";
import { DetailTab } from "./DetailTab";
import { CodeDocumentSwitch } from "./SourceLibraryEditorPanel.CodeDocumentSwitch";
import { ReleaseEvidence } from "./ReleaseEvidence";

export type SourceLibraryEditorMode = "development" | "release";
export type SourceLibraryEditorTab = "code" | "design";
export type SourceLibraryCodeDocument = "source" | "design";

export type SourceLibraryEditorPanelProps = {
  activeTab: SourceLibraryEditorTab;
  codeDocument: SourceLibraryCodeDocument;
  designEditor: SourceCodeEditor;
  entry?: SourceWorkspaceEntry;
  mode: SourceLibraryEditorMode;
  releaseFallback?: ReactNode;
  designLayer?: SourceWorkspaceLayer;
  selectedLayer?: SourceWorkspaceLayer;
  selectedLayerMetrics?: SourceLayerMetrics;
  selectedDesignCase?: string;
  sourceEditor: SourceCodeEditor;
  styleEditor?: SourceLayerClassEditor;
  onActiveTabChange: (tab: SourceLibraryEditorTab) => void;
  onCodeDocumentChange: (document: SourceLibraryCodeDocument) => void;
  onDesignCaseChange?: (caseName: string) => void;
};

export function SourceLibraryEditorPanel(props: SourceLibraryEditorPanelProps) {
  if (props.mode === "release") {
    return props.releaseFallback ?? <ReleaseEvidence entry={props.entry} />;
  }

  const activeCodeDocument = props.codeDocument === "design" && props.entry?.design ? "design" : "source";
  const activeEditor = activeCodeDocument === "design" ? props.designEditor : props.sourceEditor;
  const label = props.entry?.label ?? "Component";

  return (
    <section aria-label="Component library editor" className="flex h-full min-h-0 w-full flex-col bg-[#141518]">
      <nav aria-label="Library component detail" className="flex h-10 shrink-0 items-center gap-1 border-b border-white/10 px-2">
        <DetailTab active={props.activeTab === "code"} icon={<Code2 aria-hidden="true" size={12} />} label="Code" onPress={() => props.onActiveTabChange("code")} />
        <DetailTab active={props.activeTab === "design"} icon={<SlidersHorizontal aria-hidden="true" size={12} />} label="Design" onPress={() => props.onActiveTabChange("design")} />
      </nav>
      <div className="min-h-0 flex-1">
        {props.activeTab === "code" ? (
          <SourceCodeCanvas
            editable={activeCodeDocument === "design" ? Boolean(props.entry?.design) : Boolean(props.entry)}
            editor={activeEditor}
            label={activeCodeDocument === "design" ? `${label} design` : label}
            path={activeCodeDocument === "design" ? props.entry?.design?.relativePath : props.entry?.relativePath}
            selection={activeCodeDocument === "source" ? props.selectedLayer?.source ?? props.entry?.source : undefined}
            toolbar={props.entry?.design ? (
              <CodeDocumentSwitch value={activeCodeDocument} onChange={props.onCodeDocumentChange} />
            ) : undefined}
          />
        ) : (
          <SourceComponentInspector
            className="flex h-full w-full border-l-0"
            entry={props.entry}
            layer={props.designLayer ?? props.selectedLayer}
            layerMetrics={props.selectedLayerMetrics}
            selectedDesignCase={props.selectedDesignCase}
            styleEditor={props.styleEditor}
            onDesignCaseChange={props.onDesignCaseChange}
          />
        )}
      </div>
    </section>
  );
}
