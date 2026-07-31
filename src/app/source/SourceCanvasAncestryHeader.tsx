import { useLayoutEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { ChevronRight } from "lucide-react";

import type { SourceCanvasAncestryItem, SourceCanvasSlotTab } from "./source-canvas-ancestry";

export function SourceCanvasAncestryHeader(props: {
  items: readonly SourceCanvasAncestryItem[];
  deviceSwitcher?: React.ReactNode;
  onSelect?: (item: SourceCanvasAncestryItem) => void;
  onSelectSlot?: (slot: SourceCanvasSlotTab) => void;
  slotOwnerLabel?: string;
  slots?: readonly SourceCanvasSlotTab[];
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const pathKey = props.items.map((item) => `${item.kind}:${item.id}`).join("/");

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const revealCurrent = () => { list.scrollLeft = list.scrollWidth; };
    revealCurrent();
    const frame = requestAnimationFrame(revealCurrent);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(revealCurrent);
    observer?.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathKey]);

  if (props.items.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 flex-col overflow-hidden rounded-t-md border border-b-0 border-white/[0.12] bg-[#15161a] text-[10px] text-zinc-500 ${props.slots?.length ? "h-16" : "h-9"}`}
      data-design-space-canvas-chrome
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav aria-label="Canvas ancestry" className="flex h-9 min-w-0 shrink-0 items-center overflow-hidden">
        {props.deviceSwitcher ? (
          <div className="flex h-full shrink-0 items-center border-r border-white/[0.08] px-1">
            {props.deviceSwitcher}
          </div>
        ) : null}
        <span className="flex h-full shrink-0 items-center border-r border-white/[0.08] px-2.5 font-medium text-zinc-400">
          <span className="hidden sm:inline">From&nbsp;</span>root
        </span>
        <ol ref={listRef} className="flex h-full min-w-0 flex-1 items-center overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {props.items.map((item, index) => {
            const current = index === props.items.length - 1;
            const approval = item.approval;
            const approvalClasses = approval?.tone === "approved"
              ? "bg-emerald-400/[0.06] text-emerald-300"
              : approval?.tone === "invalid"
                ? "bg-rose-400/[0.07] text-rose-300"
                : approval
                  ? "bg-amber-400/[0.06] text-amber-300"
                  : undefined;
            const badgeClasses = approval?.tone === "approved"
              ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
              : approval?.tone === "invalid"
                ? "bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/30"
                : approval
                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30"
                  : current
                    ? "bg-fuchsia-400 text-[#1a0d1c]"
                    : "bg-white/[0.07] text-zinc-400";
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`grid size-4 shrink-0 place-items-center rounded text-[9px] tabular-nums ${badgeClasses}`}
                >
                  {index}
                </span>
                <span className="max-w-44 truncate">{item.label}</span>
              </>
            );
            return (
              <li className="flex shrink-0 items-center" key={`${item.kind}:${item.id}`}>
                {index > 0 ? <ChevronRight aria-hidden="true" className="mx-1 shrink-0 text-zinc-700" size={12} /> : null}
                {current || !props.onSelect || item.kind !== "component" ? (
                  <span
                    aria-current={current ? "location" : undefined}
                    aria-label={approval ? `${item.label} · ${approval.label}` : undefined}
                    className={`flex h-7 items-center gap-1.5 rounded px-1.5 ${approvalClasses ?? (current ? "font-medium text-fuchsia-300" : "text-zinc-400")}`}
                    data-approval-tone={approval?.tone}
                    title={approval?.label}
                  >
                    {content}
                  </span>
                ) : (
                  <Button
                    aria-label={approval ? `${item.label} · ${approval.label}` : undefined}
                    className={`flex h-7 items-center gap-1.5 rounded px-1.5 outline-none hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-sky-300 ${approvalClasses ?? "text-zinc-400 hover:text-zinc-100"}`}
                    data-approval-tone={approval?.tone}
                    size="sm"
                    variant="ghost"
                    onPress={() => props.onSelect?.(item)}
                  >
                    {content}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {props.slots?.length ? (
        <div className="flex h-7 min-w-0 items-center gap-1 border-t border-white/[0.08] px-1.5">
          <span className="hidden shrink-0 px-1 text-[9px] text-zinc-600 sm:inline">
            {props.slotOwnerLabel ? `${props.slotOwnerLabel} slots` : "Parent slots"}
          </span>
          <div aria-label="Parent slots" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
            {props.slots.map((slot) => (
              <Button
                key={slot.id}
                aria-pressed={slot.active}
                className={`h-5 min-w-0 shrink-0 rounded px-2 text-[9px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-fuchsia-300 ${slot.active ? "bg-fuchsia-400/15 font-medium text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/35" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"}`}
                size="sm"
                variant="ghost"
                onPress={() => props.onSelectSlot?.(slot)}
              >
                {slot.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
