import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp, Code2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const DEFAULT_HEIGHT_RATIO = 0.44;
const MIN_PANEL_HEIGHT = 224;
const MIN_TREE_HEIGHT = 120;

export function SourceWorkspaceCodeOverlay(props: {
  children: React.ReactNode;
  code: React.ReactNode;
  height?: number;
  open: boolean;
  onHeightChange?: (height: number | undefined) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragCleanup = useRef<(() => void) | undefined>(undefined);
  const draftHeight = useRef<number | undefined>(props.height);
  const [height, setHeight] = useState<number | undefined>(props.height);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (resizing) return;
    draftHeight.current = props.height;
    setHeight(props.height);
  }, [props.height, resizing]);
  useEffect(() => () => dragCleanup.current?.(), []);

  const bounds = () => sourceCodePanelBounds(containerRef.current?.clientHeight ?? 0);
  const currentHeight = () => {
    const renderedHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
    if (renderedHeight > 0) return renderedHeight;
    return height ?? sourceCodePanelDefaultHeight(containerRef.current?.clientHeight ?? 0);
  };
  const applyHeight = (next: number) => {
    const value = clampSourceCodePanelHeight(next, bounds());
    draftHeight.current = value;
    setHeight(value);
    return value;
  };
  const finishResize = () => {
    setResizing(false);
    props.onHeightChange?.(draftHeight.current);
  };
  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragCleanup.current?.();

    const startY = event.clientY;
    const startHeight = currentHeight();
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    setResizing(true);
    target.setPointerCapture?.(pointerId);

    const move = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      applyHeight(startHeight + startY - moveEvent.clientY);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      try {
        if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      if (dragCleanup.current === cleanup) dragCleanup.current = undefined;
    };
    const stop = (stopEvent: globalThis.PointerEvent) => {
      if (stopEvent.pointerId !== pointerId) return;
      cleanup();
      finishResize();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    dragCleanup.current = cleanup;
  };
  const resizeFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    const limits = bounds();
    let next: number | undefined;
    if (event.key === "Home") next = limits.min;
    if (event.key === "End") next = limits.max;
    if (event.key === "ArrowUp") next = currentHeight() + step;
    if (event.key === "ArrowDown") next = currentHeight() - step;
    if (next === undefined) return;
    event.preventDefault();
    props.onHeightChange?.(applyHeight(next));
  };
  const resetHeight = () => {
    draftHeight.current = undefined;
    setHeight(undefined);
    props.onHeightChange?.(undefined);
  };
  const panelHeight = props.open
    ? height === undefined ? "44%" : `${height}px`
    : "2.5rem";

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      style={{
        "--source-code-overlay-height": panelHeight,
      } as CSSProperties}
    >
      <div className="h-full min-h-0">{props.children}</div>
      <section
        ref={panelRef}
        aria-label="Source code panel"
        className={`absolute inset-x-0 bottom-0 z-20 flex min-h-0 flex-col border-t border-white/10 bg-[#0d0e10] shadow-[0_-16px_36px_rgba(0,0,0,0.42)] ${
          resizing ? "" : "transition-[height] duration-200 ease-out"
        }`}
        style={{ height: panelHeight, maxHeight: props.open ? `calc(100% - ${MIN_TREE_HEIGHT}px)` : undefined }}
      >
        {props.open && (
          <div
            aria-label="Resize code panel"
            aria-orientation="horizontal"
            aria-valuemax={bounds().max}
            aria-valuemin={bounds().min}
            aria-valuenow={Math.round(currentHeight())}
            className="group absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 touch-none cursor-row-resize outline-none"
            onDoubleClick={resetHeight}
            onKeyDown={resizeFromKeyboard}
            onPointerDown={startResize}
            role="separator"
            tabIndex={0}
            title="Drag to resize. Double-click to reset."
          >
            <span className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition-colors group-hover:bg-sky-300/70 group-focus-visible:bg-sky-300" />
          </div>
        )}
        <Button
          aria-expanded={props.open}
          className="h-10 min-h-10 w-full shrink-0 justify-start gap-2 rounded-none px-4 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"
          variant="ghost"
          onPress={() => props.onOpenChange(!props.open)}
        >
          <Code2 aria-hidden="true" className="text-sky-400" size={14} />
          Code
          {props.open
            ? <ChevronDown aria-hidden="true" className="ml-auto" size={13} />
            : <ChevronUp aria-hidden="true" className="ml-auto" size={13} />}
        </Button>
        {props.open ? <div className="min-h-0 flex-1 border-t border-white/[0.06]">{props.code}</div> : null}
      </section>
    </div>
  );
}

export function sourceCodePanelBounds(containerHeight: number) {
  const max = Math.max(MIN_PANEL_HEIGHT, Math.round(containerHeight) - MIN_TREE_HEIGHT);
  return { min: Math.min(MIN_PANEL_HEIGHT, max), max };
}

export function sourceCodePanelDefaultHeight(containerHeight: number) {
  const bounds = sourceCodePanelBounds(containerHeight);
  return clampSourceCodePanelHeight(containerHeight * DEFAULT_HEIGHT_RATIO, bounds);
}

export function clampSourceCodePanelHeight(height: number, bounds: { min: number; max: number }) {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(height)));
}
