import { Button, Drawer } from "@heroui/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

import type { ComponentControl } from "../../shared/contracts";
import type { DesignValue } from "../../shared/design-document";
import type { SlotState } from "../types";
import { ItemEditorActions, ItemEditorIdentity } from "./ItemEditorChrome";
import { ItemEditorTools } from "./ItemEditorTools";
import { useMobileViewport } from "./use-mobile-viewport";

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
  htmlElement?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  onControlChange: (prop: string, value: DesignValue | undefined) => void;
  onSelectSlot?: (slot: SlotState) => void;
  onEditDefinition?: () => void;
  onOpenIsolated?: () => void;
  onMove: (offset: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onApply: () => void;
};

export function MobileItemEditor(props: MobileItemEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const mobile = useMobileViewport();

  if (!mobile) return null;

  return (
    <Drawer.Backdrop isOpen onOpenChange={(open) => { if (!open) props.onCancel(); }} variant="transparent">
      <Drawer.Content placement="bottom">
        <Drawer.Dialog
          aria-label={`Edit ${props.componentLabel}`}
          className={`max-h-none w-full overflow-hidden rounded-b-none rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] p-0 text-zinc-200 shadow-2xl transition-[height] duration-300 ${expanded ? "h-[86dvh]" : "h-[62dvh]"}`}
          render={(dialogProps) => <section {...dialogProps} aria-modal="true" />}
        >
          <style data-design-space-item-preview>{props.previewCss}</style>
          <div className="relative shrink-0">
            <Drawer.Handle className="h-11 pb-0" />
            <Button
              isIconOnly
              aria-label={expanded ? "Collapse item editor" : "Expand item editor"}
              className="absolute right-1 top-0 size-11"
              size="sm"
              variant="ghost"
              onPress={() => setExpanded((value) => !value)}
            >
              {expanded ? <Minimize2 aria-hidden="true" size={14} /> : <Maximize2 aria-hidden="true" size={14} />}
            </Button>
          </div>
          <Drawer.Body className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <ItemEditorIdentity
              mobile
              componentLabel={props.componentLabel}
              sourceLabel={props.sourceLabel}
              sourceBacked={props.sourceBacked}
              htmlElement={props.htmlElement}
              onBack={props.onCancel}
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
          </Drawer.Body>
          <Drawer.Footer className="mt-0 grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-[#101113] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <Button className="min-h-11" variant="secondary" onPress={props.onCancel}>Cancel</Button>
            <Button className="min-h-11" isDisabled={Boolean(props.compileError) || props.compilePending} onPress={props.onApply}>
              {props.compilePending ? "Checking…" : "Apply"}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

export function replaceClassGroup(current: string, group: readonly string[], next: string): string {
  const candidates = new Set(group.filter(Boolean));
  const tokens = current.split(/\s+/).filter((token) => token && !candidates.has(token));
  if (next) tokens.push(next);
  return tokens.join(" ");
}
