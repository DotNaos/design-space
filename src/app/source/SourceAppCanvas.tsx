import type { ComponentProps } from "react";

import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourcePreviewMode, SourceWorkspaceMode } from "./source-layer-design";
import type { SourceTreeNode } from "./source-workspace-tree";
import { SourceCodeCanvas } from "./SourceCodeCanvas";
import { SourcePreviewFrame } from "./SourcePreviewFrame";

export function SourceAppCanvas(props: {
  centerContent: boolean;
  device: DesignSpaceDevice;
  draftSelection?: { start: number; end: number };
  editor: ComponentProps<typeof SourceCodeCanvas>["editor"];
  entry?: RuntimeSourceWorkspaceEntry;
  entries: readonly RuntimeSourceWorkspaceEntry[];
  generateDesignError?: string;
  generatingDesign: boolean;
  hoveredLayer?: SourceWorkspaceLayer;
  hoveredLayerOccurrence?: number;
  mode: SourcePreviewMode;
  nestedPreview: boolean;
  node?: SourceTreeNode;
  previewEntry?: RuntimeSourceWorkspaceEntry;
  revealSelectedLayerKey?: number;
  runtime: "react" | "react-native";
  selectedClassCss?: string;
  selectedClassName?: string;
  selectedDesignCase?: string;
  selectedLayer?: SourceWorkspaceLayer;
  selectedLayerOccurrence?: number;
  selectedText?: string;
  slotLayers: readonly SourceWorkspaceLayer[];
  styles: readonly string[];
  workspaceMode: SourceWorkspaceMode;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onGenerateDesign?: () => void;
  onDesignCaseChange?: (caseName: string) => void;
  onModeChange: (mode: SourcePreviewMode) => void;
  onOpenLayerOwner: (entryId: string, layerId: string, occurrence: number) => void;
  onReturnToPreview: () => void;
  onSelectLayer: (layerId: string, occurrence: number) => void;
  onSelectedLayerMetrics: ComponentProps<typeof SourcePreviewFrame>["onSelectedLayerMetrics"];
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative flex min-h-0 min-w-0 flex-1">
        {props.nestedPreview ? (
          <SourceCodeCanvas
            editable={false}
            editor={props.editor}
            label={props.entry?.label ?? props.node?.label ?? "Source"}
            path={props.entry?.relativePath}
            selection={props.draftSelection ?? props.selectedLayer?.source ?? props.entry?.source}
          />
        ) : (
          <SourcePreviewFrame
            centerContent={props.centerContent}
            device={props.device}
            entry={props.previewEntry}
            entries={props.entries}
            generateDesignError={props.generateDesignError}
            generatingDesign={props.generatingDesign}
            hoveredLayer={props.hoveredLayer}
            hoveredLayerOccurrence={props.hoveredLayerOccurrence}
            isolateSelectedLayer={false}
            mode={props.mode}
            node={props.node}
            revealSelectedLayerKey={props.revealSelectedLayerKey}
            runtime={props.runtime}
            selectedClassCss={props.selectedClassCss}
            selectedClassName={props.selectedClassName}
            selectedDesignCase={props.selectedDesignCase}
            selectedLayer={props.selectedLayer}
            selectedLayerOccurrence={props.selectedLayerOccurrence}
            selectedText={props.selectedText}
            slotLayers={props.slotLayers}
            styles={props.styles}
            workspaceMode={props.workspaceMode}
            onDeviceChange={props.onDeviceChange}
            onDesignCaseChange={props.onDesignCaseChange}
            onGenerateDesign={props.onGenerateDesign}
            onModeChange={props.onModeChange}
            onOpenLayerOwner={props.onOpenLayerOwner}
            onReturnToPreview={props.onReturnToPreview}
            onSelectLayer={props.onSelectLayer}
            onSelectedLayerMetrics={props.onSelectedLayerMetrics}
          />
        )}
      </div>
    </div>
  );
}
