import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { fitCanvas } from "../canvas-transform";
import { PreviewBoundary } from "../PreviewBoundary";

const frames: Record<DesignSpaceDevice, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: "Desktop · 1280 × 800" },
  tablet: { width: 768, height: 1024, label: "Tablet · 768 × 1024" },
  mobile: { width: 390, height: 844, label: "Mobile · 390 × 844" },
};

export function SourcePreviewFrame(props: {
  device: DesignSpaceDevice;
  entry?: RuntimeSourceWorkspaceEntry;
  runtime: "react" | "react-native";
  styles: readonly string[];
}) {
  const [mount, setMount] = useState<HTMLElement>();
  const frame = frames[props.device];
  const Icon = props.device === "desktop" ? Monitor : props.device === "tablet" ? Tablet : Smartphone;
  const loadFrame = useCallback((node: HTMLIFrameElement | null) => {
    if (!node) {
      setMount(undefined);
      return;
    }
    const update = () => setMount(node.contentDocument?.getElementById("design-space-preview-root") ?? undefined);
    node.addEventListener("load", update, { once: true });
    update();
  }, []);

  if (props.runtime === "react-native") {
    return (
      <PreviewState
        title="React Native target indexed"
        message="The native source tree and TypeScript contracts are available. A simulator renderer must connect before this target can claim preview readiness."
      />
    );
  }
  if (!props.entry) {
    return (
      <PreviewState
        title={`No ${props.device} implementation`}
        message="Add an exported React component at the shown fixed path, or configure the explicit Tablet fallback."
      />
    );
  }

  const Component = props.entry.component;
  const requiredProps = props.entry.props.filter((property) => property.required);
  if (requiredProps.length > 0) {
    return (
      <PreviewState
        title="Preview arguments required"
        message={`Design Space will not invent values or execute this component with an invalid contract. Required props: ${requiredProps.map((property) => property.name).join(", ")}.`}
      />
    );
  }

  return (
    <section aria-label={`${props.entry.label} preview`} className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-[#0d0e10]">
      <header className="relative flex h-10 shrink-0 items-center justify-center border-b border-white/10 bg-[#111214] text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><Icon aria-hidden="true" size={13} />{frame.label}</span>
      </header>
      <FittedPreviewViewport frame={frame}>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-white shadow-2xl" style={{ width: frame.width, height: frame.height }}>
          <iframe
            ref={loadFrame}
            className="h-full w-full border-0"
            srcDoc={'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="design-space-preview-root"></div></body></html>'}
            title={`${props.entry.label} ${props.device} preview`}
          />
          {mount && createPortal(
            <PreviewBoundary
              resetKey={props.entry.id}
              errorTitle="Target preview crashed"
              errorMessage="Fix the target source or its required runtime context to recover."
            >
              <style>{props.styles.join("\n")}</style>
              <Component />
            </PreviewBoundary>,
            mount,
          )}
        </div>
      </FittedPreviewViewport>
    </section>
  );
}

function FittedPreviewViewport(props: {
  children: React.ReactNode;
  frame: { width: number; height: number };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    width: props.frame.width + 16,
    height: props.frame.height + 16,
  });
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      if (element.clientWidth > 0 && element.clientHeight > 0) {
        setViewport({ width: element.clientWidth, height: element.clientHeight });
      }
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  const camera = fitCanvas(viewport, props.frame, 8, 8);
  return (
    <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: props.frame.width,
          height: props.frame.height,
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

function PreviewState(props: { title: string; message: string }) {
  return (
    <section className="grid h-full min-h-0 place-items-center bg-[#0d0e10] px-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-sm font-semibold text-zinc-200">{props.title}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{props.message}</p>
      </div>
    </section>
  );
}
