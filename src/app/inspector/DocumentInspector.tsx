import { Button } from "@heroui/react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import { ItemEditorActions, ItemEditorIdentity } from "../components/ItemEditorChrome";
import { ItemEditorTools } from "../components/ItemEditorTools";
import type { SlotState } from "../types";

export function DocumentInspector(props: {
  className?: string;
  componentLabel: string;
  sourceLabel?: string;
  sourceBacked?: boolean;
  htmlElement?: boolean;
  controls: readonly ComponentControl[];
  values: Readonly<Record<string, DesignValue | undefined>>;
  slots: readonly SlotState[];
  compileError?: string;
  compilePending: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onEditDefinition?: () => void;
  onOpenIsolated?: () => void;
  onControlChange: (prop: string, value: DesignValue | undefined) => void;
  onSelectSlot: (slot: SlotState) => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <aside className={`${props.className ?? "flex w-80"} min-w-0 shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#141518]`}>
      <ItemEditorIdentity
        componentLabel={props.componentLabel}
        sourceLabel={props.sourceLabel}
        sourceBacked={props.sourceBacked}
        htmlElement={props.htmlElement}
        onEditDefinition={props.onEditDefinition}
        onOpenIsolated={props.onOpenIsolated}
      />
      {!props.htmlElement && <ItemEditorActions
        canMoveUp={props.canMoveUp}
        canMoveDown={props.canMoveDown}
        canDuplicate={props.canDuplicate}
        canDelete={props.canDelete}
        onMove={props.onMove}
        onDuplicate={props.onDuplicate}
        onDelete={props.onDelete}
      />}
      <ItemEditorTools
        mode="desktop"
        controls={props.controls}
        values={props.values}
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
      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#111214] p-3">
        <Button variant="secondary" onPress={props.onCancel}>Cancel</Button>
        <Button isDisabled={props.compilePending || Boolean(props.compileError)} onPress={props.onApply}>
          {props.compilePending ? "Checking…" : "Apply"}
        </Button>
      </footer>
    </aside>
  );
}
