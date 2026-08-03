import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, FileCode2, Library, SlidersHorizontal, Waypoints } from "lucide-react";
import type { ReactNode } from "react";

import type { MobilePane } from "../shell/MobileDock";
import { MobileAreaButton } from "./MobileAreaButton";

type SourceWorkspaceActivity = "app" | "files" | "library";

export function SourceWorkspaceMobile(props: {
  activity: SourceWorkspaceActivity;
  appSidebar: ReactNode;
  canvas: ReactNode;
  left: ReactNode;
  mobilePane: MobilePane;
  right: ReactNode;
  onActivityChange: (activity: SourceWorkspaceActivity) => void;
  onPaneChange: (pane: MobilePane) => void;
}) {
  const open = props.mobilePane !== "canvas";
  const fromRight = props.mobilePane === "inspect";
  const openPane = (pane: MobilePane, activity?: SourceWorkspaceActivity) => {
    if (activity) props.onActivityChange(activity);
    props.onPaneChange(pane);
  };
  const panel = props.mobilePane === "inspect"
    ? props.right
    : props.activity === "app"
      ? props.appSidebar
      : props.left;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden" data-mobile-workspace>
      <aside
        aria-label="Mobile workspace sidebar"
        aria-hidden={!open}
        className={`absolute inset-y-0 z-30 h-full w-[min(88vw,360px)] overflow-hidden bg-[#101113] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,.8,.22,1)] ${fromRight ? "right-0 border-l border-white/[0.08] shadow-[-18px_0_48px_rgba(0,0,0,0.38)]" : "left-0 border-r border-white/[0.08] shadow-[18px_0_48px_rgba(0,0,0,0.38)]"} ${open ? "translate-x-0 opacity-100" : `pointer-events-none opacity-0 ${fromRight ? "translate-x-full" : "-translate-x-full"}`}`}
        data-open={open || undefined}
        data-side={fromRight ? "right" : "left"}
      >
        {open ? (
          <div className="flex h-full w-[min(88vw,360px)] min-w-0 flex-col bg-[#141518]">
            <section aria-label="Mobile workspace panel" className="flex min-h-0 flex-1 overflow-hidden">
              {panel}
            </section>
            <footer className="flex h-12 shrink-0 items-center gap-1.5 border-t border-white/[0.07] bg-[#101113] px-1.5 pb-[env(safe-area-inset-bottom)]">
              <nav aria-label="Mobile workspace areas" className="flex min-w-0 flex-1 items-center rounded-xl bg-black/20 p-0.5">
                <MobileAreaButton active={props.activity === "app" && props.mobilePane !== "inspect"} label="Structure" onPress={() => openPane("tree", "app")}>
                  <Waypoints size={14} />
                </MobileAreaButton>
                <MobileAreaButton active={props.mobilePane === "inspect"} label="Inspect" onPress={() => openPane("inspect")}>
                  <SlidersHorizontal size={14} />
                </MobileAreaButton>
                <MobileAreaButton active={props.activity === "files" && props.mobilePane !== "inspect"} label="Files" onPress={() => openPane("documents", "files")}>
                  <FileCode2 size={14} />
                </MobileAreaButton>
                <MobileAreaButton active={props.activity === "library" && props.mobilePane !== "inspect"} label="Library" onPress={() => openPane("documents", "library")}>
                  <Library size={14} />
                </MobileAreaButton>
              </nav>
              <Button
                isIconOnly
                aria-label="Close mobile sidebar"
                className="size-8 min-w-8 rounded-lg text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
                size="sm"
                variant="ghost"
                onPress={() => props.onPaneChange("canvas")}
              >
                {fromRight ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </Button>
            </footer>
          </div>
        ) : null}
      </aside>

      {open ? (
        <Button
          isIconOnly
          excludeFromTabOrder
          aria-label="Close mobile sidebar overlay"
          className="absolute inset-0 z-20 h-auto w-auto !min-h-0 !min-w-0 cursor-default rounded-none bg-black/35 p-0"
          variant="ghost"
          onPress={() => props.onPaneChange("canvas")}
        />
      ) : null}

      <main className="relative flex min-h-0 min-w-0 flex-1" data-mobile-main-view>
        <div className="absolute inset-0 flex min-h-0 min-w-0">{props.canvas}</div>
      </main>
    </div>
  );
}
