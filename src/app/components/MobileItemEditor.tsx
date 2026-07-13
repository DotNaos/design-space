import { Button, Input, Label, TextField } from "@heroui/react";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";

import type { ComponentControl } from "../../shared/contracts";
import type { Selection } from "../types";
import type { SlotState } from "../types";
import { PreviewCanvas } from "./PreviewCanvas";

type MobileItemEditorProps = {
  componentLabel: string;
  sourceLabel?: string;
  controls: readonly ComponentControl[];
  controlValues: Readonly<Record<string, string>>;
  preview: React.ReactNode;
  previewCss: string;
  rootInstanceId: string;
  selectedInstanceId: string;
  slots: SlotState[];
  compileError?: string;
  compilePending: boolean;
  sourceBacked: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onControlChange: (prop: string, value: string) => void;
  onSelectComponent: (instanceId: string) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onApply: () => void;
};

const classGroups = [
  { title: "Padding", values: ["", "p-4", "p-6", "p-8"] },
  { title: "Width", values: ["", "w-full", "max-w-md", "max-w-xl"] },
  { title: "Radius", values: ["rounded-none", "rounded-xl", "rounded-2xl", "rounded-3xl"] },
  { title: "Background", values: ["", "bg-slate-900", "bg-zinc-950"] },
  { title: "Shadow", values: ["shadow-none", "shadow-lg", "shadow-2xl"] },
  { title: "Text size", values: ["text-xs", "text-sm", "text-base", "text-lg", "text-2xl"] },
] as const;

export function MobileItemEditor(props: MobileItemEditorProps) {
  const tailwindControls = props.controls.filter((control) => control.kind === "tailwind");
  const tailwindControl = tailwindControls[0];
  const textControls = props.controls.filter((control) => control.kind === "text");
  const tailwindValue = tailwindControl ? props.controlValues[tailwindControl.prop] ?? "" : "";

  return (
    <section aria-label={`Edit ${props.componentLabel}`} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0d0e10] text-zinc-200 lg:hidden">
      <style data-design-space-item-preview>{props.previewCss}</style>
      <header className="flex h-12 shrink-0 items-center border-b border-white/10 bg-[#101113] px-2">
        <Button aria-label="Back to canvas" isIconOnly size="sm" variant="ghost" onPress={props.onCancel}>
          <ArrowLeft size={17} />
        </Button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <h2 className="truncate text-sm font-semibold text-zinc-100">{props.componentLabel}</h2>
          <p className="truncate text-[9px] text-zinc-600">{props.sourceLabel ?? "Target-owned adapter"}</p>
        </div>
        <span className={`w-9 text-center text-[9px] ${props.sourceBacked ? "text-emerald-400" : "text-zinc-600"}`}>
          {props.sourceBacked ? "Source" : "Draft"}
        </span>
      </header>

      <div className="h-[min(15rem,34dvh)] min-h-36 shrink-0 border-b border-white/10">
        <PreviewCanvas
          compact
          className="flex h-full w-full"
          preview={props.preview}
          rootInstanceId={props.rootInstanceId}
          selectedComponentInstanceId={props.selectedInstanceId}
          selection={{ kind: "component", id: props.selectedInstanceId }}
          selectionLabel={props.componentLabel}
          slots={props.slots}
          onEditComponent={props.onSelectComponent}
          onSelect={(selection: Selection) => {
            if (selection.kind === "component") props.onSelectComponent(selection.id);
          }}
        />
      </div>

      <div aria-label="Item actions" className="grid shrink-0 grid-cols-4 border-b border-white/10 bg-[#111214]">
        <Action label="Move up" disabled={!props.canMoveUp} icon={<ChevronUp size={17} />} onPress={() => props.onMove(-1)} />
        <Action label="Move down" disabled={!props.canMoveDown} icon={<ChevronDown size={17} />} onPress={() => props.onMove(1)} />
        <Action label="Duplicate" disabled={!props.canDuplicate} icon={<Copy size={16} />} onPress={props.onDuplicate} />
        <Action danger label="Delete" disabled={!props.canDelete} icon={<Trash2 size={16} />} onPress={props.onDelete} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tailwindControl && (
          <>
            <PropertySection title="Layout">
              {classGroups.slice(0, 2).map((group) => (
                <ClassChoice key={group.title} {...group} value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
              ))}
            </PropertySection>
            <PropertySection title="Surface">
              {classGroups.slice(2, 5).map((group) => (
                <ClassChoice key={group.title} {...group} value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
              ))}
            </PropertySection>
            <PropertySection title="Typography">
              <ClassChoice {...classGroups[5]} value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
            </PropertySection>
          </>
        )}

        {textControls.length > 0 && (
          <PropertySection title="Content">
            {textControls.map((control) => (
              <TextField key={control.id} fullWidth value={props.controlValues[control.prop] ?? ""} onChange={(value) => props.onControlChange(control.prop, value)}>
                <Label className="text-[10px] text-zinc-500">{control.label}</Label>
                <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-zinc-200" aria-label={control.label} />
              </TextField>
            ))}
          </PropertySection>
        )}

        {tailwindControls.length > 0 && (
          <PropertySection title="Tailwind classes">
            {tailwindControls.map((control) => (
              <TextField key={control.id} fullWidth value={props.controlValues[control.prop] ?? ""} onChange={(value) => props.onControlChange(control.prop, value)}>
                <Label className="text-[10px] text-zinc-500">{control.label}</Label>
                <Input className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 font-mono text-[11px] text-zinc-200" aria-label={control.prop} />
              </TextField>
            ))}
            <p className={`mt-2 text-[10px] leading-4 ${props.compileError ? "text-rose-300" : "text-zinc-600"}`}>
              {props.compileError ?? (props.sourceBacked
                ? "Apply creates a live source draft. Diff and Save remain separate."
                : "Apply commits this composition draft without writing target source.")}
            </p>
          </PropertySection>
        )}
      </div>

      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#101113] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <Button className="min-h-11" variant="secondary" onPress={props.onCancel}>Cancel</Button>
        <Button className="min-h-11" isDisabled={Boolean(props.compileError) || props.compilePending} onPress={props.onApply}>
          {props.compilePending ? "Checking…" : "Apply"}
        </Button>
      </footer>
    </section>
  );
}

