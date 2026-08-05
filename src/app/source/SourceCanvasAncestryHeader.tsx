import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { ChevronRight } from "lucide-react";

import type { SourceCanvasAncestryItem, SourceCanvasSlotTab } from "./source-canvas-ancestry";
import { SourceCanvasSlotChooser } from "./SourceCanvasSlotChooser";
import { SourceCanvasTreePopover } from "./SourceCanvasTreePopover";

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
  const [expandedPathKey, setExpandedPathKey] = useState<string>();
  const pathKey = [
    ...pathItems.map((item) => `${item.kind}:${item.id}`),
    ...(props.slots?.map((slot) => `choice:${slot.id}:${slot.active}`) ?? []),
  ].join("/");
  const componentPath = new Set(pathItems.filter((item) => item.kind === "component").map((item) => item.id));
  const currentComponentId = [...pathItems].reverse().find((item) => item.kind === "component")?.id;
  const displayEntries = useMemo(() => {
    const indexedItems = pathItems.map((item, index) => ({ index, item }));
    if (expandedPathKey === pathKey || indexedItems.length <= pathCapacity) {
      return indexedItems.map((entry) => ({ kind: "item" as const, ...entry }));
    }
    const leadingCount = pathCapacity > 2 ? 1 : 0;
    const trailingCount = Math.max(1, pathCapacity - leadingCount);
    const leading = indexedItems.slice(0, leadingCount);
    const hidden = indexedItems.slice(leadingCount, -trailingCount);
    const trailing = indexedItems.slice(-trailingCount);
    return [
      ...leading.map((entry) => ({ kind: "item" as const, ...entry })),
      { kind: "overflow" as const, items: hidden },
      ...trailing.map((entry) => ({ kind: "item" as const, ...entry })),
    ];
  }, [expandedPathKey, pathCapacity, pathItems, pathKey]);

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
  }, [expandedPathKey, pathCapacity, pathKey]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? header.clientWidth;
      const next = width < 420 ? 2 : width < 640 ? 3 : width < 860 ? 4 : width < 1080 ? 5 : 6;
      setPathCapacity((current) => current === next ? current : next);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [pathItems.length]);

  if (props.items.length === 0) return null;

  return (
    <div
      ref={headerRef}
      className="flex h-9 min-w-0 overflow-hidden border-b border-white/[0.12] bg-[#15161a] text-[9px] text-zinc-500"
      data-design-space-canvas-chrome
      onPointerDown={(event) => event.stopPropagation()}
    >
      <nav aria-label="Canvas ancestry" className="flex h-9 min-w-0 flex-1 items-center overflow-hidden">
        {props.deviceSwitcher ? (
          <div className="flex h-full shrink-0 items-center border-r border-white/[0.08] px-1.5">
            {props.deviceSwitcher}
          </div>
        ) : null}
        <ol ref={listRef} className="flex h-full min-w-0 flex-1 items-center overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {displayEntries.map((entry, visibleIndex) => {
            if (entry.kind === "overflow") {
              return (
                <li className="flex shrink-0 items-center" key={`overflow:${entry.items.map(({ item }) => item.id).join(":")}`}>
                  {visibleIndex > 0 ? <ChevronRight aria-hidden="true" className="mx-0.5 shrink-0 text-zinc-700" size={10} /> : null}
                  <Button
                    aria-label={`Show ${entry.items.length} hidden path items`}
                    className="h-6 min-w-6 rounded-md bg-white/[0.045] px-1.5 text-[11px] text-zinc-500 outline-none hover:bg-white/[0.08] hover:text-zinc-200 focus-visible:ring-1 focus-visible:ring-sky-300"
                    size="sm"
                    variant="ghost"
                    onPress={() => setExpandedPathKey(pathKey)}
                  >
                    …
                  </Button>
                </li>
              );
            }
            const { item, index } = entry;
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
                    ? "bg-sky-400/15 text-sky-300"
                    : item.kind === "slot"
                      ? "bg-fuchsia-400/15 text-fuchsia-300"
                      : current
                        ? "bg-white/20 text-white"
                        : "bg-white/[0.07] text-zinc-400";
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`grid size-3.5 shrink-0 place-items-center rounded-full text-[8px] tabular-nums ${badgeClasses}`}
                >
                  {index}
                </span>
                <span className="max-w-36 truncate">{item.label}</span>
              </>
            );
            return (
              <li className="flex shrink-0 items-center" key={`${item.kind}:${item.id}`}>
                {visibleIndex > 0 ? <ChevronRight aria-hidden="true" className="mx-0.5 shrink-0 text-zinc-700" size={10} /> : null}
                {item.kind === "component" && item.children ? (
                  <SourceCanvasTreePopover
                    approvalLabel={approval?.label}
                    className={`flex h-6 items-center gap-1 rounded-full px-1.5 outline-none focus-visible:ring-1 ${approvalClasses ?? (current ? "bg-purple-500 !px-2.5 text-[8px] font-medium text-white hover:bg-purple-400 focus-visible:ring-purple-300" : "text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100 focus-visible:ring-sky-300")}`}
                    content={content}
                    current={current}
                    currentComponentId={currentComponentId}
                    item={item}
                    pathIds={componentPath}
                    onSelect={props.onSelect}
                  />
                ) : current || !props.onSelect || item.kind !== "component" ? (
                  <span
                    aria-current={current ? "location" : undefined}
                    aria-label={approval ? `${item.label} · ${approval.label}` : undefined}
                    className={`flex h-6 items-center gap-1 rounded-full px-1.5 ${approvalClasses ?? slotClasses ?? (current ? "bg-purple-500 !px-2.5 text-[8px] font-medium text-white" : "text-zinc-400")}`}
                    data-approval-tone={approval?.tone}
                    data-slot-scope={item.kind === "slot" ? item.scope : undefined}
                    title={approval?.label}
                  >
                    {content}
                  </span>
                ) : (
                  <Button
                    aria-label={approval ? `${item.label} · ${approval.label}` : undefined}
                    className={`flex h-6 items-center gap-1 rounded-full px-1.5 outline-none hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-sky-300 ${approvalClasses ?? "text-zinc-400 hover:text-zinc-100"}`}
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
              <ChevronRight aria-hidden="true" className="mx-0.5 shrink-0 text-zinc-700" size={10} />
              <SourceCanvasSlotChooser
                onSelect={props.onSelectSlot}
                ownerLabel={props.slotOwnerLabel}
                slots={props.slots}
              />
            </li>
          ) : null}
        </ol>
      </nav>
    </div>
  );
}
