import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

import type { DesignSpaceDevice, RuntimeSourceWorkspaceEntry } from "../../shared/source-workspace";
import { PreviewBoundary } from "../PreviewBoundary";
import { SourceCanvasViewport } from "./SourceCanvasViewport";

export function SourcePreviewFrame(props: {
  device: DesignSpaceDevice;
  entry?: RuntimeSourceWorkspaceEntry;
  runtime: "react" | "react-native";
  styles: readonly string[];
}) {
  const [mount, setMount] = useState<HTMLElement>();
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
  const entry = props.entry;

  const Component = entry.component;
  const requiredProps = entry.props.filter((property) => property.required);
  if (requiredProps.length > 0) {
    return (
      <PreviewState
        title="Preview arguments required"
        message={`Design Space will not invent values or execute this component with an invalid contract. Required props: ${requiredProps.map((property) => property.name).join(", ")}.`}
      />
    );
  }

  return (
    <SourceCanvasViewport device={props.device}>
      {(frame) => (
        <div className="h-full w-full" style={{ width: frame.width, height: frame.height }}>
          <iframe
            ref={loadFrame}
            className="h-full w-full border-0"
            srcDoc={'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="design-space-preview-root"></div></body></html>'}
            title={`${entry.label} ${props.device} preview`}
          />
          {mount && createPortal(
            <PreviewBoundary
              resetKey={entry.id}
              errorTitle="Target preview crashed"
              errorMessage="Fix the target source or its required runtime context to recover."
            >
              <style>{props.styles.join("\n")}</style>
              <Component />
            </PreviewBoundary>,
            mount,
          )}
        </div>
      )}
    </SourceCanvasViewport>
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
