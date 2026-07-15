import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import type { SlotState } from "../types";
import { ItemEditorActions, ItemEditorIdentity } from "./ItemEditorChrome";
import { ItemEditorTools } from "./ItemEditorTools";

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
  const nestedEscapeGuard = useRef(false);
  const nestedEscapeTimer = useRef<number | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isMobileEditorViewport()) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (nestedEscapeTimer.current !== undefined) window.clearTimeout(nestedEscapeTimer.current);
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
      className={`fixed inset-x-0 bottom-0 top-auto z-50 m-0 ml-0 hidden w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] p-0 text-zinc-200 shadow-2xl backdrop:bg-transparent open:flex lg:!hidden ${expanded ? "h-[86dvh]" : "h-[62dvh]"}`}
      onCancel={(event) => {
        event.preventDefault();
        if (nestedEscapeGuard.current) {
          nestedEscapeGuard.current = false;
          if (nestedEscapeTimer.current !== undefined) window.clearTimeout(nestedEscapeTimer.current);
          nestedEscapeTimer.current = undefined;
          return;
        }
        props.onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (dialogRef.current?.querySelector('[role="listbox"], [role="menu"]')) {
          nestedEscapeGuard.current = true;
          if (nestedEscapeTimer.current !== undefined) window.clearTimeout(nestedEscapeTimer.current);
          nestedEscapeTimer.current = window.setTimeout(() => {
            nestedEscapeGuard.current = false;
            nestedEscapeTimer.current = undefined;
          }, 100);
          return;
        }
        event.preventDefault();
        props.onCancel();
      }}
    >
      <style data-design-space-item-preview>{props.previewCss}</style>
      <button
        aria-label={expanded ? "Collapse item editor" : "Expand item editor"}
        className="grid h-7 shrink-0 place-items-center"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="h-1 w-10 rounded-full bg-zinc-700" />
      </button>
      <ItemEditorIdentity
        mobile
        componentLabel={props.componentLabel}
        sourceLabel={props.sourceLabel}
        sourceBacked={props.sourceBacked}
        onBack={props.onCancel}
        onEditDefinition={props.onEditDefinition}
      />
      <ItemEditorActions
        canMoveUp={props.canMoveUp}
        canMoveDown={props.canMoveDown}
        canDuplicate={props.canDuplicate}
        canDelete={props.canDelete}
        onMove={props.onMove}
        onDuplicate={props.onDuplicate}
        onDelete={props.onDelete}
      />
      <ItemEditorTools
        mode="mobile"
        controls={props.controls}
        values={props.controlValues}
        slots={props.slots}
        compileError={props.compileError}
        onControlChange={props.onControlChange}
        onSelectSlot={props.onSelectSlot}
      />
      {props.compileError && (
        <p className="shrink-0 border-t border-rose-400/20 bg-rose-500/5 px-4 py-2 text-[9px] leading-4 text-rose-300">
          {props.compileError}
        </p>
      )}
      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#101113] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <Button className="min-h-11" variant="secondary" onPress={props.onCancel}>Cancel</Button>
        <Button className="min-h-11" isDisabled={Boolean(props.compileError) || props.compilePending} onPress={props.onApply}>
          {props.compilePending ? "Checking…" : "Apply"}
        </Button>
      </footer>
    </dialog>
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
