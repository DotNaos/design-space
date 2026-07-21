import { Button } from "@heroui/react";
import { Code2, LockKeyhole, PackageCheck, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import type { SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceCodeCanvas, type SourceCodeEditor } from "./SourceCodeCanvas";
import { SourceComponentInspector } from "./SourceComponentInspector";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";
import type { SourceLayerMetrics } from "./source-layer-design";

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
  selectedLayer?: SourceWorkspaceLayer;
  selectedLayerMetrics?: SourceLayerMetrics;
  sourceEditor: SourceCodeEditor;
  styleEditor?: SourceLayerClassEditor;
  onActiveTabChange: (tab: SourceLibraryEditorTab) => void;
  onCodeDocumentChange: (document: SourceLibraryCodeDocument) => void;
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
            layer={props.selectedLayer}
            layerMetrics={props.selectedLayerMetrics}
            styleEditor={props.styleEditor}
          />
        )}
      </div>
    </section>
  );
}

function DetailTab(props: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Button
      aria-pressed={props.active}
      className={`h-7 min-w-0 gap-1.5 rounded-md px-2.5 text-[10px] ${props.active ? "bg-sky-400/10 text-sky-200" : "text-zinc-500"}`}
      size="sm"
      variant="ghost"
      onPress={props.onPress}
    >
      {props.icon}{props.label}
    </Button>
  );
}

function CodeDocumentSwitch(props: {
  value: SourceLibraryCodeDocument;
  onChange: (value: SourceLibraryCodeDocument) => void;
}) {
  return (
    <div aria-label="Library code file" className="flex shrink-0 items-center rounded-md bg-white/[0.04] p-0.5" role="group">
      <Button
        aria-pressed={props.value === "source"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "source" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("source")}
      >
        Source
      </Button>
      <Button
        aria-pressed={props.value === "design"}
        className={`h-5 min-w-0 rounded px-1.5 text-[9px] ${props.value === "design" ? "bg-white/10 text-zinc-200" : "text-zinc-600"}`}
        size="sm"
        variant="ghost"
        onPress={() => props.onChange("design")}
      >
        Design file
      </Button>
    </div>
  );
}

function ReleaseEvidence(props: { entry?: SourceWorkspaceEntry }) {
  return (
    <aside aria-label="Read-only library release" className="flex h-full w-full flex-col border-l border-white/10 bg-[#141518] p-5">
      <div className="flex items-center gap-2 text-zinc-500">
        <PackageCheck aria-hidden="true" size={14} />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em]">Library evidence</span>
      </div>
      <h2 className="mt-5 truncate text-sm font-semibold text-zinc-200">{props.entry?.label ?? "Installed component"}</h2>
      {props.entry && <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{props.entry.relativePath}</p>}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400"><LockKeyhole aria-hidden="true" size={12} />Read-only release</p>
      <p className="mt-2 text-[10px] leading-5 text-zinc-600">Attach the development source to edit this component and its design file.</p>
    </aside>
  );
}
