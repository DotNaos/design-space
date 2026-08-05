import type { BoxModelPreview, BoxSide } from "../inspector/tailwind-box-model-values";
import { parseBoxLengthPixels, readBoxValue } from "../inspector/tailwind-box-model-values";

export interface SourceBoxModelPreviewStore {
  getSnapshot: () => BoxModelPreview | undefined;
  set: (preview?: BoxModelPreview) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSourceBoxModelPreviewStore(): SourceBoxModelPreviewStore {
  let value: BoxModelPreview | undefined;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const sides: readonly BoxSide[] = ["top", "right", "bottom", "left"];
const colors = {
  margin: "#fb8b5c",
  border: "#a78bfa",
  padding: "#50e3b5",
} as const;

export function mountSourceBoxModelPreview(target: HTMLElement, preview: BoxModelPreview): () => void {
  const propertyPrefix = preview.kind === "border" ? "border" : preview.kind;
  const saved = new Map<string, { priority: string; value: string }>();
  for (const side of sides) {
    const property = preview.kind === "border" ? `border-${side}-width` : `${propertyPrefix}-${side}`;
    saved.set(property, {
      priority: target.style.getPropertyPriority(property),
      value: target.style.getPropertyValue(property),
    });
    target.style.setProperty(property, readBoxValue(preview.className, preview.kind, side) || "0px", "important");
  }
  if (preview.kind === "border") {
    saved.set("border-style", {
      priority: target.style.getPropertyPriority("border-style"),
      value: target.style.getPropertyValue("border-style"),
    });
    target.style.setProperty("border-style", "solid", "important");
  }

  const overlay = target.ownerDocument.createElement("div");
  overlay.dataset.designSpaceBoxModelPreview = preview.kind;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;";
  target.ownerDocument.body.append(overlay);

  const update = () => drawBoxModelPreview(overlay, target, preview);
  update();
  const ownerWindow = target.ownerDocument.defaultView;
  const resizeObserver = ownerWindow && "ResizeObserver" in ownerWindow
    ? new ownerWindow.ResizeObserver(update)
    : undefined;
  resizeObserver?.observe(target);
  ownerWindow?.addEventListener("resize", update);
  target.ownerDocument.addEventListener("scroll", update, true);

  return () => {
    resizeObserver?.disconnect();
    ownerWindow?.removeEventListener("resize", update);
    target.ownerDocument.removeEventListener("scroll", update, true);
    overlay.remove();
    for (const [property, previous] of saved) {
      if (previous.value) target.style.setProperty(property, previous.value, previous.priority);
      else target.style.removeProperty(property);
    }
  };
}

function drawBoxModelPreview(overlay: HTMLElement, target: HTMLElement, preview: BoxModelPreview): void {
  const rect = target.getBoundingClientRect();
  const computed = target.ownerDocument.defaultView?.getComputedStyle(target);
  const values = Object.fromEntries(sides.map((side) => [
    side,
    parseBoxLengthPixels(readBoxValue(preview.className, preview.kind, side)) ?? 0,
  ])) as Record<BoxSide, number>;
  const color = colors[preview.kind];
  if (preview.kind === "margin") {
    overlay.style.left = `${rect.left - values.left}px`;
    overlay.style.top = `${rect.top - values.top}px`;
    overlay.style.width = `${rect.width + values.left + values.right}px`;
    overlay.style.height = `${rect.height + values.top + values.bottom}px`;
    overlay.style.borderStyle = "solid";
    overlay.style.borderColor = color;
    overlay.style.borderWidth = `${values.top}px ${values.right}px ${values.bottom}px ${values.left}px`;
    overlay.style.background = "transparent";
    overlay.style.outline = `1px solid ${color}`;
    overlay.style.opacity = "0.58";
    return;
  }
  if (preview.kind === "border") {
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.borderStyle = "solid";
    overlay.style.borderColor = color;
    overlay.style.borderWidth = `${Math.max(1, values.top)}px ${Math.max(1, values.right)}px ${Math.max(1, values.bottom)}px ${Math.max(1, values.left)}px`;
    overlay.style.background = "transparent";
    overlay.style.outline = "none";
    overlay.style.opacity = "0.82";
    return;
  }
  const borderTop = Number.parseFloat(computed?.borderTopWidth ?? "0") || 0;
  const borderRight = Number.parseFloat(computed?.borderRightWidth ?? "0") || 0;
  const borderBottom = Number.parseFloat(computed?.borderBottomWidth ?? "0") || 0;
  const borderLeft = Number.parseFloat(computed?.borderLeftWidth ?? "0") || 0;
  overlay.style.left = `${rect.left + borderLeft}px`;
  overlay.style.top = `${rect.top + borderTop}px`;
  overlay.style.width = `${Math.max(0, rect.width - borderLeft - borderRight)}px`;
  overlay.style.height = `${Math.max(0, rect.height - borderTop - borderBottom)}px`;
  overlay.style.borderStyle = "solid";
  overlay.style.borderColor = color;
  overlay.style.borderWidth = `${values.top}px ${values.right}px ${values.bottom}px ${values.left}px`;
  overlay.style.background = "transparent";
  overlay.style.outline = `1px solid ${color}`;
  overlay.style.opacity = "0.62";
}
