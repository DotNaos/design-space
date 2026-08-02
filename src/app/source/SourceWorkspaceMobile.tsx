import { Button, Tooltip } from "@heroui/react";
import {
  ChevronLeft,
  FileCode2,
  Library,
  SlidersHorizontal,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";

import type { MobilePane } from "../shell/MobileDock";

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
        className={`absolute inset-y-0 left-0 z-30 h-full w-[min(88vw,360px)] overflow-hidden border-r border-white/[0.08] bg-[#101113] shadow-[18px_0_48px_rgba(0,0,0,0.38)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,.8,.22,1)] ${open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0"}`}
        data-open={open || undefined}
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
                <ChevronLeft size={15} />
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

function MobileAreaButton(props: {
  active: boolean;
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tooltip delay={350}>
      <Button
        aria-current={props.active ? "page" : undefined}
        aria-label={props.label}
        className={`h-8 min-w-0 flex-1 gap-1 rounded-lg px-1.5 text-[9px] font-medium transition-colors ${props.active ? "bg-[#292b31] text-zinc-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"}`}
        size="sm"
        variant="ghost"
        onPress={props.onPress}
      >
        {props.children}
        <span className="hidden min-[330px]:inline">{props.label}</span>
      </Button>
      <Tooltip.Content className="rounded-lg bg-[#202126] px-2 py-1 text-[10px] text-zinc-200 shadow-xl" placement="bottom">
        {props.label}
      </Tooltip.Content>
    </Tooltip>
  );
}
