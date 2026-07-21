import { Braces, ChevronRight, CircleAlert, Component, FileCode2 } from "lucide-react";
import { Button, Chip, Label, TextArea, TextField } from "@heroui/react";

import type {
  SourceComponentProp,
  SourceComponentSlot,
  SourceWorkspaceEntry,
  SourceWorkspaceLayer,
} from "../../shared/source-workspace";
import { TailwindClassField } from "../inspector/TailwindClassField";
import { SourceComponentPicker } from "./SourceComponentPicker";
import type { SourceComponentCandidate } from "./source-slot-composition";
import type { SourceLayerClassEditor } from "./useSourceLayerClassEditor";

export interface SourceComponentInspectorProps {
  className?: string;
  entry?: SourceWorkspaceEntry;
  layer?: SourceWorkspaceLayer;
  slotLayers?: readonly SourceWorkspaceLayer[];
  slotEditorReady?: boolean;
  styleEditor?: SourceLayerClassEditor;
  candidatesForSlot?: (slot: SourceWorkspaceLayer) => readonly SourceComponentCandidate[];
  onApplySlot?: (slot: SourceWorkspaceLayer, candidate: SourceComponentCandidate, action: "add" | "replace") => void;
  onPrepareSlotEdit?: () => void;
}

export function SourceComponentInspector(props: SourceComponentInspectorProps) {
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

  const regularProps = props.entry.props;
  const slots = props.entry.slots;

  return (
    <aside
      aria-label="TypeScript component contract"
      className={`${props.className ?? "flex w-72"} min-h-0 min-w-0 shrink-0 flex-col border-l border-white/10 bg-[#141518]`}
    >
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileCode2 aria-hidden="true" className="shrink-0 text-sky-400" size={15} />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{props.entry.label}</h2>
        </div>
        <p className="mt-1 truncate text-[10px] text-zinc-600" title={props.entry.relativePath}>{props.entry.relativePath}</p>
        <p className="mt-0.5 text-[9px] text-zinc-700">Export: {props.entry.exportName}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {props.entry.findings.length > 0 && (
          <section aria-label="Strict UI findings" className="border-b border-red-400/20 bg-red-400/[0.04] px-4 py-3">
            <header className="flex items-center gap-2 text-red-300">
              <CircleAlert aria-hidden="true" size={14} />
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em]">Strict UI</h3>
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
        {props.layer && (props.layer.className || props.layer.classNameDynamic || props.layer.text) && (
          <LayerDesignSection layer={props.layer} styleEditor={props.styleEditor} />
        )}
        <ContractSection
          emptyMessage="No non-slot props are declared."
          icon={<Braces aria-hidden="true" size={14} />}
          properties={regularProps}
          title="Props"
        />
        <ContractSection
          emptyMessage="No slot props are declared."
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

function LayerDesignSection(props: {
  layer: SourceWorkspaceLayer;
  styleEditor?: SourceLayerClassEditor;
}) {
  const editor = props.styleEditor;
  return (
    <section aria-labelledby="source-layer-design" className="border-b border-white/10 px-4 pb-4">
      <header className="flex min-h-10 items-center gap-2 text-zinc-500">
        <Braces aria-hidden="true" size={14} />
        <h3 id="source-layer-design" className="text-[10px] font-medium uppercase tracking-[0.14em]">Design</h3>
        <code className="ml-auto font-mono text-[9px] text-zinc-700">&lt;{props.layer.label}&gt;</code>
      </header>
      {props.layer.className ? (
        <>
          <TailwindClassField
            compileError={editor?.error}
            disabled={!editor?.editable}
            label="Tailwind classes"
            value={editor?.value ?? props.layer.className.value}
            onChange={(value) => editor?.change(value)}
          />
          <p className="mt-2 text-[9px] leading-4 text-zinc-600">
            Changes are applied to this element only. Review the exact source diff before saving.
          </p>
        </>
      ) : props.layer.classNameDynamic ? (
        <p className="text-[10px] leading-4 text-zinc-600">
          This element computes className in TypeScript. Open its code to preserve that expression.
        </p>
      ) : null}
      {props.layer.text && (
        <TextField
          fullWidth
          className={props.layer.kind === "html" ? "mt-4" : undefined}
          isDisabled={!editor?.textEditable}
          value={editor?.textValue ?? props.layer.text.value}
          onChange={(value) => editor?.changeText(value)}
        >
          <Label className="text-[10px] text-zinc-500">Static text</Label>
          <TextArea
            aria-label="Static text"
            className="mt-1 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-zinc-200 outline-none"
            rows={2}
          />
        </TextField>
      )}
    </section>
  );
}

function ContractSection(props: {
  emptyMessage: string;
  icon: React.ReactNode;
  properties: readonly (SourceComponentProp | SourceComponentSlot)[];
  slotLayers?: readonly SourceWorkspaceLayer[];
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
  title: "Props" | "Slots";
}) {
  return (
    <section aria-labelledby={`source-contract-${props.title.toLowerCase()}`} className="border-b border-white/10">
      <header className="flex min-h-10 items-center gap-2 px-4 text-zinc-500">
        {props.icon}
        <h3 id={`source-contract-${props.title.toLowerCase()}`} className="text-[10px] font-medium uppercase tracking-[0.14em]">
          {props.title}
        </h3>
        <span className="ml-auto text-[9px] tabular-nums text-zinc-700">{props.properties.length}</span>
      </header>
      {props.properties.length ? (
        <dl>
          {props.properties.map((property) => (
            <ContractProperty
              key={property.name}
              property={property}
              slotLayer={"accepts" in property ? props.slotLayers?.find((layer) => layer.label === property.name) : undefined}
              slotEditorReady={props.slotEditorReady}
              candidatesForSlot={props.candidatesForSlot}
              onApplySlot={props.onApplySlot}
              onPrepareSlotEdit={props.onPrepareSlotEdit}
            />
          ))}
        </dl>
      ) : (
        <p className="px-4 pb-4 text-[10px] leading-4 text-zinc-600">{props.emptyMessage}</p>
      )}
    </section>
  );
}

function ContractProperty(props: {
  property: SourceComponentProp | SourceComponentSlot;
  slotLayer?: SourceWorkspaceLayer;
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
}) {
  const slot = "accepts" in props.property ? props.property : undefined;
  if (slot) return <SlotContractProperty {...props} slot={slot} />;

  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      <dt className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">{props.property.name}</span>
        <span className={`text-[9px] font-medium ${props.property.required ? "text-amber-300" : "text-zinc-600"}`}>
          {props.property.required ? "Required" : "Optional"}
        </span>
      </dt>
      <dd className="mt-1.5">
        <code className="block whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-sky-300/80">
          {props.property.type}
        </code>
      </dd>
    </div>
  );
}

function SlotContractProperty(props: {
  slot: SourceComponentSlot;
  slotLayer?: SourceWorkspaceLayer;
  slotEditorReady?: boolean;
  candidatesForSlot?: SourceComponentInspectorProps["candidatesForSlot"];
  onApplySlot?: SourceComponentInspectorProps["onApplySlot"];
  onPrepareSlotEdit?: SourceComponentInspectorProps["onPrepareSlotEdit"];
}) {
  const { slot, slotLayer } = props;
  return (
    <div className="border-t border-white/[0.06] px-4 py-3.5">
      <dt className="flex min-w-0 items-center gap-2">
        <Component aria-hidden="true" className="shrink-0 text-zinc-600" size={13} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-zinc-200">{slot.name}</span>
        <span className={`shrink-0 text-[9px] font-medium ${slot.required ? "text-amber-300" : "text-zinc-600"}`}>
          {formatSlotCardinality(slot)}
        </span>
      </dt>
      <dd className="mt-2.5 pl-[21px]">
        {slotLayer && props.onApplySlot && (
          <SourceComponentPicker
            appearance="field"
            candidates={props.candidatesForSlot?.(slotLayer) ?? []}
            isBusy={props.slotEditorReady === false}
            slot={slotLayer}
            onOpen={props.onPrepareSlotEdit}
            onApply={(candidate, action) => props.onApplySlot?.(slotLayer, candidate, action)}
          />
        )}
        <p className={`${slotLayer && props.onApplySlot ? "mt-2.5" : ""} mb-1.5 text-[8px] font-medium uppercase tracking-[0.12em] text-zinc-700`}>Accepts</p>
        <div className="flex flex-wrap gap-1.5">
          {slot.accepts.map((accepted) => (
            <Chip key={accepted} className="h-5 border-white/[0.08] bg-white/[0.035] px-1.5 text-[9px] text-sky-300/80" size="sm" variant="secondary">
              {accepted}
            </Chip>
          ))}
        </div>
        <details className="group/type mt-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[9px] text-zinc-600 transition-colors hover:text-zinc-400">
            <ChevronRight aria-hidden="true" className="transition-transform group-open/type:rotate-90" size={11} />
            Type definition
          </summary>
          <code className="mt-2 block whitespace-pre-wrap break-words border-l border-white/[0.08] pl-3 font-mono text-[9px] leading-4 text-sky-300/70">
            {slot.type}
          </code>
        </details>
      </dd>
    </div>
  );
}

function formatSlotCardinality(slot: SourceComponentSlot): string {
  const cardinality = slot.max === slot.min
    ? String(slot.min)
    : slot.min === 0 && slot.max !== undefined
      ? `up to ${slot.max}`
      : slot.max === undefined
        ? `${slot.min}+`
        : `${slot.min}–${slot.max}`;
  return `${slot.required ? "Required" : "Optional"} · ${cardinality}`;
}
