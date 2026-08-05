import type { ComponentProps, ReactNode } from "react";

import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import type { SourcePreviewMode, SourceWorkspaceMode } from "./source-layer-design";
import type { SourceTreeNode } from "./source-workspace-tree";
import type { SourceCanvasAncestryItem } from "./source-canvas-ancestry";
import type { SourceComponentReviewCheckpointProps } from "./SourceComponentReviewCheckpoint";
import type { SourceSlotScope } from "./source-slot-navigation";
import { SourceCodeCanvas } from "./SourceCodeCanvas";
import { SourcePreviewFrame } from "./SourcePreviewFrame";
import type { SourceCodeAnnotation, SourceCodeSelectionContext } from "./source-feedback";

export function SourceAppCanvas(props: {
  ancestry: readonly SourceCanvasAncestryItem[];
  boxModelPreviewStore?: ComponentProps<typeof SourcePreviewFrame>["boxModelPreviewStore"];
  centerContent: boolean;
  codeAnnotations?: readonly SourceCodeAnnotation[];
  codeContexts?: readonly SourceCodeSelectionContext[];
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
  reviewCheckpoint?: Omit<SourceComponentReviewCheckpointProps, "onRequestChanges">;
  runtime: "react" | "react-native";
  selectedClassCss?: string;
  selectedClassName?: string;
  selectedDesignCase?: string;
  selectedLayer?: SourceWorkspaceLayer;
  selectedLayerLabel?: string;
  selectedLayerOccurrence?: number;
  selectedText?: string;
  slotLayers: readonly SourceWorkspaceLayer[];
  slotScopes?: Readonly<Record<string, SourceSlotScope>>;
  slotTargetLabel?: string;
  styles: readonly string[];
  workspaceMode: SourceWorkspaceMode;
  workspaceNavigation?: ReactNode;
  onDeviceChange: (device: DesignSpaceDevice) => void;
  onClearCodeFeedback?: () => void;
  onGenerateDesign?: () => void;
  onDesignCaseChange?: (caseName: string) => void;
  onModeChange: (mode: SourcePreviewMode) => void;
  onOpenLayerOwner: (entryId: string, layerId: string, occurrence: number) => void;
  onOpenSlotTarget?: () => void;
  onRemoveCodeAnnotation?: (id: string) => void;
  onRemoveCodeContext?: (id: string) => void;
  onSelectAncestry: (item: SourceCanvasAncestryItem) => void;
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
            ancestry={props.ancestry}
            boxModelPreviewStore={props.boxModelPreviewStore}
            centerContent={props.centerContent}
            codeAnnotations={props.codeAnnotations}
            codeContexts={props.codeContexts}
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
            reviewCheckpoint={props.reviewCheckpoint}
            runtime={props.runtime}
            selectedClassCss={props.selectedClassCss}
            selectedClassName={props.selectedClassName}
            selectedDesignCase={props.selectedDesignCase}
            selectedLayer={props.selectedLayer}
            selectedLayerLabel={props.selectedLayerLabel}
            selectedLayerOccurrence={props.selectedLayerOccurrence}
            selectedText={props.selectedText}
            slotLayers={props.slotLayers}
            slotScopes={props.slotScopes}
            slotTargetLabel={props.slotTargetLabel}
            styles={props.styles}
            workspaceMode={props.workspaceMode}
            workspaceNavigation={props.workspaceNavigation}
            onDeviceChange={props.onDeviceChange}
            onClearCodeFeedback={props.onClearCodeFeedback}
            onDesignCaseChange={props.onDesignCaseChange}
            onGenerateDesign={props.onGenerateDesign}
            onModeChange={props.onModeChange}
            onOpenLayerOwner={props.onOpenLayerOwner}
            onOpenSlotTarget={props.onOpenSlotTarget}
            onRemoveCodeAnnotation={props.onRemoveCodeAnnotation}
            onRemoveCodeContext={props.onRemoveCodeContext}
            onSelectAncestry={props.onSelectAncestry}
            onReturnToPreview={props.onReturnToPreview}
            onSelectLayer={props.onSelectLayer}
            onSelectedLayerMetrics={props.onSelectedLayerMetrics}
          />
        )}
      </div>
    </div>
  );
}
