import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const headerRef = useRef<HTMLDivElement>(null);
  const activeSlot = props.slots?.find((slot) => slot.active);
  const lastItem = props.items.at(-1);
  const pathItems = activeSlot && lastItem?.kind === "slot" && lastItem.id === activeSlot.id
    ? props.items.slice(0, -1)
    : props.items;
  const [pathCapacity, setPathCapacity] = useState(pathItems.length);
  const pathKey = [
    ...pathItems.map((item) => `${item.kind}:${item.id}`),
    ...(props.slots?.map((slot) => `choice:${slot.id}:${slot.active}`) ?? []),
  ].join("/");
  const visibleItems = useMemo(() => pathItems
    .map((item, index) => ({ index, item }))
    .slice(-pathCapacity), [pathCapacity, pathItems]);
  const hiddenItems = pathItems.length - visibleItems.length;

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
  }, [pathCapacity, pathKey]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? header.clientWidth;
      const next = width < 360 ? 1 : width < 560 ? 2 : pathItems.length;
      setPathCapacity((current) => current === next ? current : next);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [pathItems.length]);

  if (props.items.length === 0) return null;

  return (
    <div
      ref={headerRef}
      className="flex h-9 min-w-0 overflow-hidden rounded-t-md border border-b-0 border-white/[0.12] bg-[#15161a] text-[10px] text-zinc-500"
      data-design-space-canvas-chrome
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav aria-label="Canvas ancestry" className="flex h-9 min-w-0 flex-1 items-center overflow-hidden">
        {props.deviceSwitcher ? (
          <div className="flex h-full shrink-0 items-center border-r border-white/[0.08] px-1">
            {props.deviceSwitcher}
          </div>
        ) : null}
        <span className="flex h-full shrink-0 items-center border-r border-white/[0.08] px-2.5 font-medium text-zinc-400">
          <span className="hidden sm:inline">From&nbsp;</span>root
        </span>
        <ol ref={listRef} className="flex h-full min-w-0 flex-1 items-center overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {hiddenItems > 0 ? <li aria-hidden="true" className="shrink-0 px-1 text-zinc-600">…</li> : null}
          {visibleItems.map(({ item, index }, visibleIndex) => {
            const current = !activeSlot && index === pathItems.length - 1;
            const approval = item.approval;
            const approvalClasses = approval?.tone === "approved"
              ? "bg-emerald-400/[0.06] text-emerald-300"
              : approval?.tone === "invalid"
                ? "bg-rose-400/[0.07] text-rose-300"
                : approval
                  ? "bg-amber-400/[0.06] text-amber-300"
                  : undefined;
            const slotClasses = item.kind === "slot"
              ? item.scope === "shared"
                ? "bg-sky-400/[0.08] text-sky-300"
                : "bg-fuchsia-400/[0.08] text-fuchsia-300"
              : undefined;
            const badgeClasses = approval?.tone === "approved"
              ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
              : approval?.tone === "invalid"
                ? "bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/30"
                : approval
                  ? "bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30"
                  : item.kind === "slot" && item.scope === "shared"
                    ? "bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-400/30"
                    : item.kind === "slot"
                      ? "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/30"
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
                {visibleIndex > 0 ? <ChevronRight aria-hidden="true" className="mx-1 shrink-0 text-zinc-700" size={12} /> : null}
                {current || !props.onSelect || item.kind !== "component" ? (
                  <span
                    aria-current={current ? "location" : undefined}
                    aria-label={approval ? `${item.label} · ${approval.label}` : undefined}
                    className={`flex h-7 items-center gap-1.5 rounded px-1.5 ${approvalClasses ?? slotClasses ?? (current ? "font-medium text-fuchsia-300" : "text-zinc-400")}`}
                    data-approval-tone={approval?.tone}
                    data-slot-scope={item.kind === "slot" ? item.scope : undefined}
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
          {props.slots?.length ? (
            <li className="flex shrink-0 items-center">
              <ChevronRight aria-hidden="true" className="mx-1 shrink-0 text-zinc-700" size={12} />
              <div
                aria-label={props.slotOwnerLabel ? `Child slots of ${props.slotOwnerLabel}` : "Child slots"}
                className="flex items-center gap-0.5 rounded bg-black/15 p-0.5"
                role="group"
              >
                {props.slots.map((slot) => (
                  <Button
                    key={slot.id}
                    aria-label={`slot:${slot.label}`}
                    aria-description={slot.scope === "shared" ? "Shared component boundary" : "App tree slot"}
                    aria-current={slot.active ? "location" : undefined}
                    aria-pressed={slot.active}
                    className={`h-6 min-w-0 shrink-0 rounded px-2 text-[9px] outline-none transition-colors focus-visible:ring-1 ${slot.scope === "shared" ? slot.active ? "bg-sky-400/15 font-medium text-sky-300 ring-1 ring-inset ring-sky-400/35 focus-visible:ring-sky-300" : "text-sky-400/70 hover:bg-sky-400/[0.08] hover:text-sky-200 focus-visible:ring-sky-300" : slot.active ? "bg-fuchsia-400/15 font-medium text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/35 focus-visible:ring-fuchsia-300" : "text-zinc-500 hover:bg-fuchsia-400/[0.08] hover:text-fuchsia-200 focus-visible:ring-fuchsia-300"}`}
                    data-slot-scope={slot.scope}
                    size="sm"
                    variant="ghost"
                    onPress={() => props.onSelectSlot?.(slot)}
                  >
                    {slot.active ? `slot:${slot.label}` : slot.label}
                  </Button>
                ))}
              </div>
            </li>
          ) : null}
        </ol>
      </nav>
    </div>
  );
}
