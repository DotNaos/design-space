import { ArrowUpRight, Braces, CircleAlert, Component, FileCode2 } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";

import type { SourceComponentSlot, SourceWorkspaceEntry, SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceDesignCaseControl } from "./SourceDesignCaseControl";
import { SourceLayerDesignInspector } from "./SourceLayerDesignInspector";
import { SourceFeedbackInspector } from "./SourceFeedbackInspector";
import { sourceFeedbackContext } from "./source-feedback";
import type { SourceComponentCandidate } from "./source-slot-composition";
import type { SourceLayerMetrics } from "./source-layer-design";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";
import { ComponentInspectorHeader } from "./ComponentInspectorHeader";
import { ContractSection } from "./ContractSection";
import type { BoxModelPreview } from "../inspector/tailwind-box-model-values";

export interface SourceComponentInspectorProps {
  className?: string;
  entry?: SourceWorkspaceEntry;
  layer?: SourceWorkspaceLayer;
  layerMetrics?: SourceLayerMetrics;
  slotLayers?: readonly SourceWorkspaceLayer[];
  slotEditorReady?: boolean;
  styleEditor?: SourceLayerClassEditor;
  openLayerComponent?: {
    label: string;
    onOpen: () => void;
  };
  candidatesForSlot?: (slot: SourceWorkspaceLayer) => readonly SourceComponentCandidate[];
  outsideCurrentFile?: {
    currentRelativePath?: string;
    onOpen: () => void;
  };
  selectedDesignCase?: string;
  onApplySlot?: (slot: SourceWorkspaceLayer, candidate: SourceComponentCandidate, action: "add" | "replace") => void;
  onPrepareSlotEdit?: () => void;
  onDesignCaseChange?: (caseName: string) => void;
  onBoxModelPreviewChange?: (preview?: BoxModelPreview) => void;
}

export function SourceComponentInspector(props: SourceComponentInspectorProps) {
  const committedClassName = props.styleEditor?.value ?? props.layer?.className?.value ?? "";
  const [previewClassName, setPreviewClassName] = useState<string>();
  useEffect(() => setPreviewClassName(undefined), [props.layer?.id, committedClassName]);

  if (!props.entry) {
    return (
      <aside
        aria-label="TypeScript component contract"
        className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 items-center justify-center border-l border-white/10 bg-[#141518] px-6 text-center`}
      >
        <p className="text-xs leading-5 text-zinc-600">Select an exported component to inspect its TypeScript contract.</p>
      </aside>
    );
  }

  if (props.outsideCurrentFile) {
    return (
      <aside
        aria-label="TypeScript component contract"
        className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-l border-white/10 bg-[#141518]`}
      >
        <ComponentInspectorHeader entry={props.entry} selectedRegion />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SourceFeedbackInspector context={sourceFeedbackContext(props.entry, props.layer)} />
          <section aria-labelledby="outside-current-file-title" className="px-4 py-3">
            <div className="flex items-center gap-2 text-violet-300">
              <FileCode2 aria-hidden="true" size={14} />
              <h3 id="outside-current-file-title" className="text-[10px] font-medium">
                Outside the current file
              </h3>
            </div>
          <Button
            className="mt-3 w-full justify-center"
            size="sm"
            variant="primary"
            onPress={props.outsideCurrentFile.onOpen}
          >
            Open component file
            <ArrowUpRight aria-hidden="true" size={14} />
          </Button>
          {props.outsideCurrentFile.currentRelativePath ? (
            <p className="mt-2 truncate text-[9px] text-zinc-700" title={props.outsideCurrentFile.currentRelativePath}>
              Used from {props.outsideCurrentFile.currentRelativePath}
            </p>
          ) : null}
          </section>
        </div>
      </aside>
    );
  }

  const regularProps = props.entry.props;
  const slots = props.entry.slots;

  return (
    <aside
      aria-label="TypeScript component contract"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-l border-white/10 bg-[#141518]`}
    >
      <ComponentInspectorHeader entry={props.entry} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#141518]/95 backdrop-blur">
          <SourceDesignCaseControl
            entry={props.entry}
            selectedCase={props.selectedDesignCase}
            onCaseChange={props.onDesignCaseChange}
          />
        </div>
        <SourceFeedbackInspector context={sourceFeedbackContext(props.entry, props.layer)} />
        {props.entry.findings.length > 0 && (
          <section aria-label="Strict UI findings" className="border-b border-red-400/20 bg-red-400/[0.04] px-4 py-3">
            <header className="flex items-center gap-2 text-red-300">
              <CircleAlert aria-hidden="true" size={14} />
              <h3 className="text-[10px] font-medium">Strict UI</h3>
              <span className="ml-auto text-[9px] tabular-nums">{props.entry.findings.length}</span>
            </header>
            <ul className="mt-2 space-y-2">
              {props.entry.findings.map((finding) => (
                <li key={`${finding.ruleId}:${finding.message}`} className="text-[10px] leading-4 text-red-200/80">
                  {finding.message}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(props.layer?.className || (props.layer && props.openLayerComponent)) && (
          <SourceLayerDesignInspector
            layer={props.layer}
            metrics={props.layerMetrics}
            openComponent={props.openLayerComponent}
            previewClassName={previewClassName}
            styleEditor={props.styleEditor}
            onBoxModelPreviewChange={props.onBoxModelPreviewChange}
            onClassNamePreviewChange={setPreviewClassName}
          />
        )}
        <ContractSection
          icon={<Braces aria-hidden="true" size={14} />}
          properties={regularProps}
          title="Props"
        />
        <ContractSection
          icon={<Component aria-hidden="true" size={14} />}
          properties={slots}
          slotLayers={props.slotLayers}
          slotEditorReady={props.slotEditorReady}
          candidatesForSlot={props.candidatesForSlot}
          onApplySlot={props.onApplySlot}
          onPrepareSlotEdit={props.onPrepareSlotEdit}
          title="Slots"
        />
      </div>
    </aside>
  );
}

export function formatSlotCardinality(slot: SourceComponentSlot): string {
  const cardinality = slot.max === slot.min
    ? String(slot.min)
    : slot.min === 0 && slot.max !== undefined
      ? `up to ${slot.max}`
      : slot.max === undefined
        ? `${slot.min}+`
        : `${slot.min}–${slot.max}`;
  return `${slot.required ? "Required" : "Optional"} · ${cardinality}`;
}