function Action(props: { label: string; icon: React.ReactNode; disabled: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <button
      className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] transition-colors disabled:opacity-30 ${props.danger ? "text-rose-400" : "text-zinc-400"}`}
      disabled={props.disabled}
      type="button"
      onClick={props.onPress}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function PropertySection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <h3 className="mb-3 text-xs font-semibold text-zinc-300">{props.title}</h3>
      <div className="space-y-4">{props.children}</div>
    </section>
  );
}

function ClassChoice(props: { title: string; values: readonly string[]; value: string; onChange: (value: string) => void }) {
  const tokens = props.value.split(/\s+/).filter(Boolean);
  return (
    <div>
      <p className="mb-2 text-[10px] text-zinc-500">{props.title}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {props.values.map((value) => {
          const active = value ? tokens.includes(value) : !props.values.some((candidate) => candidate && tokens.includes(candidate));
          return (
            <button
              key={value || "default"}
              aria-pressed={active}
              className={`min-h-11 truncate rounded-lg border px-2 text-[10px] ${active ? "border-indigo-400 bg-indigo-500/15 text-indigo-200" : "border-white/10 bg-black/10 text-zinc-500"}`}
              type="button"
              onClick={() => props.onChange(replaceClassGroup(props.value, props.values, value))}
            >
              {classLabel(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function replaceClassGroup(current: string, group: readonly string[], next: string): string {
  const candidates = new Set(group.filter(Boolean));
  const tokens = current.split(/\s+/).filter((token) => token && !candidates.has(token));
  if (next) tokens.push(next);
  return tokens.join(" ");
}

function classLabel(value: string): string {
  if (!value) return "Default";
  return value.replace(/^(?:rounded-|bg-|shadow-|text-|max-w-|w-|p-)/, "") || value;
}
