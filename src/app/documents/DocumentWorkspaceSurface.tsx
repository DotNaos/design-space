import type { ReactNode } from "react";
import { X } from "lucide-react";

import type { MobilePane } from "../shell/MobileDock";
import { ResizableWorkspacePanels } from "../shell/ResizableWorkspacePanels";

export function DocumentWorkspaceSurface(props: {
  projectId: string;
  documentId: string;
  mobilePane: MobilePane;
  mobileEditorOpen?: boolean;
  left: ReactNode;
  canvas: ReactNode;
  right: ReactNode;
  mobileProject: ReactNode;
  mobileTree: ReactNode;
  mobileInspect: ReactNode;
  onMobileDrawerClose: () => void;
}) {
  const drawer = props.mobilePane === "tree"
    ? { label: "Component tree", content: props.mobileTree }
    : props.mobilePane === "inspect"
      ? { label: "Inspector", content: props.mobileInspect }
      : props.mobilePane === "canvas"
        ? undefined
        : { label: "Project", content: props.mobileProject };
  const canvasBottom = drawer ? "bottom-[70dvh]" : props.mobileEditorOpen ? "bottom-[62dvh]" : "bottom-0";
  const hideGestureHint = drawer || props.mobileEditorOpen;
  return (
    <ResizableWorkspacePanels
      namespace={{ projectId: props.projectId, documentId: props.documentId }}
      left={{ label: "Project and component tree", content: props.left }}
      right={{
        label: "Inspector and source changes",
        content: props.right,
        defaultWidth: 352,
        minWidth: 300,
        maxWidth: 640,
      }}
      mobile={(
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className={`absolute inset-x-0 top-0 flex min-h-0 min-w-0 transition-[bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${canvasBottom} ${hideGestureHint ? "[&_[data-design-space-gesture-hint]]:hidden" : ""}`}
          >
            {props.canvas}
          </div>
          {drawer ? (
            <section aria-label={`${drawer.label} drawer`} className="absolute inset-x-2 bottom-0 z-40 flex h-[70dvh] min-h-72 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] shadow-2xl">
              <header className="flex h-11 shrink-0 items-center border-b border-white/10 px-3">
                <h2 className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200">{drawer.label}</h2>
                <button aria-label={`Close ${drawer.label}`} className="grid size-11 place-items-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-zinc-200" type="button" onClick={props.onMobileDrawerClose}><X size={17} /></button>
              </header>
              <div className="flex min-h-0 min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">{drawer.content}</div>
            </section>
          ) : null}
        </div>
      )}
      contentClassName="flex"
    >
      {props.canvas}
    </ResizableWorkspacePanels>
  );
}
