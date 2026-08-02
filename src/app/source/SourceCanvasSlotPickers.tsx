import { useLayoutEffect, useState } from "react";

import type { SourceWorkspaceLayer } from "../../shared/source-workspace";
import { SourceComponentPicker } from "./SourceComponentPicker";
import type { SourceComponentCandidate } from "./source-slot-composition";

type SlotRect = {
  height: number;
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
};

export function SourceCanvasSlotPickers(props: {
  candidatesForSlot: (slot: SourceWorkspaceLayer) => readonly SourceComponentCandidate[];
  frame: HTMLIFrameElement | null;
  isBusy: boolean;
  revision: number;
  slots: readonly SourceWorkspaceLayer[];
  onApply: (slot: SourceWorkspaceLayer, candidate: SourceComponentCandidate, action: "add" | "replace") => void;
}) {
  const [rects, setRects] = useState<readonly SlotRect[]>([]);

  useLayoutEffect(() => {
    const frame = props.frame;
    const document = frame?.contentDocument;
    if (!frame || !document) {
      setRects([]);
      return undefined;
    }
    const output = document.getElementById("design-space-preview-root");
    const measure = () => {
      const next = [...(output?.querySelectorAll<HTMLElement>("[data-design-space-source-slot-name]") ?? [])]
        .map((element, index): SlotRect | undefined => {
          const label = element.dataset.designSpaceSourceSlotName;
          if (!label || !props.slots.some((slot) => slot.label === label)) return undefined;
          const rect = element.getBoundingClientRect();
          return {
            height: Math.max(40, rect.height),
            key: `${label}:${index}`,
            label,
            left: rect.left,
            top: rect.top,
            width: Math.max(72, rect.width),
          };
        })
        .filter((rect): rect is SlotRect => Boolean(rect));
      setRects(next);
    };
    const ownerWindow = document.defaultView;
    const observer = ownerWindow && "ResizeObserver" in ownerWindow
      ? new ownerWindow.ResizeObserver(measure)
      : undefined;
    if (output) observer?.observe(output);
    document.addEventListener("scroll", measure, true);
    ownerWindow?.addEventListener("resize", measure);
    measure();
    return () => {
      observer?.disconnect();
      document.removeEventListener("scroll", measure, true);
      ownerWindow?.removeEventListener("resize", measure);
    };
  }, [props.frame, props.revision, props.slots]);

  if (!rects.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-testid="source-canvas-slot-pickers">
      {rects.map((rect) => {
        const slot = props.slots.find((candidate) => candidate.label === rect.label);
        if (!slot) return null;
        return (
          <div
            key={rect.key}
            className="pointer-events-auto absolute"
            style={{ height: rect.height, left: rect.left, top: rect.top, width: rect.width }}
          >
            <SourceComponentPicker
              appearance="canvas"
              candidates={props.candidatesForSlot(slot)}
              isBusy={props.isBusy}
              slot={slot}
              onApply={(candidate, action) => props.onApply(slot, candidate, action)}
            />
          </div>
        );
      })}
    </div>
  );
}
