import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { MobilePane } from "../shell/MobileDock";
import { SourceWorkspaceAreaTabs, type SourceWorkspaceActivity } from "./SourceWorkspaceAreaTabs";

export function SourceWorkspaceMobile(props: {
  activity: SourceWorkspaceActivity;
  appSidebar: ReactNode;
  canvas: ReactNode;
  left: ReactNode;
  mobilePane: MobilePane;
  returnActivity: Exclude<SourceWorkspaceActivity, "files">;
  right: ReactNode;
  onActivityChange: (activity: SourceWorkspaceActivity) => void;
  onPaneChange: (pane: MobilePane) => void;
}) {
  const open = props.mobilePane !== "canvas";
  const fromRight = props.mobilePane === "inspect";
  const showApp = !fromRight && props.activity === "app";
  const showDocuments = !fromRight && props.activity !== "app";
  const openPane = (pane: MobilePane, activity?: SourceWorkspaceActivity) => {
    if (activity) props.onActivityChange(activity);
    props.onPaneChange(pane);
  };
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden" data-mobile-workspace>
      <aside
        aria-label="Mobile workspace sidebar"
        aria-hidden={!open}
        inert={!open}
        className={`absolute inset-y-0 z-30 h-full w-[min(88vw,360px)] overflow-hidden bg-[#101113] transition-transform duration-150 ease-out will-change-transform ${fromRight ? "right-0 border-l border-white/[0.08] shadow-[-18px_0_48px_rgba(0,0,0,0.38)]" : "left-0 border-r border-white/[0.08] shadow-[18px_0_48px_rgba(0,0,0,0.38)]"} ${open ? "translate-x-0 opacity-100" : `pointer-events-none opacity-0 ${fromRight ? "translate-x-full" : "-translate-x-full"}`}`}
        data-open={open || undefined}
        data-side={fromRight ? "right" : "left"}
      >
        <div className="flex h-full w-[min(88vw,360px)] min-w-0 flex-col bg-[#141518]">
          <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-white/[0.07] bg-[#101113] px-1.5">
            <SourceWorkspaceAreaTabs
              activity={props.activity}
              label="Mobile workspace areas"
              returnActivity={props.returnActivity}
              onActivityChange={(activity) => openPane(activity === "app" ? "tree" : "documents", activity)}
            />
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
          </header>
          <section aria-label="Mobile workspace panel" className="relative flex min-h-0 flex-1 overflow-hidden">
            <div
              aria-hidden={!showApp}
              className={`absolute inset-0 flex min-h-0 min-w-0 ${showApp ? "visible pointer-events-auto" : "invisible pointer-events-none"}`}
              inert={!showApp}
            >
              {props.appSidebar}
            </div>
            {showDocuments ? (
              <div className="absolute inset-0 flex min-h-0 min-w-0">{props.left}</div>
            ) : null}
            {fromRight ? (
              <div className="absolute inset-0 flex min-h-0 min-w-0">{props.right}</div>
            ) : null}
          </section>
        </div>
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
