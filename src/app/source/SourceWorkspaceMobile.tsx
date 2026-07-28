import { Button } from "@heroui/react";
import type { ReactNode } from "react";

import { MobileDock, type MobilePane } from "../shell/MobileDock";

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
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 flex min-h-0 min-w-0">{props.canvas}</div>
      {props.mobilePane !== "canvas" && (
        <section aria-label="Source workspace drawer" className="absolute inset-x-2 bottom-0 z-40 flex h-[72dvh] min-h-72 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 bg-[#141518] shadow-2xl">
          {props.mobilePane === "inspect" ? props.right : props.mobilePane === "tree" ? props.appSidebar : (
            <>
              <nav aria-label="Mobile source areas" className="grid h-12 shrink-0 grid-cols-3 gap-1 border-b border-white/10 p-1">
                {(["app", "files", "library"] as const).map((activity) => (
                  <Button
                    key={activity}
                    className={`rounded-lg text-[10px] capitalize ${props.activity === activity ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}
                    variant="ghost"
                    onPress={() => props.onActivityChange(activity)}
                  >
                    {activity}
                  </Button>
                ))}
              </nav>
              <div className="flex min-h-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">{props.left}</div>
            </>
          )}
        </section>
      )}
      <MobileDock active={props.mobilePane} onChange={props.onPaneChange} />
    </div>
  );
}
