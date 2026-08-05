import { useLayoutEffect, useRef, useState } from "react";
import { Button, Popover } from "@heroui/react";
import { Component } from "lucide-react";
import type { SourceCanvasAncestryItem, SourceCanvasNavigationNode } from "./source-canvas-ancestry";
import { SourceCanvasNavigationBranch } from "./SourceCanvasNavigationBranch";

export function SourceCanvasTreePopover(props: {
  approvalLabel?: string;
  className: string;
  content: React.ReactNode;
  current: boolean;
  currentComponentId?: string;
  item: SourceCanvasAncestryItem;
  pathIds: ReadonlySet<string>;
  onSelect?: (item: SourceCanvasAncestryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set([props.item.id, ...props.pathIds]));
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const clearClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  };
  const openTree = () => {
    clearClose();
    setExpandedIds((current) => new Set([...current, props.item.id, ...props.pathIds]));
    setOpen(true);
  };
  const closeTree = () => {
    clearClose();
    pointerInside.current = false;
    setOpen(false);
  };
  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => {
      if (
        pointerInside.current
        || triggerRef.current?.matches(":hover")
        || contentRef.current?.matches(":hover")
        || contentRef.current?.contains(document.activeElement)
      ) return;
      setOpen(false);
    }, 240);
  };
  useLayoutEffect(() => () => clearClose(), []);
  const root: SourceCanvasNavigationNode = {
    children: props.item.children ?? [],
    id: props.item.id,
    label: props.item.label,
  };

  return (
    <Popover isOpen={open} onOpenChange={(next) => {
      if (next) openTree();
      else closeTree();
    }}>
      <Button
        ref={triggerRef}
        aria-current={props.current ? "location" : undefined}
        aria-label={props.approvalLabel ? `${props.item.label} · ${props.approvalLabel}` : undefined}
        className={props.className}
        data-approval-tone={props.item.approval?.tone}
        size="sm"
        variant="ghost"
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          pointerInside.current = true;
          openTree();
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          scheduleClose();
        }}
        onPress={() => {
          if (!props.current) props.onSelect?.(props.item);
        }}
      >
        {props.content}
      </Button>
      <Popover.Content
        ref={contentRef}
        className="z-50 w-[min(18rem,calc(100vw-1rem))] rounded-xl bg-[#1b1c20] p-1.5 text-zinc-200 shadow-[0_18px_48px_rgba(0,0,0,0.55)] [&[data-entering=true]]:animate-none [&[data-exiting=true]]:animate-none"
        offset={0}
        placement="bottom start"
        onPointerEnter={() => {
          pointerInside.current = true;
          clearClose();
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          scheduleClose();
        }}
      >
        <Popover.Dialog className="outline-none">
          <div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-medium text-zinc-300">
              <Component aria-hidden="true" className="text-fuchsia-300" size={13} />
              <span className="truncate">{props.item.label} tree</span>
            </div>
            <div aria-label={`${props.item.label} component tree`} className="max-h-80 overflow-auto py-0.5" role="tree">
              <div className="min-w-max">
                <SourceCanvasNavigationBranch
                  currentId={props.currentComponentId}
                  depth={0}
                  expandedIds={expandedIds}
                  node={root}
                  pathIds={props.pathIds}
                  onToggle={(node) => setExpandedIds((current) => {
                    const next = new Set(current);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  })}
                  onSelect={(node) => {
                    setOpen(false);
                    if (node.id === props.currentComponentId) return;
                    props.onSelect?.({ children: node.children, id: node.id, kind: "component", label: node.label });
                  }}
                />
              </div>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
