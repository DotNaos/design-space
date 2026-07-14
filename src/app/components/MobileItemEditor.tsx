import { Button } from "@heroui/react";
import { ArrowLeft, ChevronDown, ChevronUp, CircleDot, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import type { SlotState } from "../types";
import { TailwindClassField } from "../inspector/TailwindClassField";
import { TailwindMappedControls } from "../inspector/TailwindMappedControls";
import { PropertyControlField } from "./PropertyControlField";

type MobileItemEditorProps = {
  componentLabel: string;
  sourceLabel?: string;
  controls: readonly ComponentControl[];
  controlValues: Readonly<Record<string, DesignValue | undefined>>;
  previewCss: string;
  slots: SlotState[];
  compileError?: string;
  compilePending: boolean;
  sourceBacked: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onControlChange: (prop: string, value: DesignValue | undefined) => void;
  onSelectSlot?: (slot: SlotState) => void;
  onEditDefinition?: () => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onApply: () => void;
};

export function MobileItemEditor(props: MobileItemEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false);
  const tailwindControls = props.controls.filter((control) => control.kind === "tailwind");
  const tailwindControl = tailwindControls[0];
  const nonTailwindControls = props.controls.filter((control) => control.kind !== "tailwind");
  const rawTailwindValue = tailwindControl ? props.controlValues[tailwindControl.prop] : "";
  const tailwindValue = typeof rawTailwindValue === "string" ? rawTailwindValue : "";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isMobileEditorViewport()) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Edit ${props.componentLabel}`}
      aria-modal="true"
      className={`fixed inset-x-0 bottom-0 top-auto z-50 m-0 ml-0 hidden w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] p-0 text-zinc-200 shadow-2xl backdrop:bg-transparent open:flex lg:!hidden ${expanded ? "h-[84dvh]" : "h-[58dvh]"}`}
      onCancel={(event) => {
        event.preventDefault();
        props.onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        props.onCancel();
      }}
    >
      <style data-design-space-item-preview>{props.previewCss}</style>
      <button aria-label={expanded ? "Collapse item editor" : "Expand item editor"} className="grid h-7 shrink-0 place-items-center" type="button" onClick={() => setExpanded((value) => !value)}>
        <span className="h-1 w-10 rounded-full bg-zinc-700" />
      </button>
      <header className="flex h-12 shrink-0 items-center border-b border-white/10 px-2">
        <Button aria-label="Back to canvas" isIconOnly size="sm" variant="ghost" onPress={props.onCancel}>
          <ArrowLeft size={17} />
        </Button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <h2 className="truncate text-sm font-semibold text-zinc-100">{props.componentLabel}</h2>
          <p className="truncate text-[9px] text-zinc-600">{props.sourceLabel ?? "Target-owned adapter"}</p>
        </div>
        {props.onEditDefinition ? <Button size="sm" variant="ghost" onPress={props.onEditDefinition}>Definition</Button> : <span className={`w-9 text-center text-[9px] ${props.sourceBacked ? "text-emerald-400" : "text-zinc-600"}`}>{props.sourceBacked ? "Source" : "Draft"}</span>}
      </header>

      <div aria-label="Item actions" className="grid shrink-0 grid-cols-4 border-b border-white/10 bg-[#111214]">
        <Action label="Move up" disabled={!props.canMoveUp} icon={<ChevronUp size={17} />} onPress={() => props.onMove(-1)} />
        <Action label="Move down" disabled={!props.canMoveDown} icon={<ChevronDown size={17} />} onPress={() => props.onMove(1)} />
        <Action label="Duplicate" disabled={!props.canDuplicate} icon={<Copy size={16} />} onPress={props.onDuplicate} />
        <Action danger label="Delete" disabled={!props.canDelete} icon={<Trash2 size={16} />} onPress={props.onDelete} />
      </div>

      <div className="min-h-0 flex-1 scroll-pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain">
        {tailwindControl && (
          <PropertySection title="Tailwind">
            <TailwindMappedControls value={tailwindValue} onChange={(value) => props.onControlChange(tailwindControl.prop, value)} />
            <TailwindClassField
              compileError={props.compileError}
              label={tailwindControl.label}
              value={tailwindValue}
              onChange={(value) => props.onControlChange(tailwindControl.prop, value)}
            />
          </PropertySection>
        )}

        {nonTailwindControls.length > 0 && (
          <PropertySection title="Content">
            {nonTailwindControls.map((control) => (
              <PropertyControlField
                key={control.id}
                control={control}
                value={props.controlValues[control.prop]}
                onChange={(value) => props.onControlChange(control.prop, value)}
              />
            ))}
          </PropertySection>
        )}

        {props.slots.length > 0 && (
          <PropertySection title="Slots">
            <div className="overflow-hidden rounded-xl border border-white/10">
              {props.slots.map((slot) => (
                <button
                  key={slot.id}
                  aria-label={`${slot.label} slot, ${slot.count ? `${slot.count} used` : "empty"}`}
                  className="flex min-h-12 w-full items-center gap-3 border-t border-white/10 px-3 text-left first:border-t-0 disabled:cursor-default"
                  disabled={!props.onSelectSlot}
                  type="button"
                  onClick={() => props.onSelectSlot?.(slot)}
                >
                  <CircleDot size={14} className={slot.count ? "text-emerald-400" : "text-zinc-600"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">{slot.label}</span>
                    <span className="block text-[10px] text-zinc-600">{slot.count ? slot.childLabel ?? `${slot.count} ${slot.count === 1 ? "item" : "items"}` : "Empty slot"}</span>
                  </span>
                  {!slot.count && <Plus size={15} className="text-sky-300" />}
                </button>
              ))}
            </div>
          </PropertySection>
        )}

        {tailwindControls.length > 0 && <p className="px-4 py-3 text-[9px] leading-4 text-zinc-600">Apply updates the local draft. Diff and Save remain separate.</p>}
      </div>

      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#101113] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <Button className="min-h-11" variant="secondary" onPress={props.onCancel}>Cancel</Button>
        <Button className="min-h-11" isDisabled={Boolean(props.compileError) || props.compilePending} onPress={props.onApply}>
          {props.compilePending ? "Checking…" : "Apply"}
        </Button>
      </footer>
    </dialog>
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

export function replaceClassGroup(current: string, group: readonly string[], next: string): string {
  const candidates = new Set(group.filter(Boolean));
  const tokens = current.split(/\s+/).filter((token) => token && !candidates.has(token));
  if (next) tokens.push(next);
  return tokens.join(" ");
}

function isMobileEditorViewport(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia("(max-width: 1023px)").matches;
}
